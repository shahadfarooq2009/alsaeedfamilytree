<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePeopleTable extends Migration
{
    public function up()
    {
        Schema::create('people', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('full_name');
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->unsignedBigInteger('father_id')->nullable();
            $table->unsignedBigInteger('mother_id')->nullable();
            $table->date('birth_date')->nullable();
            $table->date('death_date')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('whatsapp_number', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('photo_url')->nullable();
            $table->text('biography')->nullable();
            $table->string('occupation')->nullable();
            $table->string('education')->nullable();
            $table->string('location')->nullable();
            $table->unsignedSmallInteger('generation_number')->default(0);
            $table->boolean('is_family_head')->default(false);
            $table->boolean('is_living')->default(true);
            $table->enum('privacy_level', ['public', 'family', 'private'])->default('family');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->foreign('father_id')->references('id')->on('people')->nullOnDelete();
            $table->foreign('mother_id')->references('id')->on('people')->nullOnDelete();

            $table->index(['family_id', 'generation_number']);
            $table->index(['family_id', 'full_name']);
            $table->index(['family_id', 'father_id']);
            $table->index(['family_id', 'mother_id']);
            $table->index('full_name');
        });
    }

    public function down()
    {
        Schema::dropIfExists('people');
    }
}
