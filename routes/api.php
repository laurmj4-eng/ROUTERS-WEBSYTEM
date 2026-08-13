<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AduController;
use App\Http\Controllers\BruteForceController;
use App\Http\Controllers\LpbController;
use App\Http\Controllers\NetworkScanController;
use App\Http\Controllers\RelayController;
use App\Http\Controllers\RouterController;
use App\Http\Controllers\RouterRotationController;
use App\Http\Controllers\TulogScanController;
use App\Models\RouterLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);

// All other routes require a session (dashboard) or a Sanctum token (local agent)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/router/logs', function (Request $request): JsonResponse {
        $perPage = min((int) $request->input('per_page', 10), 50);
        $page = max((int) $request->input('page', 1), 1);
        $total = RouterLog::count();
        $logs = RouterLog::latest()
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return response()->json([
            'data' => $logs,
            'meta' => [
                'total' => $total,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => (int) ceil($total / $perPage),
            ],
        ]);
    });

    Route::post('/router/reboot', [RouterController::class, 'triggerReboot']);
    Route::post('/router/password', [RouterController::class, 'changePassword']);
    Route::patch('/router/log/{id}/status', [RouterController::class, 'updateStatus']);

    Route::post('/router/scan', [RouterController::class, 'triggerScan']);
    Route::post('/router/scan/results', [RouterController::class, 'storeScanResults']);
    Route::get('/router/status', [RouterController::class, 'getRouterStatus']);
    Route::post('/router/check-connection', [RouterController::class, 'checkRouterConnection']);
    Route::post('/router/wifi-scan', [RouterController::class, 'triggerWifiPasswordScan']);
    Route::get('/router/credential', [RouterController::class, 'getActiveCredential']);
    Route::post('/router/session-status', [RouterController::class, 'updateSessionStatus']);
    Route::get('/router/session-status', [RouterController::class, 'getSessionStatus']);
    Route::post('/router/session-check', [RouterController::class, 'triggerSessionCheck']);
    Route::post('/router/diagnose', [RouterController::class, 'triggerDiagnose']);
    Route::post('/router/scan-password', [RouterController::class, 'scanPassword']);
    Route::post('/router/scan-config-file', [RouterController::class, 'scanConfigFile']);
    Route::post('/router/restore-default', [RouterController::class, 'triggerRestoreDefault']);
    Route::post('/router/test-credential', [RouterController::class, 'testCredential']);
    Route::post('/router/change-admin-password', [RouterController::class, 'changeAdminPassword']);

    // ADU Piso WiFi (AdoPiSoft portal at 10.0.0.1) — direct HTTP API, no agent
    Route::post('/adu/add-time', [AduController::class, 'addTime']);
    Route::post('/adu/convert-voucher', [AduController::class, 'convertVoucher']);
    Route::get('/adu/status', [AduController::class, 'status']);
    Route::get('/adu/admin-credentials', [AduController::class, 'adminCredentials']);

    // ADU Piso WiFi proxy (generic pass-through for anything else)
    Route::any('/adu/{path}', [AduController::class, 'proxy'])->where('path', '.*');

    // LPB Piso WiFi (agent-driven)
    Route::post('/lpb/trigger', [LpbController::class, 'trigger']);
    Route::post('/lpb/report', [LpbController::class, 'report']);
    Route::get('/lpb/state', [LpbController::class, 'getState']);

    // LPB Piso WiFi — live credential scan (must be registered before the {path} proxy)
    Route::get('/lpb/scan-password', [LpbController::class, 'scanAdminPassword']);

    // LPB Piso WiFi — convert current time into a voucher (sconvert)
    Route::post('/lpb/convert-my-time', [LpbController::class, 'convertMyTime']);

    // LPB Piso WiFi — add time directly via the negative-minute sconvert trick (relay tunnel, no agent)
    Route::post('/lpb/add-time', [LpbController::class, 'addTime']);

    // LPB Piso WiFi proxy (fallback)
    Route::any('/lpb/{path}', function (Request $request, string $path) {
        $base = App\Support\Relay::get('lpb');
        $query = $request->getQueryString();
        parse_str($query ?? '', $params);
        $host = $params['__host'] ?? null;
        unset($params['__host']);
        if ($host && ! str_contains($host, '/') && ! str_contains($host, ':')) {
            $base = 'http://'.$host;
        }
        $url = rtrim($base, '/').'/'.$path;
        if ($params) {
            $url .= '?'.http_build_query($params);
        }
        $cookieKey = 'lpb_cookies:'.(($request->user()?->id) ?? 'anon');
        $stored = cache()->get($cookieKey, []);
        $cookieHeader = '';
        foreach ($stored as $name => $value) {
            $cookieHeader .= ($cookieHeader ? '; ' : '').$name.'='.$value;
        }
        $headers = [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type: '.($request->header('Content-Type') ?? 'application/x-www-form-urlencoded'),
        ];
        if ($cookieHeader) {
            $headers[] = 'Cookie: '.$cookieHeader;
        }
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_CUSTOMREQUEST => $request->method(),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_HEADER => true,
            CURLOPT_POSTFIELDS => $request->method() === 'POST' ? $request->getContent() : null,
        ]);
        $raw = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE) ?: 502;
        curl_close($ch);
        if ($raw === false) {
            return response('proxy error', 502);
        }
        $headerSize = strpos($raw, "\r\n\r\n");
        $headerBlock = $headerSize !== false ? substr($raw, 0, $headerSize) : '';
        $body = $headerSize !== false ? substr($raw, $headerSize + 4) : $raw;
        preg_match_all('/^Set-Cookie:\s*([^=;]+)=([^;]*)/mi', $headerBlock, $matches, PREG_SET_ORDER);
        foreach ($matches as $m) {
            $stored[$m[1]] = $m[2];
        }
        if ($stored) {
            cache()->put($cookieKey, $stored, now()->addDay());
        }
        $responseHeaders = [];
        foreach (explode("\r\n", $headerBlock) as $line) {
            if (str_starts_with($line, 'HTTP/')) {
                continue;
            }
            $parts = explode(':', $line, 2);
            if (count($parts) === 2 && ! str_starts_with(strtolower($parts[0]), 'transfer-encoding')) {
                $responseHeaders[$parts[0]] = trim($parts[1]);
            }
        }

        return response($body, $status)->withHeaders($responseHeaders);
    })->where('path', '.*');

    // Tulog Wifi Extender scan (agent-driven, sequential WiFi switch)
    Route::post('/agent/tulog/scan', [TulogScanController::class, 'trigger']);
    Route::post('/agent/tulog/scan-results', [TulogScanController::class, 'storeResults']);
    Route::get('/agent/tulog/history', [TulogScanController::class, 'history']);

    // Password rotation routes
    Route::get('/router/rotation/status', [RouterRotationController::class, 'getRotationStatus']);
    Route::get('/router/rotation/history', [RouterRotationController::class, 'getRotationHistory']);
    Route::post('/router/rotation/trigger', [RouterRotationController::class, 'triggerRotation']);
    Route::post('/router/rotation/rollback/{id}', [RouterRotationController::class, 'rollbackRotation']);
    Route::post('/router/rotation/agent-report', [RouterRotationController::class, 'agentStatusReport']);
    Route::post('/router/rotation/external-change', [RouterRotationController::class, 'externalChangeDetected']);
    Route::post('/router/rotation/reset-detected', [RouterRotationController::class, 'resetDetected']);
    Route::post('/router/rotation/update-credentials', [RouterRotationController::class, 'updateCredentials']);

    // WiFi Password Scanner
    Route::post('/scan/wifi-passwords', [NetworkScanController::class, 'storeWifiPasswords']);
    Route::get('/scan/wifi-passwords', [NetworkScanController::class, 'getWifiPasswords']);

    // Default Credential Scanner
    Route::get('/credential-scans', [RouterController::class, 'getCredentialScans']);
    Route::get('/credential-scans/latest', [RouterController::class, 'getLatestCredentialScan']);
    Route::post('/credential-scan/trigger', [RouterController::class, 'triggerCredentialScan']);

    // Password Discovery
    Route::post('/credential-scan/discover', [RouterController::class, 'triggerPasswordDiscovery']);
    Route::get('/credential-scan/discover/status/{id}', [RouterController::class, 'getDiscoveryStatus']);

    // Network Diagnostic
    Route::post('/scan/diagnose', [NetworkScanController::class, 'storeDiagnoseResult']);
    Route::get('/scan/diagnose', [NetworkScanController::class, 'getDiagnoseResults']);

    // WiFi Brute-Force
    Route::post('/router/bruteforce/start', [BruteForceController::class, 'start']);
    Route::post('/router/bruteforce/progress', [BruteForceController::class, 'progress']);
    Route::post('/router/bruteforce/found', [BruteForceController::class, 'found']);
    Route::post('/router/bruteforce/complete', [BruteForceController::class, 'complete']);
    Route::post('/router/bruteforce/stop', [BruteForceController::class, 'stop']);
    Route::get('/router/bruteforce/status/{id}', [BruteForceController::class, 'status']);

    // Network scanning routes (authenticated + rate-limited)
    Route::prefix('scan')->middleware('throttle:network-scan')->group(function () {
        Route::post('/start', [NetworkScanController::class, 'startScan']);
        Route::get('/results/{id}', [NetworkScanController::class, 'getResults']);
        Route::get('/history', [NetworkScanController::class, 'getHistory']);
        Route::get('/dashboard', [NetworkScanController::class, 'getDashboard']);
        Route::post('/topology/upload', [NetworkScanController::class, 'uploadTopology']);
        Route::get('/topology/baselines', [NetworkScanController::class, 'listBaselines']);

        // Schedule management
        Route::get('/schedules', [NetworkScanController::class, 'listSchedules']);
        Route::post('/schedules', [NetworkScanController::class, 'createSchedule']);
        Route::patch('/schedules/{id}', [NetworkScanController::class, 'updateSchedule']);
        Route::delete('/schedules/{id}', [NetworkScanController::class, 'deleteSchedule']);
    });

    // SSE stream — same-origin cookies satisfy auth:sanctum (no headers needed)
    Route::get('/scan/{id}/stream', [NetworkScanController::class, 'streamProgress']);

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Relay / target URL settings (web dashboard)
    Route::get('/relay/{family}', [RelayController::class, 'get']);
    Route::post('/relay/{family}', [RelayController::class, 'set']);
});
