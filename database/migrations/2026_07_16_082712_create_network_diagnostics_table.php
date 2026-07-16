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
        Schema::create('network_diagnostics', function (Blueprint $table) {
            $table->id();
            $table->string('original_ssid')->nullable();
            $table->string('target_ssid')->nullable();
            $table->string('target_url')->nullable();
            $table->boolean('wifi_connected')->default(false);
            $table->string('ip_address')->nullable();
            $table->boolean('url_reachable')->default(false);
            $table->string('page_title')->nullable();
            $table->text('page_content_snippet')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('network_diagnostics');
    }
};
