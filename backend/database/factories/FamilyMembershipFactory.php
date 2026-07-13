<?php

namespace Database\Factories;

use App\Models\Family;
use App\Models\FamilyMembership;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class FamilyMembershipFactory extends Factory
{
    protected $model = FamilyMembership::class;

    public function definition()
    {
        return [
            'family_id' => Family::factory(),
            'user_id' => User::factory(),
            'role' => 'editor',
        ];
    }

    public function owner()
    {
        return $this->state(fn () => ['role' => 'owner']);
    }

    public function viewer()
    {
        return $this->state(fn () => ['role' => 'viewer']);
    }
}
