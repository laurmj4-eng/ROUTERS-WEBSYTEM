<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scan_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('scan_type');
            $table->string('status')->default('pending');
            $table->text('parameters')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('discovered_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
            $table->string('ip_address');
            $table->string('mac_address');
            $table->string('hostname')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('device_type')->nullable();
            $table->string('os_fingerprint')->nullable();
            $table->string('connection_type');
            $table->timestamps();
            $table->index(['scan_session_id', 'ip_address']);
            $table->index(['scan_session_id', 'mac_address']);
        });

        Schema::create('vulnerability_findings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
            $table->string('cve_id');
            $table->string('severity');
            $table->text('description');
            $table->text('affected_component');
            $table->text('remediation')->nullable();
            $table->decimal('cvss_score', 3, 1)->nullable();
            $table->string('source');
            $table->timestamps();
            $table->index(['scan_session_id', 'severity']);
        });

        Schema::create('topology_baselines', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('filename');
            $table->string('file_hash');
            $table->text('expected_devices');
            $table->text('expected_topology')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('topology_deviations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('topology_baseline_id')->constrained()->cascadeOnDelete();
            $table->string('deviation_type');
            $table->text('details');
            $table->string('severity');
            $table->timestamps();
            $table->index(['scan_session_id', 'deviation_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('topology_deviations');
        Schema::dropIfExists('topology_baselines');
        Schema::dropIfExists('vulnerability_findings');
        Schema::dropIfExists('discovered_devices');
        Schema::dropIfExists('scan_sessions');
    }
};
