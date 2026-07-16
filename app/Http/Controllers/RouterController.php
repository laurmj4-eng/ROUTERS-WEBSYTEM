<?php

namespace App\Http\Controllers;

use App\Events\RouterActionTriggered;
use App\Models\RouterCredential;
use App\Models\RouterLog;
use App\Models\RouterStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

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
}
