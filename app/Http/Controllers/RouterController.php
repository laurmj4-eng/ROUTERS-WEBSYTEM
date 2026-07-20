<?php

namespace App\Http\Controllers;

use App\Events\RouterActionTriggered;
use App\Models\CredentialScanResult;
use App\Models\RouterCredential;
use App\Models\RouterLog;
use App\Models\RouterStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class RouterController extends Controller
{
    private function safeBroadcast(RouterActionTriggered $event): void
    {
        try {
            broadcast($event);
        } catch (\Throwable $e) {
            Log::warning('Broadcast failed: ' . $e->getMessage());
        }
    }

    public function triggerReboot(): JsonResponse
    {
        $log = RouterLog::create([
            'action_type'  => 'reboot',
            'payload'      => null,
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        $this->safeBroadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'reboot',
        ));

        return response()->json([
            'success' => true,
            'log_id'  => $log->id,
            'message' => 'Reboot command dispatched.',
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        if ($request->has('new_password')) {
            $pw = $request->input('new_password');
            if (is_string($pw) && !preg_match('/[^a-zA-Z0-9]/', $pw)) {
                $pw .= '!';
                $request->merge([
                    'new_password' => $pw,
                    'new_password_confirmation' => $request->has('new_password_confirmation')
                        ? $request->input('new_password_confirmation') . '!'
                        : null,
                ]);
            }
        }

        $validated = $request->validate([
            'new_password' => 'required|string|min:8|max:63|confirmed',
        ]);

        $log = RouterLog::create([
            'action_type'  => 'password_change',
            'payload'      => $validated['new_password'],
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        $this->safeBroadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'password_change',
            parameters: ['new_password' => $validated['new_password']],
        ));

        return response()->json([
            'success'   => true,
            'log_id'    => $log->id,
            'message'   => 'Password change command dispatched.',
            'timestamp' => now()->toISOString(),
        ]);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $log = RouterLog::findOrFail($id);

        $validated = $request->validate([
            'status' => 'required|in:success,failed',
        ]);

        $log->update(['status' => $validated['status']]);

        return response()->json([
            'success'   => true,
            'log_id'    => $log->id,
            'status'    => $log->status,
            'message'   => "Log #{$id} status updated to {$validated['status']}.",
            'timestamp' => now()->toISOString(),
        ]);
    }

    public function triggerScan(): JsonResponse
    {
        $log = RouterLog::create([
            'action_type'  => 'scan',
            'payload'      => null,
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        $this->safeBroadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'scan',
        ));

        return response()->json([
            'success' => true,
            'log_id'  => $log->id,
            'message' => 'Network scan dispatched.',
        ]);
    }

    public function storeScanResults(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'log_id'                 => 'required|exists:router_logs,id',
            'wifi_name_2g'           => 'nullable|string|max:32',
            'wifi_password_2g'       => 'nullable|string|max:63',
            'wifi_name_5g'           => 'nullable|string|max:32',
            'wifi_password_5g'       => 'nullable|string|max:63',
            'connection_status'      => 'nullable|string|max:32',
            'total_connected_devices'=> 'nullable|integer|min:0',
        ]);

        $existing = RouterStatus::first();

        $update = [
            'last_scanned_at' => now(),
        ];

        foreach (['wifi_name_2g', 'wifi_password_2g', 'wifi_name_5g', 'wifi_password_5g', 'connection_status'] as $field) {
            $update[$field] = $validated[$field] ?? ($existing->$field ?? null);
        }

        $update['total_connected_devices'] = $validated['total_connected_devices'] ?? ($existing->total_connected_devices ?? 0);

        RouterStatus::updateOrCreate(['id' => 1], $update);

        RouterLog::where('id', $validated['log_id'])->update(['status' => 'success']);

        return response()->json([
            'success' => true,
            'message' => 'Scan results stored.',
        ]);
    }

    public function getRouterStatus(): JsonResponse
    {
        $status = RouterStatus::first();

        return response()->json([
            'data' => $status ?? [
                'wifi_name_2g'           => null,
                'wifi_password_2g'       => null,
                'wifi_name_5g'           => null,
                'wifi_password_5g'       => null,
                'connection_status'      => 'unknown',
                'total_connected_devices'=> 0,
                'last_scanned_at'        => null,
            ],
        ]);
    }

    public function triggerWifiPasswordScan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'username' => 'required|string|max:64',
            'password' => 'required|string|max:128',
        ]);

        $log = RouterLog::create([
            'action_type'  => 'wifi_password_scan',
            'payload'      => json_encode([
                'username' => $validated['username'],
                'password' => Crypt::encryptString($validated['password']),
            ]),
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        $this->safeBroadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'wifi_password_scan',
            parameters: [
                'username' => $validated['username'],
                'password' => $validated['password'],
            ],
        ));

        return response()->json([
            'success' => true,
            'log_id'  => $log->id,
            'message' => 'WiFi password scan dispatched.',
        ]);
    }

    public function getActiveCredential(): JsonResponse
    {
        $cred = RouterCredential::where('status', 'active')->first();

        if (!$cred) {
            return response()->json([
                'data' => ['username' => 'admin', 'password' => ''],
            ]);
        }

        return response()->json([
            'data' => [
                'username' => $cred->username,
                'password' => $cred->password,
            ],
        ]);
    }

    public function triggerDiagnose(): JsonResponse
    {
        $log = RouterLog::create([
            'action_type'  => 'diagnose_network',
            'payload'      => json_encode(['ssid' => 'TP-Link_2.4GHz_30E5E3', 'url' => 'http://10.0.0.1']),
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        $this->safeBroadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'diagnose_network',
            parameters: ['ssid' => 'TP-Link_2.4GHz_30E5E3', 'url' => 'http://10.0.0.1'],
        ));

        return response()->json([
            'success' => true,
            'log_id'  => $log->id,
            'message' => 'Network diagnostic dispatched.',
        ]);
    }

    public function triggerSessionCheck(): JsonResponse
    {
        $log = RouterLog::create([
            'action_type'  => 'check_session',
            'payload'      => null,
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        $this->safeBroadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'check_session',
        ));

        return response()->json([
            'success' => true,
            'log_id'  => $log->id,
            'message' => 'Session check dispatched.',
        ]);
    }

    public function updateSessionStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|in:active,expired,error',
        ]);

        \Cache::put('router_session_status', [
            'status'    => $validated['status'],
            'checked_at' => now()->toISOString(),
        ], 3600);

        return response()->json(['success' => true]);
    }

    public function getSessionStatus(): JsonResponse
    {
        $cached = \Cache::get('router_session_status', [
            'status'     => 'unknown',
            'checked_at' => null,
        ]);

        return response()->json(['data' => $cached]);
    }

    public function getCredentialScans(): JsonResponse
    {
        $scans = CredentialScanResult::latest()->take(20)->get();
        return response()->json(['data' => $scans]);
    }

    public function getLatestCredentialScan(): JsonResponse
    {
        $scan = CredentialScanResult::latest()->first();
        return response()->json(['data' => $scan]);
    }

    public function triggerCredentialScan(Request $request): JsonResponse
    {
        $reportOnly = $request->boolean('report_only', false);
        $url = $request->input('url');

        $exitCode = Artisan::call('credentials:scan', array_filter([
            '--url' => $url,
            '--report-only' => $reportOnly,
        ]));

        $scanResult = CredentialScanResult::latest()->first();

        return response()->json([
            'success' => true,
            'message' => $exitCode === 2
                ? 'Default credentials found!'
                : 'Credential scan completed — no defaults found.',
            'data' => $scanResult,
        ]);
    }

    public function triggerPasswordDiscovery(Request $request): JsonResponse
    {
        $url = $request->input('url');
        $wordlist = $request->input('wordlist');
        $maxAttempts = $request->input('max_attempts', 500);
        $username = $request->input('username', 'admin');

        $params = array_filter([
            '--url' => $url,
            '--discover' => true,
            '--wordlist' => $wordlist,
            '--max-attempts' => $maxAttempts,
            '--username' => $username,
        ]);

        $exitCode = Artisan::call('credentials:scan', $params);

        $scanResult = CredentialScanResult::latest()->first();

        return response()->json([
            'success' => true,
            'message' => $exitCode === 3
                ? 'Password discovered!'
                : 'Discovery completed — password not found in wordlist.',
            'data' => $scanResult,
        ]);
    }

    public function scanPassword(Request $request): JsonResponse
    {
        set_time_limit(120);

        $validated = $request->validate([
            'username'  => 'required|string|max:64',
            'password'  => 'required|string|max:128',
            'router_ip' => 'nullable|string|max:64',
        ]);

        $routerIp   = $validated['router_ip'] ?? '192.168.1.1';
        $scriptPath = base_path('local-agent/puppeteer/getxml_file.js');
        $downloadPath = sys_get_temp_dir() . '/psk_' . bin2hex(random_bytes(4));

        mkdir($downloadPath, 0777, true);

        $escUser = escapeshellarg($validated['username']);
        $escPass = escapeshellarg($validated['password']);
        $escIp   = escapeshellarg($routerIp);
        $escDl   = escapeshellarg($downloadPath);
        $escScript = escapeshellarg($scriptPath);
        $wordlistPath = base_path('cred-scanner/wordlists/common-router-passwords.txt');
        $escWordlist = escapeshellarg($wordlistPath);

        $cmd = "node $escScript --username $escUser --password $escPass --router-ip $escIp --download-path $escDl --wordlist $escWordlist 2>&1";

        Log::info('ScanPassword: ' . $cmd);
        $start = now();
        $output = shell_exec($cmd);
        $elapsed = now()->diffInSeconds($start);

        try {
            array_map('unlink', glob("$downloadPath/*.*"));
            rmdir($downloadPath);
        } catch (\Throwable $e) {
            Log::warning('Cleanup failed: ' . $e->getMessage());
        }

        $result = $this->parseJsonOutput($output);

        if (!$result || isset($result['error'])) {
            return response()->json([
                'success'    => false,
                'message'    => $result['error'] ?? 'Unknown error during password scan',
                'raw_output' => $output,
                'elapsed'    => $elapsed,
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data'    => $result,
            'elapsed' => $elapsed,
        ]);
    }

    public function scanConfigFile(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'config_file' => 'required|file|mimes:xml,txt|max:5120',
            'wordlist'    => 'nullable|file|mimes:txt|max:512',
        ]);

        $configFile = $validated['config_file'];
        $tmpName = 'hw_ctree_' . bin2hex(random_bytes(4)) . '.xml';
        $tmpPath = $configFile->storeAs('uploads', $tmpName, 'local');

        if (!$tmpPath) {
            return response()->json(['success' => false, 'message' => 'Failed to store uploaded file.'], 500);
        }

        $fullPath = Storage::disk('local')->path($tmpPath);
        $scriptPath = base_path('local-agent/puppeteer/getxml_file.js');
        $wordlistFile = $validated['wordlist'] ?? null;
        $wordlistPath = $wordlistFile
            ? $wordlistFile->getRealPath()
            : base_path('cred-scanner/wordlists/common-router-passwords.txt');

        $escScript = escapeshellarg($scriptPath);
        $escFile   = escapeshellarg($fullPath);
        $escWord   = escapeshellarg($wordlistPath);

        $cmd = "node $escScript --local-file $escFile --wordlist $escWord 2>&1";

        Log::info('ScanConfigFile: ' . $cmd);
        $start = now();
        $output = shell_exec($cmd);
        $elapsed = now()->diffInSeconds($start);

        try {
            Storage::disk('local')->delete($tmpPath);
        } catch (\Throwable $e) {
            Log::warning('Config file cleanup failed: ' . $e->getMessage());
        }

        $result = $this->parseJsonOutput($output);

        if (!$result || isset($result['error'])) {
            return response()->json([
                'success'    => false,
                'message'    => $result['error'] ?? 'Unknown error during config file scan',
                'raw_output' => $output,
                'elapsed'    => $elapsed,
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data'    => $result,
            'elapsed' => $elapsed,
        ]);
    }

    private function parseJsonOutput(?string $output): ?array
    {
        if ($output === null || trim($output) === '') return null;
        $lines = array_reverse(array_filter(explode("\n", $output), fn($l) => trim($l) !== ''));
        foreach ($lines as $line) {
            $decoded = json_decode(trim($line), true);
            if (is_array($decoded)) return $decoded;
        }
        return null;
    }

    public function getDiscoveryStatus(string $id): JsonResponse
    {
        $scan = CredentialScanResult::find($id);

        if (!$scan) {
            return response()->json([
                'success' => false,
                'message' => 'Scan not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $scan,
        ]);
    }
}
