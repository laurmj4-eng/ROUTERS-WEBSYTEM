<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tulog_scans', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('log_id')->nullable()->index();
            $table->string('original_ssid')->nullable();
            $table->string('target_ssid')->nullable();
            $table->string('status')->default('completed');
            $table->boolean('connected')->default(false);
            $table->string('bssid')->nullable();
            $table->integer('signal')->nullable();
            $table->string('band')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('gateway')->nullable();
            $table->string('gateway_mac')->nullable();
            $table->json('ports_open')->nullable();
            $table->json('http_probes')->nullable();
            $table->json('devices_found')->nullable();
            $table->json('beacon_analysis')->nullable();
            $table->string('restore_status')->nullable();
            $table->text('error')->nullable();
            $table->integer('duration_ms')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tulog_scans');
    }
};
