<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ParentCandidateRequest extends FormRequest
{
    public function authorize()
    {
        return $this->user()->can('view', $this->route('family'));
    }

    public function rules()
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female,other'],
            'exclude_person_id' => ['nullable', 'integer', 'exists:people,id'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
