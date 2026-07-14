<?php

namespace App\Http\Controllers;

use App\Events\RouterActionTriggered;
use App\Models\RouterLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RouterController extends Controller
{
    public function triggerReboot(): JsonResponse
    {
        $log = RouterLog::create([
            'action_type'  => 'reboot',
            'payload'      => null,
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        broadcast(new RouterActionTriggered(
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
        $validated = $request->validate([
            'new_password' => 'required|string|min:8|max:63|confirmed',
        ]);

        $log = RouterLog::create([
            'action_type'  => 'password_change',
            'payload'      => $validated['new_password'],
            'status'       => 'pending',
            'triggered_by' => request()->ip(),
        ]);

        broadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'password_change',
            parameters: ['new_password' => $validated['new_password']],
        ));

        return response()->json([
            'success' => true,
            'log_id'  => $log->id,
            'message' => 'Password change command dispatched.',
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
            'success' => true,
            'log_id'  => $log->id,
            'status'  => $log->status,
        ]);
    }
}
