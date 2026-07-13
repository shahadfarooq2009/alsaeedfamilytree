<?php

namespace Database\Factories;

use App\Models\Family;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class FamilyFactory extends Factory
{
    protected $model = Family::class;

    public function definition()
    {
        return [
            'name' => $this->faker->company() . ' Family',
            'description' => $this->faker->sentence(),
            'created_by' => User::factory(),
        ];
    }
}
