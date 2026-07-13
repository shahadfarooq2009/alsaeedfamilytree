<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Family extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'founder_person_id',
        'created_by',
    ];

    public function founder(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'founder_person_id');
    }

    public function people(): HasMany
    {
        return $this->hasMany(Person::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(FamilyMembership::class);
    }

    public function relationships(): HasMany
    {
        return $this->hasMany(PersonRelationship::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
