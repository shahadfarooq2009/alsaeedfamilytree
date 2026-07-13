<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateFamilyMembershipsTable extends Migration
{
    public function up()
    {
        Schema::create('family_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('family_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->enum('role', ['owner', 'admin', 'editor', 'viewer'])->default('viewer');
            $table->timestamps();

            $table->unique(['family_id', 'user_id']);
            $table->index(['user_id', 'role']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('family_memberships');
    }
}
