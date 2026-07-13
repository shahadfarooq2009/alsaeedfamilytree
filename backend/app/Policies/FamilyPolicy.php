<?php

namespace App\Policies;

use App\Models\Family;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

class FamilyPolicy
{
    use HandlesAuthorization;

    public function create(User $user)
    {
        return true;
    }

    public function view(User $user, Family $family)
    {
        return $family->memberships()->where('user_id', $user->id)->exists();
    }

    public function update(User $user, Family $family)
    {
        return $family->memberships()
            ->where('user_id', $user->id)
            ->whereIn('role', ['owner', 'admin'])
            ->exists();
    }

    public function delete(User $user, Family $family)
    {
        return $this->update($user, $family);
    }
}
