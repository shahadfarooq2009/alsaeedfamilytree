<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePersonRelationshipsTable extends Migration
{
    public function up()
    {
        Schema::create('person_relationships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('person_id')->constrained('people')->cascadeOnDelete();
            $table->foreignId('related_person_id')->constrained('people')->cascadeOnDelete();
            $table->enum('relationship_type', ['spouse', 'sibling', 'guardian', 'other']);
            $table->timestamps();

            $table->unique(
                ['person_id', 'related_person_id', 'relationship_type'],
                'person_relationships_unique'
            );
            $table->index(['family_id', 'relationship_type']);
            $table->index(['person_id', 'relationship_type']);
            $table->index(['related_person_id', 'relationship_type']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('person_relationships');
    }
}
