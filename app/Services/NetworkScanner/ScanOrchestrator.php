<?php

namespace App\Services\NetworkScanner;

use App\Events\NetworkScanCompleted;
use App\Events\ScanProgressUpdated;
use App\Models\ScanSession;
use Illuminate\Support\Facades\Log;

class ScanOrchestrator
{
    public function __construct(
        private ArpTableScanner $arpScanner,
        private DhcpLogParser $dhcpParser,
        private FirmwareVersionChecker $firmwareChecker,
        private TopologyVerifier $topologyVerifier,
    ) {}

    public function execute(ScanSession $session, array $config): ScanSession
    {
        $phases = $this->determinePhases($config);
        $total = count($phases);

        $session->update([
            'status' => 'running',
            'started_at' => now(),
            'total_tasks' => $total,
            'completed_tasks' => 0,
            'progress' => 0,
        ]);

        try {
            foreach ($phases as $index => $phase) {
                $session->update([
                    'current_phase' => $phase['name'],
                    'completed_tasks' => $index,
                    'progress' => (int) (($index / $total) * 100),
                ]);

                event(new ScanProgressUpdated(
                    sessionId: $session->id,
                    phase: $phase['name'],
                    progress: (int) (($index / $total) * 100),
                    completedTasks: $index,
                    totalTasks: $total,
                ));

                match ($phase['name']) {
                    'arp' => $this->arpScanner->scan($session),
                    'dhcp' => $this->dhcpParser->parse($session),
                    'firmware' => $this->firmwareChecker->check(
                        $session,
                        $config['firmware_version'],
                        $config['vendor'] ?? 'huawei',
                        $config['product'] ?? 'hg8145x6'
                    ),
                    'topology' => $this->topologyVerifier->verify(
                        $session,
                        $config['topology_baseline_id']
                    ),
                };
            }

            $session->update([
                'status' => 'completed',
                'progress' => 100,
                'completed_tasks' => $total,
                'current_phase' => null,
                'completed_at' => now(),
            ]);

            event(new NetworkScanCompleted(
                sessionId: $session->id,
                deviceCount: $session->discoveredDevices()->count(),
                findingsCount: $session->vulnerabilityFindings()->count(),
            ));

        } catch (\Throwable $e) {
            $session->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);

            Log::error('Scan failed', [
                'session_id' => $session->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return $session->fresh();
    }

    private function determinePhases(array $config): array
    {
        $phases = [['name' => 'arp', 'label' => 'ARP Table Scan']];

        if (in_array('dhcp', $config['sources'] ?? ['arp', 'dhcp'])) {
            $phases[] = ['name' => 'dhcp', 'label' => 'DHCP Log Parse'];
        }

        if (! empty($config['firmware_version'])) {
            $phases[] = ['name' => 'firmware', 'label' => 'Firmware CVE Check'];
        }

        if (! empty($config['topology_baseline_id'])) {
            $phases[] = ['name' => 'topology', 'label' => 'Topology Verification'];
        }

        return $phases;
    }
}
