<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Person extends Model
{
    use HasFactory;

    protected $fillable = [
        'family_id',
        'first_name',
        'middle_name',
        'last_name',
        'full_name',
        'gender',
        'father_id',
        'mother_id',
        'father_name_text',
        'mother_name_text',
        'spouse_name',
        'birth_date',
        'death_date',
        'phone',
        'whatsapp_number',
        'email',
        'photo_url',
        'biography',
        'occupation',
        'education',
        'location',
        'generation_number',
        'is_family_head',
        'is_living',
        'privacy_level',
        'created_by',
    ];

    protected $casts = [
        'birth_date' => 'date',
        'death_date' => 'date',
        'is_family_head' => 'boolean',
        'is_living' => 'boolean',
        'generation_number' => 'integer',
    ];

    public function family(): BelongsTo
    {
        return $this->belongsTo(Family::class);
    }

    public function father(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'father_id');
    }

    public function mother(): BelongsTo
    {
        return $this->belongsTo(Person::class, 'mother_id');
    }

    public function childrenAsFather(): HasMany
    {
        return $this->hasMany(Person::class, 'father_id');
    }

    public function childrenAsMother(): HasMany
    {
        return $this->hasMany(Person::class, 'mother_id');
    }

    public function relationships(): HasMany
    {
        return $this->hasMany(PersonRelationship::class);
    }

    public function relatedTo(): HasMany
    {
        return $this->hasMany(PersonRelationship::class, 'related_person_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function spouseRecords()
    {
        $spouseIds = PersonRelationship::query()
            ->where('person_id', $this->id)
            ->where('relationship_type', 'spouse')
            ->pluck('related_person_id')
            ->merge(
                PersonRelationship::query()
                    ->where('related_person_id', $this->id)
                    ->where('relationship_type', 'spouse')
                    ->pluck('person_id')
            );

        return Person::whereIn('id', $spouseIds);
    }
}
