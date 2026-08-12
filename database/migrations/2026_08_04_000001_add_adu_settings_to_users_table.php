<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-user ADU (AdoPiSoft) portal settings so each friend can target
     * their own piso instead of sharing one global env config.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('adu_url')->nullable()->after('password');
            $table->string('adu_customer_user')->nullable()->after('adu_url');
            $table->string('adu_customer_pass')->nullable()->after('adu_customer_user');
            $table->string('adu_tmp_client_id')->nullable()->after('adu_customer_pass');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['adu_url', 'adu_customer_user', 'adu_customer_pass', 'adu_tmp_client_id']);
        });
    }
};
