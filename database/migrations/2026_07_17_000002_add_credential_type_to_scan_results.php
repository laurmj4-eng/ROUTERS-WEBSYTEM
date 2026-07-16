<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('credential_scan_results', function (Blueprint $table) {
            $table->string('credential_type')->nullable()->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('credential_scan_results', function (Blueprint $table) {
            $table->dropColumn('credential_type');
        });
    }
};
