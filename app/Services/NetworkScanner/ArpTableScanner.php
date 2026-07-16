<?php

namespace App\Services\NetworkScanner;

use App\Models\DiscoveredDevice;
use App\Models\ScanSession;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ArpTableScanner
{
    private array $ouiPrefixes = [
        '00:50:56' => 'VMware',
        '08:00:27' => 'Oracle VirtualBox',
        '00:0c:29' => 'VMware',
        '00:15:5d' => 'Microsoft Hyper-V',
        '52:54:00' => 'QEMU/KVM',
        'b8:27:eb' => 'Raspberry Pi',
        'dc:a6:32' => 'Raspberry Pi',
        'e4:5f:01' => 'Raspberry Pi',
        '28:cd:c1' => 'Raspberry Pi',
        'd8:3a:dd' => 'Raspberry Pi',
        '00:1a:79' => 'Huawei',
        '00:e0:fc' => 'Huawei',
        '48:46:fb' => 'Huawei',
        '88:cf:98' => 'Huawei',
        'ac:4e:91' => 'Huawei',
        'c8:d1:5e' => 'Huawei',
        'ec:f4:bb' => 'Huawei',
        'f8:01:13' => 'Huawei',
        '00:1e:10' => 'D-Link',
        '00:26:5a' => 'D-Link',
        '1c:5f:2b' => 'D-Link',
        '28:10:7b' => 'D-Link',
        '3c:1e:04' => 'D-Link',
        '54:b8:0a' => 'D-Link',
        '78:32:1b' => 'D-Link',
        '84:c9:b2' => 'D-Link',
        '9c:d6:43' => 'D-Link',
        'b8:a3:86' => 'D-Link',
        'c0:a0:bb' => 'D-Link',
        'c8:be:19' => 'D-Link',
        'e0:63:da' => 'D-Link',
        'f0:9f:c2' => 'D-Link',
        '00:14:6c' => 'Netgear',
        '00:18:4d' => 'Netgear',
        '00:1b:2f' => 'Netgear',
        '00:1f:33' => 'Netgear',
        '00:22:3f' => 'Netgear',
        '00:24:b2' => 'Netgear',
        '00:26:f2' => 'Netgear',
        '00:9f:52' => 'Netgear',
        '20:e5:2a' => 'Netgear',
        '28:c6:8e' => 'Netgear',
        '2c:b0:5d' => 'Netgear',
        '30:46:9a' => 'Netgear',
        '44:94:fc' => 'Netgear',
        '4c:60:de' => 'Netgear',
        '6c:b0:ce' => 'Netgear',
        '84:1b:5e' => 'Netgear',
        '8c:3b:ad' => 'Netgear',
        'a0:04:60' => 'Netgear',
        'a0:21:b7' => 'Netgear',
        'a4:2b:8c' => 'Netgear',
        'b0:7f:b9' => 'Netgear',
        'b0:b9:8a' => 'Netgear',
        'c0:3f:0e' => 'Netgear',
        'c4:04:15' => 'Netgear',
        'c4:3d:c7' => 'Netgear',
        'cc:40:d0' => 'Netgear',
        'd0:21:f9' => 'Netgear',
        'e0:46:9a' => 'Netgear',
        'e0:91:f5' => 'Netgear',
        'e4:f4:c6' => 'Netgear',
        'e8:fc:af' => 'Netgear',
        'f0:04:a0' => 'Netgear',
        'f0:9f:e2' => 'Netgear',
        'f4:ec:38' => 'Netgear',
        'f8:73:94' => 'Netgear',
        'fc:fb:fb' => 'Netgear',
    ];

    public function scan(ScanSession $session): array
    {
        $arpEntries = $this->fetchArpTable();
        $devices = [];

        foreach ($arpEntries as $entry) {
            if ($entry['mac'] === '00:00:00:00:00:00' || empty($entry['mac'])) {
                continue;
            }

            $device = DiscoveredDevice::create([
                'scan_session_id' => $session->id,
                'ip_address' => $entry['ip'],
                'mac_address' => strtoupper($entry['mac']),
                'hostname' => $entry['hostname'] ?? null,
                'manufacturer' => $this->lookupOui($entry['mac']),
                'connection_type' => 'arp',
            ]);
            $devices[] = $device;
        }

        return $devices;
    }

    private function fetchArpTable(): array
    {
        if (file_exists('/proc/net/arp')) {
            return $this->parseArpFile('/proc/net/arp');
        }

        if (PHP_OS_FAMILY === 'Windows') {
            return $this->parseWindowsArp();
        }

        return $this->queryAgentForArpTable();
    }

    private function parseArpFile(string $path): array
    {
        $entries = [];
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        if ($lines === false) {
            return $entries;
        }

        // Skip header line
        array_shift($lines);

        foreach ($lines as $line) {
            $parts = preg_split('/\s+/', $line);
            if (count($parts) >= 4 && $parts[2] !== '0x0') {
                $entries[] = [
                    'ip' => $parts[0],
                    'mac' => $parts[3],
                    'hostname' => $this->resolveHostname($parts[0]),
                ];
            }
        }

        return $entries;
    }

    private function parseWindowsArp(): array
    {
        $entries = [];
        $output = shell_exec('arp -a 2>&1');

        if (empty($output)) {
            return $entries;
        }

        $lines = explode("\n", $output);
        foreach ($lines as $line) {
            $line = trim($line);
            // Match lines with IP and MAC addresses
            if (preg_match('/(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})/i', $line, $matches)) {
                $mac = str_replace('-', ':', $matches[2]);
                $entries[] = [
                    'ip' => $matches[1],
                    'mac' => $mac,
                    'hostname' => $this->resolveHostname($matches[1]),
                ];
            }
        }

        return $entries;
    }

    private function queryAgentForArpTable(): array
    {
        try {
            $agentUrl = config('scanning.agent_url');
            if (empty($agentUrl)) {
                Log::warning('No agent URL configured for ARP table');
                return [];
            }

            $response = Http::timeout(5)->get("{$agentUrl}/api/arp-table");

            if ($response->successful()) {
                return $response->json('entries', []);
            }
        } catch (\Exception $e) {
            Log::error('Failed to query agent for ARP table', ['error' => $e->getMessage()]);
        }

        return [];
    }

    private function resolveHostname(string $ip): ?string
    {
        // Skip resolution for common gateway IPs to avoid delays
        $commonGateways = ['192.168.1.1', '192.168.0.1', '10.0.0.1', '172.16.0.1'];
        if (in_array($ip, $commonGateways)) {
            return 'gateway';
        }

        // Use gethostbyaddr with a short timeout
        $current = ini_get('default_socket_timeout');
        ini_set('default_socket_timeout', 1);

        $hostname = @gethostbyaddr($ip);

        ini_set('default_socket_timeout', $current);

        return ($hostname !== $ip) ? $hostname : null;
    }

    public function lookupOui(string $mac): ?string
    {
        $mac = strtolower(substr($mac, 0, 8));
        return $this->ouiPrefixes[$mac] ?? null;
    }
}
