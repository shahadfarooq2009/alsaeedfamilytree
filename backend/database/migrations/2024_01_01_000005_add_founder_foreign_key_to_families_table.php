<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddFounderForeignKeyToFamiliesTable extends Migration
{
    public function up()
    {
        Schema::table('families', function (Blueprint $table) {
            $table->foreign('founder_person_id')
                ->references('id')
                ->on('people')
                ->nullOnDelete();
        });
    }

    public function down()
    {
        Schema::table('families', function (Blueprint $table) {
            $table->dropForeign(['founder_person_id']);
        });
    }
}
