<?php

namespace Database\Factories;

use App\Models\Family;
use App\Models\Person;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PersonFactory extends Factory
{
    protected $model = Person::class;

    public function definition()
    {
        $firstName = $this->faker->firstName();
        $middleName = $this->faker->firstName();
        $lastName = $this->faker->lastName();

        return [
            'first_name' => $firstName,
            'middle_name' => $middleName,
            'last_name' => $lastName,
            'full_name' => "{$firstName} {$middleName} {$lastName}",
            'gender' => $this->faker->randomElement(['male', 'female']),
            'birth_date' => $this->faker->date(),
            'generation_number' => 0,
            'is_family_head' => false,
            'is_living' => true,
            'privacy_level' => 'family',
        ];
    }

    public function configure()
    {
        return $this->afterMaking(function (Person $person) {
            if (!$person->family_id) {
                $person->family_id = Family::factory()->create()->id;
            }

            if (!$person->created_by) {
                $person->created_by = User::factory()->create()->id;
            }
        });
    }

    public function familyHead()
    {
        return $this->state(fn () => [
            'is_family_head' => true,
            'generation_number' => 0,
        ]);
    }

    public function withParents(Person $father = null, Person $mother = null)
    {
        return $this->state(function (array $attributes) use ($father, $mother) {
            $generation = 0;

            if ($father) {
                $generation = max($generation, $father->generation_number + 1);
            }

            if ($mother) {
                $generation = max($generation, $mother->generation_number + 1);
            }

            return [
                'family_id' => $father?->family_id ?? $mother?->family_id ?? $attributes['family_id'],
                'father_id' => $father?->id,
                'mother_id' => $mother?->id,
                'generation_number' => $generation,
            ];
        });
    }
}
