<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PersonSummaryResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'family_id' => $this->family_id,
            'full_name' => $this->full_name,
            'gender' => $this->gender,
            'photo_url' => $this->photo_url,
            'birth_date' => $this->birth_date?->format('Y-m-d'),
            'death_date' => $this->death_date?->format('Y-m-d'),
            'generation_number' => $this->generation_number,
            'is_family_head' => $this->is_family_head,
            'is_living' => $this->is_living,
            'spouse_name' => $this->spouse_name,
            'father_name_text' => $this->father_name_text,
            'mother_name_text' => $this->mother_name_text,
            'father' => $this->whenLoaded('father', fn () => [
                'id' => $this->father->id,
                'full_name' => $this->father->full_name,
            ]),
            'mother' => $this->whenLoaded('mother', fn () => [
                'id' => $this->mother->id,
                'full_name' => $this->mother->full_name,
            ]),
        ];
    }
}
