<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('people', function (Blueprint $table) {
            $table->string('father_name_text')->nullable()->after('mother_id');
            $table->string('mother_name_text')->nullable()->after('father_name_text');
        });
    }

    public function down(): void
    {
        Schema::table('people', function (Blueprint $table) {
            $table->dropColumn(['father_name_text', 'mother_name_text']);
        });
    }
};
