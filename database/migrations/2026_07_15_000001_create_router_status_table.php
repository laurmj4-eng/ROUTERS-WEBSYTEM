<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('router_status', function (Blueprint $table) {
            $table->id();
            $table->string('wifi_name_2g')->nullable();
            $table->string('wifi_password_2g')->nullable();
            $table->string('wifi_name_5g')->nullable();
            $table->string('wifi_password_5g')->nullable();
            $table->string('connection_status')->default('unknown');
            $table->unsignedInteger('total_connected_devices')->default(0);
            $table->timestamp('last_scanned_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('router_status');
    }
};
