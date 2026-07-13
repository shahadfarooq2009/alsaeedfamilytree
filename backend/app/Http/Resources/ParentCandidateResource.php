<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ParentCandidateResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'gender' => $this->gender,
            'photo_url' => $this->photo_url,
            'birth_date' => $this->birth_date?->format('Y-m-d'),
            'generation_number' => $this->generation_number,
            'father_name' => $this->father?->full_name,
        ];
    }
}
