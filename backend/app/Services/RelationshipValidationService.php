<?php

namespace App\Services;

use App\Models\Person;

class RelationshipValidationService
{
    public function wouldCreateCycle(int $personId, ?int $fatherId, ?int $motherId): bool
    {
        if ($fatherId && $this->isAncestor($personId, $fatherId)) {
            return true;
        }

        if ($motherId && $this->isAncestor($personId, $motherId)) {
            return true;
        }

        return false;
    }

    public function isSelfParent(int $personId, ?int $fatherId, ?int $motherId): bool
    {
        return $personId === $fatherId || $personId === $motherId;
    }

    public function parentsBelongToFamily(int $familyId, ?int $fatherId, ?int $motherId): bool
    {
        $familyId = (int) $familyId;
        $fatherId = $fatherId ? (int) $fatherId : null;
        $motherId = $motherId ? (int) $motherId : null;

        if ($fatherId) {
            $father = Person::find($fatherId);
            if (!$father || (int) $father->family_id !== $familyId) {
                return false;
            }
        }

        if ($motherId) {
            $mother = Person::find($motherId);
            if (!$mother || (int) $mother->family_id !== $familyId) {
                return false;
            }
        }

        return true;
    }

    private function isAncestor(int $ancestorId, int $descendantId): bool
    {
        $current = Person::find($descendantId);

        $visited = [];

        while ($current) {
            if ($current->id === $ancestorId) {
                return true;
            }

            if (isset($visited[$current->id])) {
                break;
            }

            $visited[$current->id] = true;

            if (!$current->father_id && !$current->mother_id) {
                break;
            }

            $parentId = $current->father_id ?? $current->mother_id;
            $current = Person::find($parentId);
        }

        return false;
    }
}
