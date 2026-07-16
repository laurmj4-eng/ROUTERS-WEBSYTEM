<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('wifi_passwords', function (Blueprint $table) {
            $table->id();
            $table->string('ssid');
            $table->text('password')->nullable();
            $table->string('band', 10);
            $table->string('router_ip', 45)->default('192.168.1.1');
            $table->string('encryption')->nullable();
            $table->string('authentication')->nullable();
            $table->timestamp('scanned_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('wifi_passwords');
    }
};
