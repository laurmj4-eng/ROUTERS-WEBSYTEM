<?php

namespace App\Http\Controllers;

use App\Support\Relay;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * ADU Piso WiFi Tools — direct HTTP API against the AdoPiSoft captive portal
 * (10.0.0.1). Uses the install_wizard flip to open admin endpoints, performs
 * the action, then flips it back. No local agent required.
 */
class AduController extends Controller
{
    private function base(): string
    {
        $url = auth()->user()?->adu_url ?? Relay::get('adu');

        return rtrim((string) $url, '/');
    }

    private function cookieKey(string $prefix): string
    {
        $scope = auth()->id() ?? 'anon:'.request()->ip();

        return $prefix.':'.$scope;
    }

    private function cookieHeader(array $jar): string
    {
        $parts = [];
        foreach ($jar as $name => $value) {
            $parts[] = $name.'='.$value;
        }

        return implode('; ', $parts);
    }

    private function saveCookies(string $cookieKey, array $headers): void
    {
        $jar = Cache::get($cookieKey, []);
        foreach ($headers['Set-Cookie'] ?? [] as $line) {
            if (preg_match('/^([^=;\s]+)=([^;]*)/', $line, $m)) {
                $jar[$m[1]] = $m[2];
            }
        }
        if ($jar) {
            Cache::put($cookieKey, $jar, now()->addDay());
        }
    }

