<?php

namespace App\Http\Requests;

use App\Models\Family;
use App\Models\Person;
use App\Services\RelationshipValidationService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

abstract class PersonRequest extends FormRequest
{
    protected function family(): Family
    {
        return $this->route('family');
    }

    protected function personRules(bool $isUpdate = false): array
    {
        return [
            'first_name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'full_name' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female,other'],
            'father_id' => ['nullable', 'integer', 'exists:people,id'],
            'mother_id' => ['nullable', 'integer', 'exists:people,id'],
            'father_name_text' => ['nullable', 'string', 'max:255'],
            'mother_name_text' => ['nullable', 'string', 'max:255'],
            'tree_parent_id' => ['nullable', 'integer', 'exists:people,id'],
            'display_parent_id' => ['nullable', 'integer', 'exists:people,id'],
            'branch_root_id' => ['nullable', 'integer', 'exists:people,id'],
            'spouse_name' => ['nullable', 'string', 'max:255'],
            'birth_date' => ['nullable', 'date'],
            'death_date' => ['nullable', 'date', 'after_or_equal:birth_date'],
            'phone' => ['nullable', 'string', 'max:30'],
            'whatsapp_number' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'photo_url' => ['nullable', 'string', 'max:500'],
            'biography' => ['nullable', 'string'],
            'occupation' => ['nullable', 'string', 'max:255'],
            'education' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'is_family_head' => ['sometimes', 'boolean'],
            'is_living' => ['sometimes', 'boolean'],
            'privacy_level' => ['sometimes', 'in:public,family,private'],
        ];
    }

    protected function validateRelationships(Validator $validator): void
    {
        $family = $this->family();
        $fatherId = $this->input('father_id');
        $motherId = $this->input('mother_id');
        $personId = $this->route('person')?->id;

        /** @var RelationshipValidationService $relationshipService */
        $relationshipService = app(RelationshipValidationService::class);

        if ($personId && $relationshipService->isSelfParent($personId, $fatherId, $motherId)) {
            $validator->errors()->add('father_id', 'A person cannot be their own parent.');
            $validator->errors()->add('mother_id', 'A person cannot be their own parent.');
        }

        if (!$relationshipService->parentsBelongToFamily($family->id, $fatherId, $motherId)) {
            $validator->errors()->add('father_id', 'Selected parents must belong to the same family.');
            $validator->errors()->add('mother_id', 'Selected parents must belong to the same family.');
        }

        if ($fatherId) {
            $father = Person::query()->find($fatherId);
            if ($father && $father->gender !== 'male') {
                $validator->errors()->add('father_id', 'The father must be a male family member.');
            }
        }

        if ($motherId) {
            $mother = Person::query()->find($motherId);
            if ($mother && $mother->gender !== 'female') {
                $validator->errors()->add('mother_id', 'The mother must be a female family member.');
            }
        }

        if ($personId && $relationshipService->wouldCreateCycle($personId, $fatherId, $motherId)) {
            $validator->errors()->add('father_id', 'This relationship would create a circular ancestry.');
            $validator->errors()->add('mother_id', 'This relationship would create a circular ancestry.');
        }
    }
}
