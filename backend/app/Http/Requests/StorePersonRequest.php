<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePersonRequest extends PersonRequest
{
    public function authorize()
    {
        return $this->user()->can('create', [\App\Models\Person::class, $this->route('family')]);
    }

    public function rules()
    {
        return $this->personRules();
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $this->validateRelationships($validator);
        });
    }
}
