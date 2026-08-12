<?php

namespace App\Http\Controllers;

use App\Events\TulogScanRequested;
use App\Models\RouterLog;
use App\Models\TulogScan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TulogScanController extends Controller
{
    private function safeBroadcast(TulogScanRequested $event): void
    {
        try {
            broadcast($event);
        } catch (\Throwable $e) {
            Log::warning('Broadcast failed: ' . $e->getMessage());
        }
    }

    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ssid'         => 'nullable|string|max:64',
            'restore_ssid' => 'nullable|string|max:64',
        ]);

        $log = RouterLog::create([
            'action_type'  => 'tulog_scan',
            'payload'      => json_encode($validated),
            'status'       => 'pending',
            'triggered_by' => $request->ip(),
        ]);

        $this->safeBroadcast(new TulogScanRequested(
            logId: $log->id,
            ssid: $validated['ssid'] ?? null,
            restoreSsid: $validated['restore_ssid'] ?? null,
        ));

        return response()->json([
            'success'   => true,
            'log_id'    => $log->id,
            'message'   => 'Tulog scan dispatched to local agent.',
            'timestamp' => now()->toISOString(),
        ]);
    }

    public function storeResults(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'log_id'          => 'nullable|integer',
            'original_ssid'   => 'nullable|string|max:64',
            'target_ssid'     => 'nullable|string|max:64',
            'status'          => 'required|in:completed,failed,ssid_not_in_range,partial',
            'connected'       => 'nullable|boolean',
            'bssid'           => 'nullable|string|max:32',
            'signal'          => 'nullable|integer',
            'band'            => 'nullable|string|max:16',
            'ip_address'      => 'nullable|string|max:32',
            'gateway'         => 'nullable|string|max:32',
            'gateway_mac'     => 'nullable|string|max:32',
            'ports_open'      => 'nullable|array',
            'ports_open.*'    => 'string',
            'http_probes'     => 'nullable|array',
            'http_probes.*'   => 'array',
            'devices_found'   => 'nullable|array',
            'devices_found.*' => 'array',
            'beacon_analysis' => 'nullable|array',
            'restore_status'  => 'nullable|string|max:32',
            'error'           => 'nullable|string',
            'duration_ms'     => 'nullable|integer',
        ]);

        $scan = TulogScan::create($validated);

        if (! empty($validated['log_id'])) {
            RouterLog::where('id', $validated['log_id'])->update([
                'status' => in_array($validated['status'], ['completed', 'partial'], true) ? 'success' : 'failed',
            ]);
        }

        return response()->json([
            'success' => true,
            'id'      => $scan->id,
            'message' => 'Tulog scan results stored.',
        ]);
    }

    public function history(): JsonResponse
    {
        return response()->json([
            'data' => TulogScan::latest()->take(20)->get(),
        ]);
    }
}
