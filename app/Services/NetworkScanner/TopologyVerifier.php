<?php

namespace App\Services\NetworkScanner;

use App\Models\DiscoveredDevice;
use App\Models\ScanSession;
use App\Models\TopologyBaseline;
use App\Models\TopologyDeviation;

class TopologyVerifier
{
    public function verify(ScanSession $session, int $baselineId): array
    {
        $baseline = TopologyBaseline::findOrFail($baselineId);
        $expected = $baseline->expected_devices ?? [];
        $actual = DiscoveredDevice::where('scan_session_id', $session->id)->get();

        $deviations = [];

        // 1. Find unknown devices (in actual, not in expected)
        $expectedMacs = collect($expected)
            ->pluck('mac_address')
            ->map(fn ($mac) => strtolower($mac))
            ->flip();

        $unknownDevices = $actual->filter(
            fn ($device) => !$expectedMacs->has(strtolower($device->mac_address))
        );

        foreach ($unknownDevices as $device) {
            $deviations[] = $this->recordDeviation(
                $session->id,
                $baseline->id,
                'unknown_device',
                'critical',
                [
                    'device' => $device->toArray(),
                    'message' => 'Device not in expected topology',
                ]
            );
        }

        // 2. Find missing devices (in expected, not in actual)
        $actualMacs = $actual
            ->pluck('mac_address')
            ->map(fn ($mac) => strtolower($mac))
            ->flip();

        $missingDevices = collect($expected)->filter(
            fn ($device) => !isset($device['mac_address']) || !$actualMacs->has(strtolower($device['mac_address']))
        );

        foreach ($missingDevices as $device) {
            $deviations[] = $this->recordDeviation(
                $session->id,
                $baseline->id,
                'missing_device',
                'warning',
                [
                    'device' => $device,
                    'message' => 'Expected device not found on network',
                ]
            );
        }

        // 3. Check IP conflicts (same IP, different MAC)
        $ipGroups = $actual->groupBy('ip_address');
        foreach ($ipGroups as $ip => $devices) {
            $uniqueMacs = $devices->pluck('mac_address')->unique();
            if ($uniqueMacs->count() > 1) {
                $deviations[] = $this->recordDeviation(
                    $session->id,
                    $baseline->id,
                    'ip_conflict',
                    'critical',
                    [
                        'ip' => $ip,
                        'devices' => $devices->toArray(),
                        'message' => 'Multiple devices on same IP address',
                    ]
                );
            }
        }

        // 4. Check MAC address changes (same device, different MAC in baseline)
        $expectedByName = collect($expected)->keyBy('name');
        foreach ($actual as $device) {
            $expectedDevice = $expectedByName->firstWhere('name', $device->hostname);
            if ($expectedDevice && strtolower($expectedDevice['mac_address'] ?? '') !== strtolower($device->mac_address)) {
                $deviations[] = $this->recordDeviation(
                    $session->id,
                    $baseline->id,
                    'mac_changed',
                    'warning',
                    [
                        'device' => $device->toArray(),
                        'expected_mac' => $expectedDevice['mac_address'] ?? null,
                        'message' => 'Device MAC address changed from baseline',
                    ]
                );
            }
        }

        // 5. Check for subnet mismatches
        $expectedSubnets = collect($expected)
            ->pluck('ip_address')
            ->map(fn ($ip) => $this->getSubnet($ip))
            ->unique()
            ->filter();

        if ($expectedSubnets->isNotEmpty()) {
            $expectedSubnet = $expectedSubnets->first();
            $wrongSubnetDevices = $actual->filter(
                fn ($device) => $this->getSubnet($device->ip_address) !== $expectedSubnet
            );

            foreach ($wrongSubnetDevices as $device) {
                $deviations[] = $this->recordDeviation(
                    $session->id,
                    $baseline->id,
                    'wrong_subnet',
                    'warning',
                    [
                        'device' => $device->toArray(),
                        'expected_subnet' => $expectedSubnet,
                        'message' => 'Device on different subnet than expected',
                    ]
                );
            }
        }

        return $deviations;
    }

    private function recordDeviation(
        int $sessionId,
        int $baselineId,
        string $type,
        string $severity,
        array $details
    ): TopologyDeviation {
        return TopologyDeviation::create([
            'scan_session_id' => $sessionId,
            'topology_baseline_id' => $baselineId,
            'deviation_type' => $type,
            'details' => $details,
            'severity' => $severity,
        ]);
    }

    private function getSubnet(string $ip): ?string
    {
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            $parts = explode('.', $ip);
            if (count($parts) === 4) {
                // Assume /24 subnet
                return "{$parts[0]}.{$parts[1]}.{$parts[2]}.0/24";
            }
        }
        return null;
    }
}
