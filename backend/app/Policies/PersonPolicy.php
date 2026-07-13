<?php

namespace App\Policies;

use App\Models\Family;
use App\Models\Person;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class PersonPolicy
{
    use HandlesAuthorization;

    private const TREE_ADMIN_EMAIL = 'meshoosha88@gmail.com';

    public function view(User $user, Person $person)
    {
        return $person->family->memberships()->where('user_id', $user->id)->exists();
    }

    public function create(User $user, Family $family)
    {
        return $this->isTreeAdmin($user)
            && $family->memberships()->where('user_id', $user->id)->exists();
    }

    public function update(User $user, Person $person)
    {
        return $this->isTreeAdmin($user) && $this->view($user, $person);
    }

    public function delete(User $user, Person $person)
    {
        return $this->isTreeAdmin($user) && $this->view($user, $person);
    }

    private function isTreeAdmin(User $user): bool
    {
        return strtolower(trim((string) $user->email)) === self::TREE_ADMIN_EMAIL;
    }
}
