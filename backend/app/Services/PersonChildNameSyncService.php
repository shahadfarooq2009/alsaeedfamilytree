<?php

namespace App\Services;

use App\Models\Person;

class PersonChildNameSyncService
{
    public function syncChildrenOfFather(Person $father): int
    {
        if ($father->gender !== 'male') {
            return 0;
        }

        $fatherName = trim((string) $father->full_name);
        if ($fatherName === '') {
            return 0;
        }

        $children = Person::query()
            ->where('family_id', $father->family_id)
            ->where('father_id', $father->id)
            ->get();

        return $this->applyFatherNameToChildren($children, $fatherName);
    }

    public function syncChildrenOfMother(Person $mother, ?string $fatherNameText): int
    {
        if ($mother->gender !== 'female' || !filled($fatherNameText)) {
            return 0;
        }

        $fatherName = trim((string) $fatherNameText);

        $children = Person::query()
            ->where('family_id', $mother->family_id)
            ->where('mother_id', $mother->id)
            ->get();

        return $this->applyFatherNameToChildren($children, $fatherName, true);
    }

    /**
     * @param \Illuminate\Support\Collection<int, Person>|\Illuminate\Database\Eloquent\Collection<int, Person> $children
     */
    private function applyFatherNameToChildren($children, string $fatherName, bool $updateFatherNameText = false): int
    {
        $updated = 0;

        foreach ($children as $child) {
            $firstName = trim((string) $child->first_name);
            if ($firstName === '') {
                $firstName = $this->firstNameFromFullName((string) $child->full_name);
            }

            $nextFullName = $this->buildPatronymicFullName($firstName, $fatherName);
            $childChanged = false;

            if ($nextFullName !== '' && $nextFullName !== $child->full_name) {
                $child->full_name = $nextFullName;
                $childChanged = true;
            }

            if ($firstName !== '' && $child->first_name !== $firstName) {
                $child->first_name = $firstName;
                $childChanged = true;
            }

            if ($updateFatherNameText && !$child->father_id && $child->father_name_text !== $fatherName) {
                $child->father_name_text = $fatherName;
                $childChanged = true;
            }

            if (!$childChanged) {
                continue;
            }

            $child->save();
            $updated++;
        }

        return $updated;
    }

    private function firstNameFromFullName(string $fullName): string
    {
        $parts = preg_split('/\s+/u', trim($fullName)) ?: [];
        return $parts[0] ?? '';
    }

    private function buildPatronymicFullName(string $firstName, string $fatherName): string
    {
        $firstName = trim($firstName);
        $fatherName = trim($fatherName);

        if ($fatherName === '') {
            return $firstName;
        }

        if ($firstName === '') {
            return $fatherName;
        }

        if (str_contains($firstName, $fatherName)) {
            return $firstName;
        }

        return trim($firstName . ' ' . $fatherName);
    }
}
