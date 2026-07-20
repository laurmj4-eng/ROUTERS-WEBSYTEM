<?php

namespace App\Http\Controllers;

use App\Events\BruteForceProgress;
use App\Events\RouterActionTriggered;
use App\Models\BruteForceSession;
use App\Models\RouterLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BruteForceController extends Controller
{
    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ssid' => 'required|string|max:32',
            'wordlist' => 'nullable|string',
            'passwords' => 'nullable|array',
        ]);

        $session = BruteForceSession::create([
            'ssid' => $validated['ssid'],
            'status' => 'pending',
            'wordlist_name' => $validated['wordlist'] ?? 'built-in',
            'started_at' => now(),
        ]);

        $log = RouterLog::create([
            'action_type' => 'wifi_bruteforce',
            'payload' => array_merge($validated, ['session_id' => $session->id]),
            'status' => 'pending',
            'triggered_by' => 'web',
        ]);

        broadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'wifi_bruteforce',
            parameters: [
                'session_id' => $session->id,
                'ssid' => $validated['ssid'],
                'wordlist' => $validated['wordlist'] ?? null,
                'passwords' => $validated['passwords'] ?? null,
                'force' => true,
            ],
        ));

        return response()->json([
            'session_id' => $session->id,
            'log_id' => $log->id,
            'status' => 'pending',
        ]);
    }

    public function progress(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|exists:brute_force_sessions,id',
            'index' => 'required|integer',
            'total' => 'required|integer',
            'password' => 'nullable|string',
            'state' => 'nullable|string',
            'rate' => 'nullable|string',
            'eta' => 'nullable|integer',
            'percent' => 'nullable|numeric',
            'elapsed' => 'nullable|integer',
        ]);

        $session = BruteForceSession::findOrFail($validated['session_id']);

        $session->update([
            'status' => 'running',
            'current_index' => $validated['index'],
            'total' => $validated['total'],
            'current_password' => $validated['password'],
            'last_state' => $validated['state'],
            'speed_per_min' => (float) ($validated['rate'] ?? 0),
            'eta_minutes' => $validated['eta'] ?? 0,
            'percent' => $validated['percent'] ?? 0,
            'elapsed_seconds' => $validated['elapsed'] ?? 0,
        ]);

        broadcast(new BruteForceProgress(
            sessionId: $session->id,
            progress: $validated,
        ));

        return response()->json(['ok' => true]);
    }

    public function found(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|exists:brute_force_sessions,id',
            'password' => 'required|string',
            'ip' => 'nullable|string',
            'attempts' => 'required|integer',
            'elapsed' => 'required|integer',
        ]);

        $session = BruteForceSession::findOrFail($validated['session_id']);
        $session->update([
            'status' => 'completed',
            'found_password' => $validated['password'],
            'found_ip' => $validated['ip'],
            'current_index' => $validated['attempts'],
            'elapsed_seconds' => $validated['elapsed'],
            'percent' => 100,
            'completed_at' => now(),
        ]);

        broadcast(new BruteForceProgress(
            sessionId: $session->id,
            progress: [
                'event' => 'found',
                'password' => $validated['password'],
                'ip' => $validated['ip'],
                'attempts' => $validated['attempts'],
                'elapsed' => $validated['elapsed'],
                'percent' => 100,
            ],
        ));

        return response()->json(['ok' => true]);
    }

    public function complete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|exists:brute_force_sessions,id',
            'found' => 'required|boolean',
            'attempts' => 'required|integer',
            'elapsed' => 'required|integer',
            'error' => 'nullable|string',
        ]);

        $session = BruteForceSession::findOrFail($validated['session_id']);
        $session->update([
            'status' => $validated['found'] ? 'completed' : 'failed',
            'current_index' => $validated['attempts'],
            'elapsed_seconds' => $validated['elapsed'],
            'error' => $validated['error'] ?? null,
            'completed_at' => now(),
        ]);

        broadcast(new BruteForceProgress(
            sessionId: $session->id,
            progress: [
                'event' => 'complete',
                'found' => $validated['found'],
                'attempts' => $validated['attempts'],
                'elapsed' => $validated['elapsed'],
            ],
        ));

        return response()->json(['ok' => true]);
    }

    public function stop(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|exists:brute_force_sessions,id',
        ]);

        $session = BruteForceSession::findOrFail($validated['session_id']);
        $session->update(['status' => 'aborted', 'completed_at' => now()]);

        $log = RouterLog::create([
            'action_type' => 'stop_bruteforce',
            'payload' => ['session_id' => $session->id],
            'status' => 'pending',
        ]);

        broadcast(new RouterActionTriggered(
            logId: $log->id,
            action: 'stop_bruteforce',
            parameters: ['session_id' => $session->id],
        ));

        return response()->json(['ok' => true]);
    }

    public function status(Request $request, int $id): JsonResponse
    {
        $session = BruteForceSession::findOrFail($id);
        return response()->json($session);
    }
}
