<?php

namespace Database\Seeders;

use App\Models\Family;
use App\Models\FamilyMembership;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class InitialFamilySeeder extends Seeder
{
    public function run()
    {
        $user = User::updateOrCreate(
            ['email' => 'meshoosha88@gmail.com'],
            [
                'name' => 'Admin',
                'password' => Hash::make('12345678'),
            ]
        );

        $family = Family::updateOrCreate(
            ['name' => 'عائلة عبدالعزيز'],
            [
                'description' => 'Abdulaziz Family',
                'created_by' => $user->id,
            ]
        );

        FamilyMembership::updateOrCreate(
            [
                'family_id' => $family->id,
                'user_id' => $user->id,
            ],
            [
                'role' => 'owner',
            ]
        );
    }
}
