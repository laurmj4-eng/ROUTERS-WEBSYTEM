<?php

namespace App\Services\NetworkScanner;

use App\Models\DiscoveredDevice;
use App\Models\ScanSession;
use Illuminate\Support\Facades\Log;

class DhcpLogParser
{
    private array $dhcpLeasePaths = [
        '/var/lib/dhcp/dhclient.leases',
        '/var/lib/dhcpd/dhcpd.leases',
        '/var/lib/dhcpv4/dhclient.leases',
        '/etc/dhcp/dhclient.leases',
        '/tmp/dhclient.leases',
    ];

    public function parse(ScanSession $session): array
    {
        $leases = $this->fetchDhcpLeases();
        $devices = [];

        foreach ($leases as $lease) {
            if (empty($lease['mac']) || empty($lease['ip'])) {
                continue;
            }

            $device = DiscoveredDevice::updateOrCreate(
                [
                    'scan_session_id' => $session->id,
                    'mac_address' => strtoupper($lease['mac']),
                ],
                [
                    'ip_address' => $lease['ip'],
                    'hostname' => $lease['hostname'] ?? null,
                    'manufacturer' => $this->lookupOuiFromMac($lease['mac']),
                    'connection_type' => 'dhcp',
                ]
            );
            $devices[] = $device;
        }

        return $devices;
    }

    private function fetchDhcpLeases(): array
    {
        // Try to find DHCP lease files
        foreach ($this->dhcpLeasePaths as $path) {
            if (file_exists($path)) {
                $content = file_get_contents($path);
                if ($content !== false && strlen($content) > 0) {
                    return $this->parseDhclientLeases($content);
                }
            }
        }

        // Try to query router's DHCP table via agent
        return $this->queryAgentForDhcpTable();
    }

    private function parseDhclientLeases(string $content): array
    {
        $leases = [];
        $currentLease = [];

        $lines = explode("\n", $content);
        foreach ($lines as $line) {
            $line = trim($line);

            if (str_starts_with($line, 'lease {')) {
                $currentLease = [];
            } elseif (str_starts_with($line, '}')) {
                if (!empty($currentLease['ip']) && !empty($currentLease['mac'])) {
                    $leases[] = $currentLease;
                }
                $currentLease = [];
            } elseif (preg_match('/fixed-address\s+(\d+\.\d+\.\d+\.\d+);/', $line, $matches)) {
                $currentLease['ip'] = $matches[1];
            } elseif (preg_match('/hardware ethernet\s+([0-9a-f:]+);/i', $line, $matches)) {
                $currentLease['mac'] = $matches[1];
            } elseif (preg_match('/option host-name\s+"([^"]+)";/', $line, $matches)) {
                $currentLease['hostname'] = $matches[1];
            }
        }

        return $leases;
    }

    private function queryAgentForDhcpTable(): array
    {
        try {
            $agentUrl = config('scanning.agent_url');
            if (empty($agentUrl)) {
                Log::info('No agent URL configured for DHCP table');
                return [];
            }

            $response = \Illuminate\Support\Facades\Http::timeout(5)
                ->get("{$agentUrl}/api/dhcp-table");

            if ($response->successful()) {
                return $response->json('leases', []);
            }
        } catch (\Exception $e) {
            Log::error('Failed to query agent for DHCP table', ['error' => $e->getMessage()]);
        }

        return [];
    }

    private function lookupOuiFromMac(string $mac): ?string
    {
        // Reuse ARP scanner's OUI lookup
        $scanner = new ArpTableScanner();
        return $scanner->lookupOui($mac);
    }
}
