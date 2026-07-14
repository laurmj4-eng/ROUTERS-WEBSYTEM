<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('router_logs', function (Blueprint $table) {
            $table->id();
            $table->string('action_type');
            $table->string('payload')->nullable();
            $table->string('status')->default('pending');
            $table->string('triggered_by');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('router_logs');
    }
};
