<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\NetworkScanController;
use App\Http\Controllers\RouterController;
use App\Http\Controllers\RouterRotationController;
use App\Models\RouterLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/auth/login', [AuthController::class, 'login']);

Route::get('/router/logs', function (\Illuminate\Http\Request $request): JsonResponse {
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
Route::post('/router/wifi-scan', [RouterController::class, 'triggerWifiPasswordScan']);
Route::get('/router/credential', [RouterController::class, 'getActiveCredential']);
Route::post('/router/diagnose', [RouterController::class, 'triggerDiagnose']);

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

// Network Diagnostic
Route::post('/scan/diagnose', [NetworkScanController::class, 'storeDiagnoseResult']);
Route::get('/scan/diagnose', [NetworkScanController::class, 'getDiagnoseResults']);

// Network scanning routes (authenticated + rate-limited)
Route::prefix('scan')->middleware(['auth:sanctum', 'throttle:network-scan'])->group(function () {
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

// SSE stream — no auth (EventSource doesn't support headers)
Route::get('/scan/{id}/stream', [NetworkScanController::class, 'streamProgress']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
});
