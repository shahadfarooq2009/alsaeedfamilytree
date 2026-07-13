<?php

namespace Tests\Unit;

use App\Models\Person;
use App\Services\PersonGenerationService;
use App\Services\RelationshipValidationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonServicesTest extends TestCase
{
    use RefreshDatabase;

    public function test_generation_service_uses_highest_parent_generation()
    {
        $service = app(PersonGenerationService::class);

        $father = Person::factory()->create(['generation_number' => 2]);
        $mother = Person::factory()->create([
            'family_id' => $father->family_id,
            'generation_number' => 3,
        ]);

        $generation = $service->calculate($father->id, $mother->id);

        $this->assertEquals(4, $generation);
    }

    public function test_generation_service_uses_tree_parent_when_parent_ids_missing()
    {
        $service = app(PersonGenerationService::class);

        $parent = Person::factory()->create(['generation_number' => 4]);

        $generation = $service->calculate(null, null, false, $parent->id);

        $this->assertEquals(5, $generation);
    }

    public function test_relationship_service_detects_cycles()
    {
        $service = new RelationshipValidationService();

        $a = Person::factory()->create(['generation_number' => 0]);
        $b = Person::factory()->create([
            'family_id' => $a->family_id,
            'father_id' => $a->id,
            'generation_number' => 1,
        ]);
        $c = Person::factory()->create([
            'family_id' => $a->family_id,
            'father_id' => $b->id,
            'generation_number' => 2,
        ]);

        $this->assertTrue($service->wouldCreateCycle($a->id, $c->id, null));
        $this->assertFalse($service->wouldCreateCycle($c->id, $a->id, null));
    }
}
