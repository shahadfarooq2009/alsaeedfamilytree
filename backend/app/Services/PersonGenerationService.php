<?php

namespace App\Services;

use App\Models\Family;
use App\Models\Person;

class PersonGenerationService
{
    public function __construct(
        private readonly PersonHierarchyService $hierarchyService,
    ) {
    }
    public function calculate(
        ?int $fatherId,
        ?int $motherId,
        bool $isFamilyHead = false,
        ?int $treeParentId = null,
    ): int {
        if ($isFamilyHead) {
            return 1;
        }

        $parentGenerations = $this->collectParentGenerations($fatherId, $motherId);

        if (empty($parentGenerations) && $treeParentId) {
            $treeParent = Person::find($treeParentId);
            if ($treeParent && $treeParent->generation_number > 0) {
                return $treeParent->generation_number + 1;
            }
        }

        if (empty($parentGenerations)) {
            return 0;
        }

        return max($parentGenerations) + 1;
    }

    /**
     * @return int[]
     */
    private function collectParentGenerations(?int $fatherId, ?int $motherId): array
    {
        $parentGenerations = [];

        if ($fatherId) {
            $father = Person::find($fatherId);
            if ($father && $father->generation_number > 0) {
                $parentGenerations[] = $father->generation_number;
            }
        }

        if ($motherId) {
            $mother = Person::find($motherId);
            if ($mother && $mother->generation_number > 0) {
                $parentGenerations[] = $mother->generation_number;
            }
        }

        return $parentGenerations;
    }

    /**
     * Recalculate generation_number from the rendered family tree depth.
     *
     * @return int Number of people updated
     */
    public function recalculateFamily(int $familyId): int
    {
        $family = Family::query()->find($familyId);
        if (! $family) {
            return 0;
        }

        $trees = $this->hierarchyService->buildFamilyTree($family);
        if ($trees === []) {
            return 0;
        }

        $updated = 0;
        $walker = function (array $node, int $generation) use (&$walker, &$updated): void {
            $person = Person::query()->find($node['id']);
            if ($person && (int) $person->generation_number !== $generation) {
                $person->generation_number = $generation;
                $person->save();
                $updated++;
            }

            foreach ($node['children'] ?? [] as $child) {
                $walker($child, $generation + 1);
            }
        };

        $walker($trees[0], 1);

        return $updated;
    }

    public function recalculateSubtree(Person $person): void
    {
        $this->recalculateFamily((int) $person->family_id);
    }
}