    /**
     * @throws \RuntimeException when the portal is unreachable
     */
    private function send(string $method, string $path, ?array $data = null, ?string $cookieKey = null)
    {
        $client = Http::timeout(15)->withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept'     => 'application/json',
        ]);

        if ($cookieKey !== null) {
            $jar = Cache::get($cookieKey, []);
            if ($jar) {
                $client = $client->withHeaders(['Cookie' => $this->cookieHeader($jar)]);
            }
        }

        try {
            $response = $client->asJson()->send($method, $this->base().$path, $data !== null ? ['json' => $data] : []);
        } catch (\Throwable $e) {
            throw new \RuntimeException('ADU portal unreachable — are you connected to the ADU piso wifi network? ('.trim((string) $e->getMessage()).')');
        }

        if ($cookieKey !== null) {
            $this->saveCookies($cookieKey, $response->headers());
        }

        return $response;
    }

    private function error(\Throwable $e, int $status = 502): JsonResponse
    {
        Log::warning('ADU action failed: '.$e->getMessage());

        return response()->json(['success' => false, 'message' => $e->getMessage()], $status);
    }

    /**
     * Adds seconds to a running session (time_seconds += seconds).
     */
    public function addTime(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|integer',
            'seconds'    => 'required|integer|min:60|max:31536000',
        ]);

        $cookie = $this->cookieKey('adu_admin');

        try {
            $this->send('POST', '/install/config', ['install_wizard' => false], $cookie);
            $response = $this->send('POST', '/settings/session/'.$validated['session_id'], [
                'data' => ['time_seconds' => $validated['seconds']],
                'opts' => ['add_values' => true],
            ], $cookie);
            $this->send('POST', '/install/config', ['install_wizard' => true], $cookie);
        } catch (\Throwable $e) {
            return $this->error($e);
        }

        if ($response->status() !== 200) {
            return $this->error(new \RuntimeException('Portal responded with HTTP '.$response->status().': '.mb_substr((string) $response->body(), 0, 200)), 422);
        }

        return response()->json(['success' => true, 'session' => $response->json()]);
    }

    /**
     * Morphs an unused voucher into a time voucher with the given duration.
     */
    public function convertVoucher(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'voucher_id' => 'required|integer',
            'minutes'    => 'required|integer|min:60|max:525600',
        ]);

        $cookie = $this->cookieKey('adu_admin');

        try {
            $this->send('POST', '/install/config', ['install_wizard' => false], $cookie);
            $response = $this->send('PUT', '/settings/vouchers/'.$validated['voucher_id'], [
                'type'                 => 'time',
                'minutes'              => $validated['minutes'],
                'megabytes'            => 0,
                'price'                => 5,
                'max_users'            => 1,
                'expiration_hours'     => null,
                'allow_pause'          => true,
                'bandwidth_down_kbps'  => 2800,
                'bandwidth_up_kbps'    => 2500,
                'generated_by'         => (string) env('ADU_DEVICE_MAC', '60:DD:8E:14:D6:8D'),
            ], $cookie);
            $this->send('POST', '/install/config', ['install_wizard' => true], $cookie);
        } catch (\Throwable $e) {
            return $this->error($e);
        }

        if ($response->status() !== 200) {
            return $this->error(new \RuntimeException('Portal responded with HTTP '.$response->status().': '.mb_substr((string) $response->body(), 0, 200)), 422);
        }

        return response()->json(['success' => true, 'voucher' => $response->json()]);
    }

    /**
     * Reveals the current admin account credentials via the install wizard.
     */
    public function adminCredentials(Request $request): JsonResponse
    {
        $cookie = $this->cookieKey('adu_admin');

        try {
            $this->send('POST', '/install/config', ['install_wizard' => false], $cookie);
            $response = $this->send('GET', '/accounts/me', null, $cookie);
        } catch (\Throwable $e) {
            return $this->error($e);
        } finally {
            try {
                $this->send('POST', '/install/config', ['install_wizard' => true], $cookie);
            } catch (\Throwable $e) {
                // restore failed silently
            }
        }

        $account = $response->json();

        return response()->json([
            'success' => true,
            'account' => $account,
        ])->header('Cache-Control', 'no-store');
    }

    /**
     * Current session state + the customer's voucher list.
     */
    public function status(): JsonResponse
    {
        $user = auth()->user();
        $tmp = (string) ($user?->adu_tmp_client_id ?? env('ADU_TMP_CLIENT_ID', '151785651702039'));
        $cookie = $this->cookieKey('adu_customer');

        try {
            $sessions = $this->send('GET', '/client/sessions?tmp_client_id='.$tmp, null, $cookie);

            // Customer login sets customer_token even though the handler
            // 500s on an unrelated device bug.
            $this->send('POST', '/customer/login', [
                'username' => (string) ($user?->adu_customer_user ?? env('ADU_CUSTOMER_USER', 'vendo_test_0815b')),
                'password' => (string) ($user?->adu_customer_pass ?? env('ADU_CUSTOMER_PASS', 'P@ssw0rd123!')),
            ], $cookie);

            $vouchers = $this->send('GET', '/customer/vouchers?disregard_browser=true&tmp_client_id='.$tmp, null, $cookie);
        } catch (\Throwable $e) {
            return $this->error($e);
        }

        return response()->json([
            'success'  => true,
            'sessions' => $sessions->json(),
            'vouchers' => $vouchers->json()['rows'] ?? [],
        ]);
    }

    /**
     * Generic pass-through proxy to the ADU portal (JSON API + cookie jar).
     */
    public function proxy(Request $request, string $path)
    {
        $cookie = $this->cookieKey('adu_cookie');
        $query = $request->getQueryString();
        $url = $this->base().'/'.$path.($query ? '?'.$query : '');

        $client = Http::timeout(15)->withHeaders([
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept'     => 'application/json',
        ]);
        $jar = Cache::get($cookie, []);
        if ($jar) {
            $client = $client->withHeaders(['Cookie' => $this->cookieHeader($jar)]);
        }

        try {
            $response = $client->send($request->method(), $url, $request->isMethod('GET') ? [] : ['json' => $request->input()]);
        } catch (\Throwable $e) {
            return response('proxy error: '.$e->getMessage(), 502);
        }

        $this->saveCookies($cookie, $response->headers());

        $headers = ['Content-Type' => $response->header('Content-Type') ?: 'application/json'];
        $status = $response->status() ?: 502;

        return response($response->body(), $status)->withHeaders($headers);
    }
}
