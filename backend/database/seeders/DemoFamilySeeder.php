<?php

namespace Database\Seeders;

use App\Models\Family;
use App\Models\FamilyMembership;
use App\Models\Person;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoFamilySeeder extends Seeder
{
    public function run()
    {
        $user = User::firstOrCreate(
            ['email' => 'admin@familytree.test'],
            [
                'name' => 'مدير العائلة',
                'password' => Hash::make('password'),
            ]
        );

        $family = Family::firstOrCreate(
            ['name' => 'عائلة العتيبي'],
            [
                'description' => 'شجرة عائلة تجريبية للاختبار اليدوي',
                'created_by' => $user->id,
            ]
        );

        FamilyMembership::firstOrCreate(
            [
                'family_id' => $family->id,
                'user_id' => $user->id,
            ],
            ['role' => 'owner']
        );

        $founder = Person::firstOrCreate(
            [
                'family_id' => $family->id,
                'full_name' => 'عبدالعزيز العتيبي',
            ],
            [
                'first_name' => 'عبدالعزيز',
                'last_name' => 'العتيبي',
                'gender' => 'male',
                'is_family_head' => true,
                'generation_number' => 0,
                'created_by' => $user->id,
            ]
        );

        $family->update(['founder_person_id' => $founder->id]);

        Person::firstOrCreate(
            [
                'family_id' => $family->id,
                'full_name' => 'فاروق عبدالعزيز',
            ],
            [
                'first_name' => 'فاروق',
                'middle_name' => 'عبدالعزيز',
                'gender' => 'male',
                'father_id' => $founder->id,
                'generation_number' => 1,
                'created_by' => $user->id,
            ]
        );
    }
}
