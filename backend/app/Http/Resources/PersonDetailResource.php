<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PersonDetailResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'family_id' => $this->family_id,
            'first_name' => $this->first_name,
            'middle_name' => $this->middle_name,
            'last_name' => $this->last_name,
            'full_name' => $this->full_name,
            'gender' => $this->gender,
            'father_id' => $this->father_id,
            'mother_id' => $this->mother_id,
            'spouse_name' => $this->spouse_name,
            'father_name_text' => $this->father_name_text,
            'mother_name_text' => $this->mother_name_text,
            'birth_date' => $this->birth_date?->format('Y-m-d'),
            'death_date' => $this->death_date?->format('Y-m-d'),
            'phone' => $this->phone,
            'whatsapp_number' => $this->whatsapp_number,
            'email' => $this->email,
            'photo_url' => $this->photo_url,
            'biography' => $this->biography,
            'occupation' => $this->occupation,
            'education' => $this->education,
            'location' => $this->location,
            'generation_number' => $this->generation_number,
            'is_family_head' => $this->is_family_head,
            'is_living' => $this->is_living,
            'privacy_level' => $this->privacy_level,
            'father' => $this->whenLoaded('father', fn () => new PersonSummaryResource($this->father)),
            'mother' => $this->whenLoaded('mother', fn () => new PersonSummaryResource($this->mother)),
            'children' => PersonSummaryResource::collection($this->when(isset($this->children_list), $this->children_list ?? collect())),
            'spouses' => PersonSummaryResource::collection($this->when(isset($this->spouses_list), $this->spouses_list ?? collect())),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
