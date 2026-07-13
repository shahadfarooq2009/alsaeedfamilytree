<?php

namespace Tests\Unit;

use App\Models\Family;
use App\Models\Person;
use App\Services\PersonHierarchyService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PersonHierarchyServiceTest extends TestCase
{
    use RefreshDatabase;

    private PersonHierarchyService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PersonHierarchyService();
    }

    public function test_mother_only_child_appears_under_mother_in_family_tree(): void
    {
        $family = Family::factory()->create();

        $founder = Person::factory()->familyHead()->create([
            'family_id' => $family->id,
            'full_name' => 'عبدالعزيز جان محمد',
            'generation_number' => 0,
        ]);
        $family->update(['founder_person_id' => $founder->id]);

        $jihan = Person::factory()->create([
            'family_id' => $family->id,
            'full_name' => 'جيهان عبدالعزيز',
            'generation_number' => 1,
            'gender' => 'female',
        ]);

        $child = Person::factory()->create([
            'family_id' => $family->id,
            'mother_id' => $jihan->id,
            'father_id' => null,
            'full_name' => 'أسماء',
            'generation_number' => 2,
            'gender' => 'female',
        ]);

        $tree = $this->service->buildFamilyTree($family);
        $names = $this->collectNames($tree);

        $this->assertContains('أسماء', $names);
        $this->assertContains('جيهان عبدالعزيز', $names);
    }

    /** @param array<int, array<string, mixed>> $nodes */
    private function collectNames(array $nodes): array
    {
        $names = [];
        foreach ($nodes as $node) {
            $names[] = $node['full_name'];
            if (! empty($node['children'])) {
                $names = array_merge($names, $this->collectNames($node['children']));
            }
        }

        return $names;
    }
}
