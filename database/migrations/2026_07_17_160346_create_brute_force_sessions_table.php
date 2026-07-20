<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brute_force_sessions', function (Blueprint $table) {
            $table->id();
            $table->string('ssid');
            $table->enum('status', ['pending', 'running', 'completed', 'failed', 'aborted'])->default('pending');
            $table->integer('total')->default(0);
            $table->integer('current_index')->default(0);
            $table->string('current_password')->nullable();
            $table->string('last_state')->nullable();
            $table->float('speed_per_min')->default(0);
            $table->integer('eta_minutes')->default(0);
            $table->float('percent')->default(0);
            $table->integer('elapsed_seconds')->default(0);
            $table->string('found_password')->nullable();
            $table->string('found_ip')->nullable();
            $table->string('wordlist_name')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('brute_force_sessions');
    }
};
