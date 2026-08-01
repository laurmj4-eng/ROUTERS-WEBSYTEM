<?php

namespace App\Http\Controllers;

use App\Events\LpbActionRequested;
use App\Models\RouterLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class LpbController extends Controller
{
    private function safeBroadcast(LpbActionRequested $event): void
    {
        try {
            broadcast($event);
        } catch (\Throwable $e) {
            Log::warning('LPB broadcast failed: ' . $e->getMessage());
        }
    }

    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action' => 'required|in:connect,add_time,convert',
            'days'   => 'nullable|integer|min:1|max:3650',
            'count'  => 'nullable|integer|min:1|max:200',
        ]);

        $log = RouterLog::create([
            'action_type'  => 'lpb_' . $validated['action'],
            'payload'      => json_encode($request->only(['days', 'count'])),
            'status'       => 'pending',
            'triggered_by' => $request->ip(),
        ]);

        $this->safeBroadcast(new LpbActionRequested(
            logId: $log->id,
            action: $validated['action'],
            parameters: [
                'days'  => $validated['days'] ?? null,
                'count' => $validated['count'] ?? null,
            ],
        ));

        return response()->json([
            'success' => true,
            'log_id'  => $log->id,
            'message' => 'LPB action dispatched to local agent.',
        ]);
    }

    public function report(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'log_id'            => 'nullable|integer',
            'remaining_seconds' => 'nullable|integer',
            'vouchers'          => 'nullable|array',
            'vouchers.*'        => 'string',
            'success'           => 'nullable|boolean',
        ]);

        Cache::put('lpb_state', $validated, now()->addDay());

        if (!empty($validated['log_id'])) {
            $log = RouterLog::find($validated['log_id']);
            if ($log) {
                $log->update([
                    'status' => !empty($validated['success']) ? 'success' : 'failed',
                ]);
            }
        }

        return response()->json(['success' => true]);
    }

    public function getState(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => Cache::get('lpb_state', []),
        ]);
    }
}
