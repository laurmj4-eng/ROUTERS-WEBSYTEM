<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('password_rotation_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('router_credential_id')->constrained()->cascadeOnDelete();
            $table->string('action');
            $table->text('details')->nullable();
            $table->string('status')->default('pending');
            $table->timestamps();
            $table->index(['router_credential_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_rotation_logs');
    }
};
