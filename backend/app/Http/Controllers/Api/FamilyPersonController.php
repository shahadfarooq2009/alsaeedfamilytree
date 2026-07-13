<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ParentCandidateRequest;
use App\Http\Requests\StorePersonRequest;
use App\Http\Requests\UpdatePersonRequest;
use App\Http\Resources\ParentCandidateResource;
use App\Http\Resources\PersonDetailResource;
use App\Http\Resources\PersonSummaryResource;
use App\Models\Family;
use App\Models\Person;
use App\Models\PersonRelationship;
use App\Services\PersonChildNameSyncService;
use App\Services\PersonGenerationService;
use App\Services\PersonHierarchyService;
use App\Services\PersonNameService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FamilyPersonController extends Controller
{
    public function __construct(
        PersonGenerationService $generationService,
        PersonNameService $nameService,
        PersonHierarchyService $hierarchyService,
        PersonChildNameSyncService $childNameSyncService
    ) {
        $this->generationService = $generationService;
        $this->nameService = $nameService;
        $this->hierarchyService = $hierarchyService;
        $this->childNameSyncService = $childNameSyncService;
    }

    private PersonGenerationService $generationService;
    private PersonNameService $nameService;
    private PersonHierarchyService $hierarchyService;
    private PersonChildNameSyncService $childNameSyncService;

    public function index(Request $request, Family $family)
    {
        $this->authorize('view', $family);

        $people = Person::query()
            ->where('family_id', $family->id)
            ->with(['father:id,full_name', 'mother:id,full_name'])
            ->when($request->search, function ($query, $search) {
                $query->where('full_name', 'like', '%' . $search . '%');
            })
            ->orderBy('generation_number')
            ->orderBy('full_name')
            ->paginate((int) $request->input('per_page', 50));

        return PersonSummaryResource::collection($people);
    }

    public function store(StorePersonRequest $request, Family $family)
    {
        $data = $request->validated();
        $data['family_id'] = $family->id;
        $data['created_by'] = $request->user()->id;
        $data = $this->sanitizeParentIds($data);
        $treeParentId = isset($data['tree_parent_id']) ? (int) $data['tree_parent_id'] : null;
        unset($data['tree_parent_id'], $data['display_parent_id'], $data['branch_root_id']);
        $data['full_name'] = $this->resolvePersistedFullName($data);
        $data['generation_number'] = $this->generationService->calculate(
            $data['father_id'] ?? null,
            $data['mother_id'] ?? null,
            $data['is_family_head'] ?? false,
            $treeParentId,
        );

        $person = Person::create($data);

        if ($person->is_family_head && !$family->founder_person_id) {
            $family->update(['founder_person_id' => $person->id]);
        }

        $person->load(['father', 'mother']);
        $this->attachRelationshipLists($person);

        return (new PersonDetailResource($person))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Family $family, Person $person)
    {
        $this->ensurePersonBelongsToFamily($family, $person);
        $this->authorize('view', $person);

        $person->load(['father', 'mother']);
        $this->attachRelationshipLists($person);

        return new PersonDetailResource($person);
    }

    public function update(UpdatePersonRequest $request, Family $family, Person $person)
    {
        $this->ensurePersonBelongsToFamily($family, $person);

        $data = $request->validated();
        $data = $this->sanitizeParentIds($data, $person);

        if (
            isset($data['first_name'])
            || isset($data['middle_name'])
            || isset($data['last_name'])
            || isset($data['father_name_text'])
            || isset($data['father_id'])
            || array_key_exists('full_name', $data)
        ) {
            $data['full_name'] = $this->resolvePersistedFullName($data, $person);
        }

        $person->fill($data);
        $person->generation_number = $this->generationService->calculate(
            $person->father_id,
            $person->mother_id,
            $person->is_family_head
        );
        $person->save();

        $this->generationService->recalculateSubtree($person);
        $freshPerson = $person->fresh();
        $this->childNameSyncService->syncChildrenOfFather($freshPerson);

        if (
            array_key_exists('spouse_name', $data)
            && $freshPerson
            && $freshPerson->gender === 'female'
            && filled($freshPerson->spouse_name)
        ) {
            $this->childNameSyncService->syncChildrenOfMother($freshPerson, $freshPerson->spouse_name);
        }

        $person->load(['father', 'mother']);
        $this->attachRelationshipLists($person);

        return new PersonDetailResource($person);
    }

    public function destroy(Family $family, Person $person)
    {
        $this->ensurePersonBelongsToFamily($family, $person);
        $this->authorize('delete', $person);

        if ($person->is_family_head || (int) $family->founder_person_id === (int) $person->id) {
            return response()->json([
                'message' => 'لا يمكن حذف مؤسس العائلة.',
            ], 422);
        }

        $hasChildren = Person::query()
            ->where('family_id', $family->id)
            ->where(function ($query) use ($person) {
                $query->where('father_id', $person->id)
                    ->orWhere('mother_id', $person->id);
            })
            ->exists();

        if ($hasChildren) {
            return response()->json([
                'message' => 'لا يمكن حذف فرد لديه أبناء مسجلون في الشجرة.',
            ], 422);
        }

        DB::transaction(function () use ($family, $person) {
            PersonRelationship::query()
                ->where('family_id', $family->id)
                ->where(function ($query) use ($person) {
                    $query->where('person_id', $person->id)
                        ->orWhere('related_person_id', $person->id);
                })
                ->delete();

            $person->delete();
        });

        return response()->json([
            'data' => null,
        ]);
    }

    public function parentCandidates(ParentCandidateRequest $request, Family $family)
    {
        $excludeId = $request->input('exclude_person_id') ? (int) $request->input('exclude_person_id') : null;
        $limit = (int) $request->input('limit', 20);

        $search = trim((string) $request->input('search', ''));
        $firstWord = $search !== '' ? explode(' ', $search, 2)[0] : '';

        $people = Person::query()
            ->where('family_id', $family->id)
            ->with('father:id,full_name')
            ->when($request->gender, function ($query, $gender) {
                $query->where(function ($inner) use ($gender) {
                    $inner->where('gender', $gender)->orWhereNull('gender');
                });
            })
            ->when($search !== '', function ($query) use ($search, $firstWord) {
                $query->where(function ($inner) use ($search, $firstWord) {
                    $inner->where('full_name', 'like', '%' . $search . '%');
                    if ($firstWord !== '' && $firstWord !== $search) {
                        $inner->orWhere('full_name', 'like', '%' . $firstWord . '%');
                    }
                });
            })
            ->when($excludeId, fn ($query) => $query->where('id', '!=', $excludeId))
            ->orderBy('full_name')
            ->limit($limit)
            ->get();

        return ParentCandidateResource::collection($people);
    }

    public function descendants(Family $family, Person $person)
    {
        $this->ensurePersonBelongsToFamily($family, $person);
        $this->authorize('view', $person);

        return response()->json([
            'data' => $this->hierarchyService->buildDescendantTree($person),
        ]);
    }

    public function tree(Family $family)
    {
        $this->authorize('view', $family);

        return response()->json([
            'data' => $this->hierarchyService->buildFamilyTree($family),
        ]);
    }

    private function attachRelationshipLists(Person $person): void
    {
        $person->children_list = $this->hierarchyService->getChildren($person);
        $person->spouses_list = $person->spouseRecords()->get();
    }

    private function ensurePersonBelongsToFamily(Family $family, Person $person): void
    {
        abort_if((int) $person->family_id !== (int) $family->id, 404);
    }

    private function sanitizeParentIds(array $data, ?Person $person = null): array
    {
        $fatherId = $data['father_id'] ?? $person?->father_id;
        $motherId = $data['mother_id'] ?? $person?->mother_id;

        if ($fatherId) {
            $father = Person::query()->find($fatherId);
            if ($father && $father->gender !== 'male') {
                $data['father_id'] = null;
                if (!$motherId && $father->gender === 'female') {
                    $data['mother_id'] = $father->id;
                }
            }
        }

        if ($motherId) {
            $mother = Person::query()->find($motherId);
            if ($mother && $mother->gender !== 'female') {
                $data['mother_id'] = null;
            }
        }

        return $data;
    }

    private function resolvePersistedFullName(array $data, ?Person $person = null): string
    {
        $firstName = trim((string) ($data['first_name'] ?? $person?->first_name ?? ''));
        $fatherId = $data['father_id'] ?? $person?->father_id ?? null;
        $fatherNameText = $data['father_name_text'] ?? $person?->father_name_text ?? null;

        if ($fatherId) {
            $father = Person::query()->find($fatherId);
            if ($father && $father->gender === 'male' && filled($father->full_name)) {
                return $this->nameService->buildPatronymicFullName($firstName, $father->full_name);
            }
        }

        if (!$fatherId && filled($fatherNameText)) {
            return $this->nameService->buildPatronymicFullName($firstName, $fatherNameText);
        }

        if (!empty($data['full_name'])) {
            return $data['full_name'];
        }

        return $this->nameService->buildFullName(
            $firstName,
            $data['middle_name'] ?? $person?->middle_name,
            $data['last_name'] ?? $person?->last_name
        );
    }
}
