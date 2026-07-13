<?php

namespace Tests\Feature;

use App\Models\Family;
use App\Models\FamilyMembership;
use App\Models\Person;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PersonApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Family $family;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->family = Family::factory()->create(['created_by' => $this->user->id]);

        FamilyMembership::factory()->owner()->create([
            'family_id' => $this->family->id,
            'user_id' => $this->user->id,
        ]);

        Sanctum::actingAs($this->user);
    }

    public function test_can_list_family_people()
    {
        Person::factory()->count(3)->create(['family_id' => $this->family->id]);

        $response = $this->getJson("/api/families/{$this->family->id}/people");

        $response->assertOk()
            ->assertJsonStructure(['data' => [['id', 'full_name', 'generation_number']]]);
    }

    public function test_can_create_family_founder_with_generation_zero()
    {
        $response = $this->postJson("/api/families/{$this->family->id}/people", [
            'first_name' => 'عبدالعزيز',
            'middle_name' => null,
            'last_name' => 'العتيبي',
            'gender' => 'male',
            'is_family_head' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.generation_number', 0)
            ->assertJsonPath('data.full_name', 'عبدالعزيز العتيبي');

        $this->assertDatabaseHas('people', [
            'family_id' => $this->family->id,
            'generation_number' => 0,
            'is_family_head' => true,
        ]);

        $this->family->refresh();
        $this->assertNotNull($this->family->founder_person_id);
    }

    public function test_child_generation_is_parent_generation_plus_one()
    {
        $father = Person::factory()->familyHead()->create([
            'family_id' => $this->family->id,
            'gender' => 'male',
            'first_name' => 'فاروق',
            'full_name' => 'فاروق عبدالعزيز',
        ]);

        $response = $this->postJson("/api/families/{$this->family->id}/people", [
            'first_name' => 'شهد',
            'middle_name' => 'فاروق',
            'last_name' => 'عبدالعزيز',
            'gender' => 'female',
            'father_id' => $father->id,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.generation_number', 1)
            ->assertJsonPath('data.father_id', $father->id);
    }

    public function test_cannot_set_self_as_parent()
    {
        $person = Person::factory()->create(['family_id' => $this->family->id]);

        $response = $this->putJson("/api/families/{$this->family->id}/people/{$person->id}", [
            'father_id' => $person->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['father_id']);
    }

    public function test_cannot_create_circular_relationship()
    {
        $grandfather = Person::factory()->familyHead()->create([
            'family_id' => $this->family->id,
            'gender' => 'male',
        ]);

        $father = Person::factory()->create([
            'family_id' => $this->family->id,
            'father_id' => $grandfather->id,
            'generation_number' => 1,
            'gender' => 'male',
        ]);

        $child = Person::factory()->create([
            'family_id' => $this->family->id,
            'father_id' => $father->id,
            'generation_number' => 2,
        ]);

        $response = $this->putJson("/api/families/{$this->family->id}/people/{$grandfather->id}", [
            'father_id' => $child->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['father_id']);
    }

    public function test_parent_must_belong_to_same_family()
    {
        $otherFamily = Family::factory()->create();
        $otherParent = Person::factory()->create(['family_id' => $otherFamily->id]);

        $response = $this->postJson("/api/families/{$this->family->id}/people", [
            'first_name' => 'أحمد',
            'father_id' => $otherParent->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['father_id']);
    }

    public function test_can_search_parent_candidates()
    {
        Person::factory()->create([
            'family_id' => $this->family->id,
            'full_name' => 'فاروق عبدالعزيز',
            'gender' => 'male',
        ]);

        $response = $this->getJson("/api/families/{$this->family->id}/people/parent-candidates?search=فاروق&gender=male");

        $response->assertOk()
            ->assertJsonFragment(['full_name' => 'فاروق عبدالعزيز']);
    }

    public function test_can_read_person_details()
    {
        $person = Person::factory()->create(['family_id' => $this->family->id]);

        $response = $this->getJson("/api/families/{$this->family->id}/people/{$person->id}");

        $response->assertOk()
            ->assertJsonPath('data.id', $person->id)
            ->assertJsonStructure(['data' => ['full_name', 'generation_number', 'children']]);
    }

    public function test_can_read_descendant_hierarchy()
    {
        $founder = Person::factory()->familyHead()->create([
            'family_id' => $this->family->id,
            'full_name' => 'المؤسس',
        ]);

        $child = Person::factory()->create([
            'family_id' => $this->family->id,
            'father_id' => $founder->id,
            'generation_number' => 1,
            'full_name' => 'الابن',
        ]);

        Person::factory()->create([
            'family_id' => $this->family->id,
            'father_id' => $child->id,
            'generation_number' => 2,
            'full_name' => 'الحفيد',
        ]);

        $response = $this->getJson("/api/families/{$this->family->id}/people/{$founder->id}/descendants");

        $response->assertOk()
            ->assertJsonPath('data.full_name', 'المؤسس')
            ->assertJsonPath('data.children.0.full_name', 'الابن')
            ->assertJsonPath('data.children.0.children.0.full_name', 'الحفيد');
    }

    public function test_can_read_family_tree()
    {
        $founder = Person::factory()->familyHead()->create([
            'family_id' => $this->family->id,
            'full_name' => 'المؤسس',
        ]);

        $this->family->update(['founder_person_id' => $founder->id]);

        $child = Person::factory()->create([
            'family_id' => $this->family->id,
            'father_id' => $founder->id,
            'generation_number' => 1,
            'full_name' => 'الابن',
        ]);

        $response = $this->getJson("/api/families/{$this->family->id}/tree");

        $response->assertOk()
            ->assertJsonPath('data.0.full_name', 'المؤسس')
            ->assertJsonPath('data.0.father_id', null)
            ->assertJsonPath('data.0.children.0.full_name', 'الابن');

        $this->assertEquals($founder->id, $response->json('data.0.children.0.father_id'));
    }

    public function test_viewer_cannot_create_person()
    {
        $viewer = User::factory()->create();
        FamilyMembership::factory()->viewer()->create([
            'family_id' => $this->family->id,
            'user_id' => $viewer->id,
        ]);

        Sanctum::actingAs($viewer);

        $response = $this->postJson("/api/families/{$this->family->id}/people", [
            'first_name' => 'محمد',
        ]);

        $response->assertForbidden();
    }
}
