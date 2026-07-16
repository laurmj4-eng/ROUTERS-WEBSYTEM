<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('router_credentials', function (Blueprint $table) {
            $table->id();
            $table->string('username')->default('admin');
            $table->text('encrypted_password');
            $table->text('encrypted_previous_password')->nullable();
            $table->string('router_ip')->default('192.168.1.1');
            $table->string('status')->default('active');
            $table->text('last_rotation_result')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('last_rotated_at')->nullable();
            $table->unsignedInteger('rotation_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('router_credentials');
    }
};
