<?php

namespace App\Services;

use App\Models\Person;
use App\Models\PersonRelationship;
use App\Services\PersonGenerationService;
use Illuminate\Support\Facades\DB;

class PersonPruningService
{
    public function __construct(
        private readonly PersonGenerationService $generationService,
    ) {
    }
    /**
     * Delete all people at or above a generation, deepest first.
     *
     * @return array{deleted: int, families: array<int, int>}
     */
    public function pruneFromGeneration(int $minGeneration = 3, ?int $familyId = null): array
    {
        if ($minGeneration < 2) {
            throw new \InvalidArgumentException('Cannot prune generations below 2 — founders and direct children must be kept.');
        }

        return DB::transaction(function () use ($minGeneration, $familyId) {
            $deleted = 0;
            $families = [];

            $maxGeneration = Person::query()
                ->when($familyId, fn ($query) => $query->where('family_id', $familyId))
                ->where('generation_number', '>=', $minGeneration)
                ->max('generation_number');

            if ($maxGeneration === null) {
                return ['deleted' => 0, 'families' => []];
            }

            for ($generation = (int) $maxGeneration; $generation >= $minGeneration; $generation--) {
                $people = Person::query()
                    ->when($familyId, fn ($query) => $query->where('family_id', $familyId))
                    ->where('generation_number', $generation)
                    ->orderByDesc('id')
                    ->get();

                foreach ($people as $person) {
                    PersonRelationship::query()
                        ->where('family_id', $person->family_id)
                        ->where(function ($query) use ($person) {
                            $query->where('person_id', $person->id)
                                ->orWhere('related_person_id', $person->id);
                        })
                        ->delete();

                    $familyKey = (int) $person->family_id;
                    $families[$familyKey] = ($families[$familyKey] ?? 0) + 1;

                    $person->delete();
                    $deleted++;
                }
            }

            foreach (array_keys($families) as $affectedFamilyId) {
                $this->generationService->recalculateFamily((int) $affectedFamilyId);
            }

            return [
                'deleted' => $deleted,
                'families' => $families,
            ];
        });
    }
}
