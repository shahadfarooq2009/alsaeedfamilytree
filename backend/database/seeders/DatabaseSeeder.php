<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run()
    {
        $this->call(InitialFamilySeeder::class);

        // Run demo tree data manually in local development:
        // php artisan db:seed --class=FamilyTreeDemoSeeder
    }
}
