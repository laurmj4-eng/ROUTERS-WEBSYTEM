<?php

namespace App\Http\Controllers;

use App\Jobs\AgentRotationStatusJob;
use App\Jobs\PasswordRotationJob;
use App\Models\RotationLog;
use App\Models\RouterCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RouterRotationController extends Controller
{
    public function getRotationStatus(): JsonResponse
    {
        $credential = RouterCredential::active()->first();

        if (! $credential) {
            return response()->json([
                'status' => 'not_configured',
                'message' => 'No router credentials configured',
            ]);
        }

        return response()->json([
            'credential_id' => $credential->id,
            'status' => $credential->status,
            'rotation_count' => $credential->rotation_count,
            'last_rotated_at' => $credential->last_rotated_at?->toISOString(),
            'scheduled_at' => $credential->scheduled_at?->toISOString(),
            'last_result' => $credential->last_rotation_result,
        ]);
    }

    public function getRotationHistory(Request $request): JsonResponse
    {
        $logs = RotationLog::with('credential')
            ->orderByDesc('created_at')
            ->take($request->get('per_page', 20))
            ->get();

        return response()->json(['data' => $logs]);
    }

    public function triggerRotation(): JsonResponse
    {
        $credential = RouterCredential::active()->first();

        if (! $credential) {
            return response()->json(['error' => 'No active credentials'], 404);
        }

        if ($credential->status === 'pending') {
            return response()->json(['error' => 'Rotation already in progress'], 409);
        }

        dispatch(new PasswordRotationJob($credential->id, force: true));

        return response()->json([
            'message' => 'Password rotation initiated',
            'credential_id' => $credential->id,
        ]);
    }

    public function rollbackRotation(int $id): JsonResponse
    {
        $credential = RouterCredential::findOrFail($id);

        if (! $credential->previous_password) {
            return response()->json(['error' => 'No previous password available'], 400);
        }

        $credential->rollback();

        return response()->json([
            'message' => 'Rolled back to previous password',
            'credential_id' => $credential->id,
        ]);
    }

    public function agentStatusReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'credential_id' => 'required|exists:router_credentials,id',
            'action' => 'required|string',
            'details' => 'nullable|array',
        ]);

        dispatch(new AgentRotationStatusJob(
            credentialId: $validated['credential_id'],
            action: $validated['action'],
            details: $validated['details'] ?? [],
        ));

        return response()->json(['status' => 'received']);
    }

    /**
     * Called by the agent when health check detects login failure.
     * Marks credential as externally changed, broadcasts alert to dashboard.
     */
    public function externalChangeDetected(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'router_ip' => 'required|string',
            'error' => 'required|string',
            'detected_at' => 'required|string',
        ]);

        $credential = RouterCredential::where('router_ip', $validated['router_ip'])
            ->where('status', 'active')
            ->first();

        if (! $credential) {
            return response()->json(['error' => 'No active credential found for this IP'], 404);
        }

        $credential->update([
            'status' => 'failed',
            'last_rotation_result' => [
                'success' => false,
                'message' => "External password change detected: {$validated['error']}",
                'detected_at' => $validated['detected_at'],
                'type' => 'external_change',
            ],
        ]);

        RotationLog::create([
            'router_credential_id' => $credential->id,
            'action' => 'external_change_detected',
            'details' => [
                'error' => $validated['error'],
                'detected_at' => $validated['detected_at'],
            ],
            'status' => 'failure',
        ]);

        return response()->json([
            'status' => 'recorded',
            'message' => 'External password change recorded. Update credentials via dashboard.',
        ]);
    }

    /**
     * Called by user via dashboard to provide new credentials after external change.
     */
    public function updateCredentials(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'router_ip' => 'required|string',
            'username' => 'required|string|max:32',
            'password' => 'required|string|min:8|max:64',
        ]);

        $credential = RouterCredential::where('router_ip', $validated['router_ip'])->first();

        if (! $credential) {
            return response()->json(['error' => 'No credential record found for this IP'], 404);
        }

        $credential->update([
            'username' => $validated['username'],
            'password' => $validated['password'],
            'status' => 'active',
            'last_rotation_result' => [
                'success' => true,
                'message' => 'Credentials updated after external change detection',
                'updated_at' => now()->toISOString(),
                'type' => 'manual_update',
            ],
        ]);

        RotationLog::create([
            'router_credential_id' => $credential->id,
            'action' => 'credentials_updated',
            'details' => [
                'type' => 'manual_update',
                'updated_at' => now()->toISOString(),
            ],
            'status' => 'success',
        ]);

        return response()->json([
            'status' => 'updated',
            'message' => 'Credentials updated. Agent will use new credentials on next operation.',
        ]);
    }

    /**
     * Called by agent when factory reset is detected.
     */
    public function resetDetected(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'router_ip' => 'required|string',
            'error' => 'required|string',
            'detected_at' => 'required|string',
            'detection_type' => 'required|string',
            'old_ip' => 'nullable|string',
            'old_mac' => 'nullable|string',
            'hostname' => 'nullable|string',
        ]);

        $credential = RouterCredential::where('router_ip', $validated['router_ip'])
            ->where('status', 'active')
            ->first();

        if (! $credential) {
            // Try any credential for this IP
            $credential = RouterCredential::where('router_ip', $validated['router_ip'])->first();
        }

        if (! $credential) {
            return response()->json(['error' => 'No credential record found for this IP'], 404);
        }

        $credential->update([
            'status' => 'failed',
            'last_rotation_result' => [
                'success' => false,
                'message' => "Router {$validated['detection_type']} detected: {$validated['error']}",
                'detected_at' => $validated['detected_at'],
                'type' => $validated['detection_type'],
                'old_ip' => $validated['old_ip'] ?? null,
                'old_mac' => $validated['old_mac'] ?? null,
                'hostname' => $validated['hostname'] ?? null,
            ],
        ]);

        RotationLog::create([
            'router_credential_id' => $credential->id,
            'action' => "{$validated['detection_type']}_detected",
            'details' => [
                'error' => $validated['error'],
                'detected_at' => $validated['detected_at'],
                'old_ip' => $validated['old_ip'] ?? null,
                'old_mac' => $validated['old_mac'] ?? null,
                'hostname' => $validated['hostname'] ?? null,
            ],
            'status' => 'failure',
        ]);

        return response()->json([
            'status' => 'recorded',
            'message' => "Router {$validated['detection_type']} recorded. Update credentials via dashboard.",
        ]);
    }
}
