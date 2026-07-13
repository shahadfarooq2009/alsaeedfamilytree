<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFamilyRequest;
use App\Models\Family;
use App\Models\FamilyMembership;
use App\Models\Person;
use App\Models\PersonRelationship;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FamilyController extends Controller
{
    public function index(Request $request)
    {
        $families = Family::query()
            ->whereHas('memberships', function ($query) use ($request) {
                $query->where('user_id', $request->user()->id);
            })
            ->orderBy('id')
            ->get(['id', 'name', 'description', 'founder_person_id']);

        return response()->json([
            'data' => $families,
        ]);
    }

    public function store(StoreFamilyRequest $request)
    {
        $this->authorize('create', Family::class);

        $data = $request->validated();

        $family = Family::create([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        FamilyMembership::create([
            'family_id' => $family->id,
            'user_id' => $request->user()->id,
            'role' => 'owner',
        ]);

        return response()->json([
            'data' => [
                'id' => $family->id,
                'name' => $family->name,
                'description' => $family->description,
                'founder_person_id' => $family->founder_person_id,
            ],
        ], 201);
    }

    public function show(Family $family)
    {
        $this->authorize('view', $family);

        return response()->json([
            'data' => [
                'id' => $family->id,
                'name' => $family->name,
                'description' => $family->description,
                'founder_person_id' => $family->founder_person_id,
            ],
        ]);
    }

    public function destroy(Family $family)
    {
        $this->authorize('delete', $family);

        DB::transaction(function () use ($family) {
            $personIds = Person::query()
                ->where('family_id', $family->id)
                ->pluck('id');

            PersonRelationship::query()
                ->where('family_id', $family->id)
                ->delete();

            if ($personIds->isNotEmpty()) {
                PersonRelationship::query()
                    ->whereIn('person_id', $personIds)
                    ->orWhereIn('related_person_id', $personIds)
                    ->delete();

                Person::query()
                    ->where('family_id', $family->id)
                    ->update([
                        'father_id' => null,
                        'mother_id' => null,
                    ]);

                Person::query()
                    ->where('family_id', $family->id)
                    ->delete();
            }

            FamilyMembership::query()
                ->where('family_id', $family->id)
                ->delete();

            $family->delete();
        });

        return response()->json(['data' => null], 204);
    }
}
