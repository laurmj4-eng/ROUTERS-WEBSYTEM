<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('credential_scan_results', function (Blueprint $table) {
            $table->id();
            $table->string('target_ip', 45)->default('192.168.1.1');
            $table->string('router_model')->nullable();
            $table->string('vendor')->nullable();
            $table->boolean('found_default')->default(false);
            $table->string('username')->nullable();
            $table->string('password')->nullable();
            $table->string('credential_type')->nullable(); // 'known' or 'default'
            $table->integer('credentials_tested')->default(0);
            $table->text('candidates')->nullable();
            $table->string('status')->default('completed');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credential_scan_results');
    }
};
