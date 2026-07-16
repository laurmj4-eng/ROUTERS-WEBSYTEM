<?php

namespace Tests\Unit\Services;

use App\Models\DiscoveredDevice;
use App\Models\ScanSession;
use App\Models\TopologyBaseline;
use App\Models\TopologyDeviation;
use App\Services\NetworkScanner\TopologyVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TopologyVerifierTest extends TestCase
{
    use RefreshDatabase;

    private TopologyVerifier $verifier;

    protected function setUp(): void
    {
        parent::setUp();
        $this->verifier = new TopologyVerifier();
    }

    public function test_verify_flags_unknown_devices(): void
    {
        $session = ScanSession::factory()->create();
        $baseline = TopologyBaseline::factory()->create([
            'expected_devices' => [
                ['name' => 'Router', 'mac_address' => 'AA:BB:CC:DD:EE:FF', 'ip_address' => '192.168.1.1'],
            ],
        ]);

        // Create a device not in baseline
        DiscoveredDevice::factory()->create([
            'scan_session_id' => $session->id,
            'mac_address' => '11:22:33:44:55:66',
            'ip_address' => '192.168.1.100',
        ]);

        $deviations = $this->verifier->verify($session, $baseline->id);
        $deviationsCollection = collect($deviations);

        // Should have unknown_device (11:22:33:44:55:66 not in baseline)
        // and missing_device (AA:BB:CC:DD:EE:FF in baseline but not in actual)
        $unknownDevices = $deviationsCollection->where('deviation_type', 'unknown_device');
        $this->assertCount(1, $unknownDevices);
        $this->assertEquals('critical', $unknownDevices->first()->severity);
    }

    public function test_verify_flags_missing_devices(): void
    {
        $session = ScanSession::factory()->create();
        $baseline = TopologyBaseline::factory()->create([
            'expected_devices' => [
                ['name' => 'Router', 'mac_address' => 'AA:BB:CC:DD:EE:FF', 'ip_address' => '192.168.1.1'],
                ['name' => 'Laptop', 'mac_address' => '11:22:33:44:55:66', 'ip_address' => '192.168.1.100'],
            ],
        ]);

        // Only add router, not laptop
        DiscoveredDevice::factory()->create([
            'scan_session_id' => $session->id,
            'mac_address' => 'AA:BB:CC:DD:EE:FF',
            'ip_address' => '192.168.1.1',
        ]);

        $deviations = $this->verifier->verify($session, $baseline->id);

        $this->assertCount(1, $deviations);
        $this->assertEquals('missing_device', $deviations[0]->deviation_type);
        $this->assertEquals('warning', $deviations[0]->severity);
    }

    public function test_verify_flags_ip_conflicts(): void
    {
        $session = ScanSession::factory()->create();
        $baseline = TopologyBaseline::factory()->create([
            'expected_devices' => [],
        ]);

        // Create two devices with same IP but different MACs
        DiscoveredDevice::factory()->create([
            'scan_session_id' => $session->id,
            'mac_address' => 'AA:BB:CC:DD:EE:FF',
            'ip_address' => '192.168.1.100',
        ]);

        DiscoveredDevice::factory()->create([
            'scan_session_id' => $session->id,
            'mac_address' => '11:22:33:44:55:66',
            'ip_address' => '192.168.1.100',
        ]);

        $deviations = $this->verifier->verify($session, $baseline->id);
        $deviationsCollection = collect($deviations);

        $ipConflicts = $deviationsCollection->where('deviation_type', 'ip_conflict');
        $this->assertCount(1, $ipConflicts);
        $this->assertEquals('critical', $ipConflicts->first()->severity);
    }

    public function test_verify_passes_when_all_devices_match(): void
    {
        $session = ScanSession::factory()->create();
        $baseline = TopologyBaseline::factory()->create([
            'expected_devices' => [
                ['name' => 'Router', 'mac_address' => 'AA:BB:CC:DD:EE:FF', 'ip_address' => '192.168.1.1'],
            ],
        ]);

        DiscoveredDevice::factory()->create([
            'scan_session_id' => $session->id,
            'mac_address' => 'AA:BB:CC:DD:EE:FF',
            'ip_address' => '192.168.1.1',
        ]);

        $deviations = $this->verifier->verify($session, $baseline->id);

        $this->assertCount(0, $deviations);
    }
}
