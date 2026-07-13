<?php

namespace App\Services;

use App\Models\Family;
use App\Models\Person;
use Illuminate\Support\Collection;

class PersonHierarchyService
{
    /** @var array<int, int|null> */
    private array $layoutParentMemo = [];

    public function buildFamilyTree(Family $family): array
    {
        $people = Person::query()
            ->where('family_id', $family->id)
            ->orderBy('generation_number')
            ->orderBy('full_name')
            ->get()
            ->keyBy('id');

        if ($people->isEmpty()) {
            return [];
        }

        $this->layoutParentMemo = [];
        $founder = $this->resolveFounder($family, $people);
        $included = collect();

        $tree = $this->buildTreeNode($founder, $people, $included);
        $this->attachOrphanRoots($founder, $people, $included, $tree);
        $this->attachRemainingPeople($people, $included, $tree);

        return [$tree];
    }

    public function buildDescendantTree(Person $root): array
    {
        $people = Person::query()
            ->where('family_id', $root->family_id)
            ->get()
            ->keyBy('id');

        $this->layoutParentMemo = [];

        return $this->buildTreeNode($root, $people);
    }

    public function buildTreeNode(Person $person, Collection $people, ?Collection $included = null): array
    {
        $included?->put($person->id, true);

        $children = $this->getChildrenForTree($person, $people);

        return [
            'id' => $person->id,
            'full_name' => $person->full_name,
            'generation_number' => $person->generation_number,
            'gender' => $person->gender,
            'photo_url' => $person->photo_url,
            'father_id' => $person->father_id,
            'mother_id' => $person->mother_id,
            'birth_date' => $person->birth_date?->format('Y-m-d'),
            'death_date' => $person->death_date?->format('Y-m-d'),
            'phone' => $person->phone,
            'occupation' => $person->occupation,
            'education' => $person->education,
            'location' => $person->location,
            'biography' => $person->biography,
            'is_family_head' => $person->is_family_head,
            'is_living' => $person->is_living,
            'children' => $children
                ->map(fn (Person $child) => $this->buildTreeNode($child, $people, $included))
                ->values()
                ->all(),
        ];
    }

    public function getChildren(Person $person): Collection
    {
        return Person::query()
            ->where('family_id', $person->family_id)
            ->where(function ($query) use ($person) {
                $query->where('father_id', $person->id)
                    ->orWhere('mother_id', $person->id);
            })
            ->orderBy('generation_number')
            ->orderBy('birth_date')
            ->orderBy('full_name')
            ->get();
    }

    private function getChildrenForTree(Person $person, Collection $people): Collection
    {
        $this->warmLayoutParentMemo($people);

        return $people
            ->filter(fn (Person $child) => $this->layoutParentId($child, $people) === $person->id)
            ->sortBy(fn (Person $child) => sprintf(
                '%04d-%s',
                $child->generation_number,
                $child->full_name
            ))
            ->values();
    }

    private function resolveFounder(Family $family, Collection $people): Person
    {
        if ($family->founder_person_id && $people->has($family->founder_person_id)) {
            return $people->get($family->founder_person_id);
        }

        $familyHead = $people->first(fn (Person $person) => $person->is_family_head);
        if ($familyHead) {
            return $familyHead;
        }

        $roots = $people->filter(fn (Person $person) => $this->layoutParentId($person, $people) === null);

        if ($roots->isNotEmpty()) {
            return $roots->sortBy(fn (Person $person) => sprintf(
                '%04d-%s',
                $person->generation_number,
                $person->full_name
            ))->first();
        }

        return $people->sortBy('generation_number')->first();
    }

    private function attachOrphanRoots(
        Person $founder,
        Collection $people,
        Collection $included,
        array &$tree,
    ): void {
        $orphans = $people
            ->filter(fn (Person $person) => ! $included->has($person->id)
                && $person->id !== $founder->id
                && $this->layoutParentId($person, $people) === null)
            ->sortBy(fn (Person $person) => sprintf(
                '%04d-%s',
                $person->generation_number,
                $person->full_name
            ));

        foreach ($orphans as $orphan) {
            $tree['children'][] = $this->buildTreeNode($orphan, $people, $included);
        }
    }

    /** Attach people whose layout parent is already in the tree but who were missed. */
    private function attachRemainingPeople(Collection $people, Collection $included, array &$tree): void
    {
        $this->warmLayoutParentMemo($people);

        $remaining = $people->filter(fn (Person $person) => ! $included->has($person->id));

        while ($remaining->isNotEmpty()) {
            $attachedAny = false;

            foreach ($remaining as $person) {
                $parentId = $this->layoutParentId($person, $people);

                if ($parentId && $included->has($parentId)) {
                    $this->appendChildNode($tree, $parentId, $person, $people, $included);
                    $remaining = $people->filter(fn (Person $candidate) => ! $included->has($candidate->id));
                    $attachedAny = true;
                    break;
                }
            }

            if (! $attachedAny) {
                foreach ($remaining as $person) {
                    $tree['children'][] = $this->buildTreeNode($person, $people, $included);
                }
                break;
            }
        }
    }

    private function appendChildNode(
        array &$node,
        int $parentId,
        Person $child,
        Collection $people,
        Collection $included,
    ): void {
        if ((int) $node['id'] === $parentId) {
            $node['children'][] = $this->buildTreeNode($child, $people, $included);

            return;
        }

        foreach ($node['children'] as &$childNode) {
            $this->appendChildNode($childNode, $parentId, $child, $people, $included);
        }
    }

    private function warmLayoutParentMemo(Collection $people): void
    {
        if (! empty($this->layoutParentMemo)) {
            return;
        }

        $sorted = $people->sortBy(fn (Person $person) => sprintf(
            '%04d-%08d',
            $person->generation_number,
            $person->id
        ));

        foreach ($sorted as $person) {
            $this->layoutParentId($person, $people);
        }
    }

    private function layoutParentId(Person $person, Collection $people): ?int
    {
        if (array_key_exists($person->id, $this->layoutParentMemo)) {
            return $this->layoutParentMemo[$person->id];
        }

        if ($person->father_id) {
            return $this->layoutParentMemo[$person->id] = $person->father_id;
        }

        if (! $person->mother_id) {
            return $this->layoutParentMemo[$person->id] = null;
        }

        $siblingFather = $people->first(
            fn (Person $candidate) => $candidate->id !== $person->id
                && $candidate->mother_id === $person->mother_id
                && $candidate->father_id
        )?->father_id;

        if ($siblingFather) {
            return $this->layoutParentMemo[$person->id] = $siblingFather;
        }

        if ($people->has($person->mother_id)) {
            return $this->layoutParentMemo[$person->id] = $person->mother_id;
        }

        return $this->layoutParentMemo[$person->id] = null;
    }
}
