<?php

namespace App\Http\Requests;

class UpdatePersonRequest extends PersonRequest
{
    public function authorize()
    {
        return $this->user()->can('update', $this->route('person'));
    }

    public function rules()
    {
        return $this->personRules(true);
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $this->validateRelationships($validator);
        });
    }
}
