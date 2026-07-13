<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FamilyMembership extends Model
{
    use HasFactory;

    protected $fillable = [
        'family_id',
        'user_id',
        'role',
    ];

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function canEdit(): bool
    {
        return in_array($this->role, ['owner', 'admin', 'editor'], true);
    }

    public function canView(): bool
    {
        return in_array($this->role, ['owner', 'admin', 'editor', 'viewer'], true);
    }
}
