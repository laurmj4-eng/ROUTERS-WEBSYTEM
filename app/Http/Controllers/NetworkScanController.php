<?php

namespace App\Http\Controllers;

use App\Http\Requests\StartScanRequest;
use App\Http\Requests\UploadTopologyRequest;
use App\Jobs\ScanJob;
use App\Models\ScanSession;
use App\Models\TopologyBaseline;
use App\Models\WifiPassword;
use App\Models\NetworkDiagnostic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class NetworkScanController extends Controller
{
    public function startScan(StartScanRequest $request): JsonResponse
    {
        $session = ScanSession::create([
            'user_id' => $request->user()?->id,
            'scan_type' => $request->input('scan_type', 'passive'),
            'status' => 'pending',
            'parameters' => $request->validated(),
        ]);

        ScanJob::dispatch($session, $request->validated());

        return response()->json([
            'success' => true,
            'session_id' => $session->id,
            'message' => 'Scan queued.',
        ], 202);
    }

    public function streamProgress(int $id): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $session = ScanSession::findOrFail($id);

        return response()->stream(function () use ($session) {
            $this->sendSseEvent('connected', [
                'session_id' => $session->id,
                'status' => $session->status,
                'progress' => $session->progress,
            ]);

            $lastProgress = $session->progress;
            $startTime = time();

            while (time() - $startTime < 300) {
                $session->refresh();

                if ($session->progress !== $lastProgress || in_array($session->status, ['completed', 'failed'])) {
                    $this->sendSseEvent('progress', [
                        'session_id' => $session->id,
                        'status' => $session->status,
                        'progress' => $session->progress,
                        'current_phase' => $session->current_phase,
                        'completed_tasks' => $session->completed_tasks,
                        'total_tasks' => $session->total_tasks,
                    ]);

                    $lastProgress = $session->progress;

                    if (in_array($session->status, ['completed', 'failed'])) {
                        break;
                    }
                }

                usleep(500000);
            }

            $this->sendSseEvent('done', ['status' => $session->status]);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function sendSseEvent(string $event, array $data): void
    {
        echo "event: {$event}\n";
        echo "data: " . json_encode($data) . "\n\n";
        if (ob_get_level()) {
            ob_flush();
        }
        flush();
    }

    public function getResults(int $id): JsonResponse
    {
        $session = ScanSession::with([
            'discoveredDevices',
            'vulnerabilityFindings',
            'topologyDeviations.topologyBaseline',
        ])->findOrFail($id);

        return response()->json(['data' => $session]);
    }

    public function getHistory(Request $request): JsonResponse
    {
        $sessions = ScanSession::withCount([
            'discoveredDevices',
            'vulnerabilityFindings',
            'topologyDeviations',
        ])
            ->latest()
            ->take(20)
            ->get();

        return response()->json(['data' => $sessions]);
    }

    public function uploadTopology(UploadTopologyRequest $request): JsonResponse
    {
        $file = $request->file('topology_file');
        $content = file_get_contents($file->getRealPath());
        $hash = hash('sha256', $content);

        $extension = strtolower($file->getClientOriginalExtension());
        $devices = match ($extension) {
            'json' => json_decode($content, true),
            'csv' => $this->parseCsv($content),
            default => throw new \InvalidArgumentException('Unsupported file type. Use JSON or CSV.'),
        };

        if (!is_array($devices)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid topology file format.',
            ], 422);
        }

        // Normalize device format
        if (isset($devices['devices'])) {
            $devices = $devices['devices'];
        }

        $baseline = TopologyBaseline::create([
            'name' => $request->input('name'),
            'filename' => $file->getClientOriginalName(),
            'file_hash' => $hash,
            'expected_devices' => $devices,
            'user_id' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'baseline' => $baseline,
            'message' => 'Topology baseline uploaded.',
        ]);
    }

    public function listBaselines(): JsonResponse
    {
        $baselines = TopologyBaseline::latest()->get();
        return response()->json(['data' => $baselines]);
    }

    public function getDashboard(): JsonResponse
    {
        $latestSession = ScanSession::with([
            'discoveredDevices',
            'vulnerabilityFindings',
            'topologyDeviations',
        ])->latest()->first();

        $totalScans = ScanSession::count();
        $successfulScans = ScanSession::where('status', 'completed')->count();

        return response()->json([
            'data' => [
                'latest_scan' => $latestSession,
                'summary' => [
                    'total_devices' => $latestSession?->discoveredDevices->count() ?? 0,
                    'critical_findings' => $latestSession?->vulnerabilityFindings
                        ->where('severity', 'critical')->count() ?? 0,
                    'high_findings' => $latestSession?->vulnerabilityFindings
                        ->where('severity', 'high')->count() ?? 0,
                    'unknown_devices' => $latestSession?->topologyDeviations
                        ->where('deviation_type', 'unknown_device')->count() ?? 0,
                    'missing_devices' => $latestSession?->topologyDeviations
                        ->where('deviation_type', 'missing_device')->count() ?? 0,
                ],
                'stats' => [
                    'total_scans' => $totalScans,
                    'successful_scans' => $successfulScans,
                ],
                'rate_limit' => [
                    'max' => config('scanning.rate_limit.max', 10),
                    'remaining' => $this->getRemainingScans(),
                    'resets_at' => now()->addSeconds(config('scanning.rate_limit.decay', 3600) * 60),
                ],
            ],
        ]);
    }

    private function getRemainingScans(): int
    {
        $key = 'scan:' . (auth()->id() ?? request()->ip());
        $max = config('scanning.rate_limit.max', 10);
        $attempts = RateLimiter::attempts($key);
        return max(0, $max - $attempts);
    }

    public function storeWifiPasswords(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'passwords' => 'required|array|min:1',
            'passwords.*.ssid' => 'nullable|string|max:32',
            'passwords.*.password' => 'nullable|string|max:63',
            'passwords.*.band' => 'required|string|in:2.4G,5G',
            'passwords.*.encryption' => 'nullable|string|max:32',
            'passwords.*.authentication' => 'nullable|string|max:32',
        ]);

        $scannedAt = now();
        $routerIp = config('services.router.ip', '192.168.1.1');

        foreach ($validated['passwords'] as $entry) {
            WifiPassword::create([
                'ssid' => $entry['ssid'] ?? null,
                'password' => $entry['password'] ?? null,
                'band' => $entry['band'],
                'router_ip' => $routerIp,
                'encryption' => $entry['encryption'] ?? null,
                'authentication' => $entry['authentication'] ?? null,
                'scanned_at' => $scannedAt,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'WiFi passwords stored.',
            'count' => count($validated['passwords']),
        ]);
    }

    public function getWifiPasswords(): JsonResponse
    {
        $passwords = WifiPassword::orderByDesc('scanned_at')
            ->take(50)
            ->get();

        return response()->json(['data' => $passwords]);
    }

    public function storeDiagnoseResult(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'log_id' => 'nullable|integer',
            'result' => 'required|array',
            'result.original_ssid' => 'nullable|string|max:64',
            'result.target_ssid' => 'nullable|string|max:64',
            'result.target_url' => 'nullable|string|max:255',
            'result.wifi_connected' => 'required|boolean',
            'result.ip_address' => 'nullable|string|max:45',
            'result.url_reachable' => 'required|boolean',
            'result.page_title' => 'nullable|string|max:255',
            'result.page_content_snippet' => 'nullable|string',
            'result.error' => 'nullable|string',
        ]);

        $diag = NetworkDiagnostic::create([
            'original_ssid' => $validated['result']['original_ssid'] ?? null,
            'target_ssid' => $validated['result']['target_ssid'] ?? null,
            'target_url' => $validated['result']['target_url'] ?? null,
            'wifi_connected' => $validated['result']['wifi_connected'] ?? false,
            'ip_address' => $validated['result']['ip_address'] ?? null,
            'url_reachable' => $validated['result']['url_reachable'] ?? false,
            'page_title' => $validated['result']['page_title'] ?? null,
            'page_content_snippet' => $validated['result']['page_content_snippet'] ?? null,
            'error' => $validated['result']['error'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Diagnostic result stored.',
            'id' => $diag->id,
        ]);
    }

    public function getDiagnoseResults(): JsonResponse
    {
        $results = NetworkDiagnostic::orderByDesc('created_at')
            ->take(20)
            ->get();

        return response()->json(['data' => $results]);
    }

    private function parseCsv(string $content): array
    {
        $lines = explode("\n", $content);
        $lines = array_filter($lines, fn ($line) => trim($line) !== '');

        if (empty($lines)) {
            return [];
        }

        $headers = str_getcsv(array_shift($lines));
        $devices = [];

        foreach ($lines as $line) {
            $values = str_getcsv($line);
            if (count($values) === count($headers)) {
                $devices[] = array_combine($headers, $values);
            }
        }

        return $devices;
    }

    public function listSchedules(Request $request): JsonResponse
    {
        $schedules = \App\Models\ScheduledScan::query()
            ->latest()
            ->get();

        return response()->json(['data' => $schedules]);
    }

    public function createSchedule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:64',
            'frequency' => 'required|in:hourly,daily,weekly,monthly',
            'scan_config' => 'required|array',
            'scan_config.scan_type' => 'sometimes|string|in:passive,firmware,topology,full',
            'scan_config.sources' => 'sometimes|array',
            'scan_config.firmware_version' => 'nullable|string',
            'scan_config.vendor' => 'nullable|string',
            'scan_config.product' => 'nullable|string',
            'scan_config.topology_baseline_id' => 'nullable|exists:topology_baselines,id',
        ]);

        $schedule = \App\Models\ScheduledScan::create([
            'user_id' => $request->user()?->id,
            'name' => $validated['name'],
            'frequency' => $validated['frequency'],
            'scan_config' => $validated['scan_config'],
            'is_active' => true,
            'next_run_at' => $this->calculateNextRun($validated['frequency']),
        ]);

        return response()->json([
            'success' => true,
            'schedule' => $schedule,
        ], 201);
    }

    public function updateSchedule(Request $request, int $id): JsonResponse
    {
        $schedule = \App\Models\ScheduledScan::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:64',
            'frequency' => 'sometimes|in:hourly,daily,weekly,monthly',
            'scan_config' => 'sometimes|array',
            'is_active' => 'sometimes|boolean',
        ]);

        $schedule->update($validated);

        if (isset($validated['frequency'])) {
            $schedule->update(['next_run_at' => $this->calculateNextRun($validated['frequency'])]);
        }

        return response()->json(['success' => true, 'schedule' => $schedule]);
    }

    public function deleteSchedule(int $id): JsonResponse
    {
        \App\Models\ScheduledScan::findOrFail($id)->delete();

        return response()->json(['message' => 'Schedule deleted.']);
    }

    private function calculateNextRun(string $frequency): \Illuminate\Support\Carbon
    {
        return match ($frequency) {
            'hourly' => now()->addHour(),
            'daily' => now()->addDay(),
            'weekly' => now()->addWeek(),
            'monthly' => now()->addMonth(),
            default => now()->addDay(),
        };
    }
}
