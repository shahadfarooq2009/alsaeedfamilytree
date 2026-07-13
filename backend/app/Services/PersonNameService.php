<?php

namespace App\Services;

use App\Models\Person;

class PersonNameService
{
    public function buildFullName(string $firstName, ?string $middleName, ?string $lastName): string
    {
        return collect([$firstName, $middleName, $lastName])
            ->filter(fn ($part) => filled($part))
            ->implode(' ');
    }

    public function buildPatronymicFullName(string $firstName, ?string $fatherFullName): string
    {
        $firstName = trim($firstName);
        $fatherFullName = trim((string) $fatherFullName);

        if ($fatherFullName === '') {
            return $firstName;
        }

        if ($firstName === '') {
            return $fatherFullName;
        }

        if (str_contains($firstName, $fatherFullName)) {
            return $firstName;
        }

        return trim($firstName . ' ' . $fatherFullName);
    }
}
