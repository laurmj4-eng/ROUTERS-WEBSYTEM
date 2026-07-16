<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('scan_sessions', function (Blueprint $table) {
            $table->integer('progress')->default(0);
            $table->integer('total_tasks')->default(0);
            $table->integer('completed_tasks')->default(0);
            $table->string('current_phase')->nullable();
            $table->string('job_id')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('scan_sessions', function (Blueprint $table) {
            $table->dropColumn(['progress', 'total_tasks', 'completed_tasks', 'current_phase', 'job_id']);
        });
    }
};
