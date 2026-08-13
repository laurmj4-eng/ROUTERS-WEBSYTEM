<?php

namespace App\Http\Controllers;

use App\Support\Relay;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * PLDT relay endpoints — reached through the cloudflared tunnel from the
 * hosted (Render) site, which cannot reach 192.168.1.1 itself.
 *
 * These routes are PUBLIC (the tunnel URL is public), so every request must
 * present the shared X-Relay-Token header matching RELAY_TOKEN. They are
 * stateless executors: they run the check/scan on this machine and return
 * the raw JSON result — no DB writes.
 */
class RelayPldtController extends Controller
{
    private function authorized(Request $request): bool
    {
        $expected = (string) config('scanning.relay.token');

        return $expected !== ''
            && is_string($request->header('X-Relay-Token'))
            && hash_equals($expected, $request->header('X-Relay-Token'));
    }

    private function deny(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Unauthorized — missing or invalid relay token.',
        ], 401);
    }

    /**
     * The PC agent's start-relay script saves its fresh trycloudflare URL here
     * after every restart, so the user never has to re-paste it in the UI.
     * Same shared-token guard as the other relay endpoints.
     */
    public function setTunnelUrl(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->deny();
        }

        $validated = $request->validate([
            'url' => 'required|string|max:255',
        ]);

        $url = trim($validated['url']);

        if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
            return response()->json(['success' => false, 'message' => 'URL must start with http:// or https://.'], 422);
        }

        Relay::set('pldt', $url);

        return response()->json(['success' => true, 'url' => $url, 'active' => true]);
    }

    public function checkConnection(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->deny();
        }

        $routerIp = $request->input('router_ip') ?: '192.168.1.1';
        $host = gethostbyname($routerIp);

        foreach ([443, 80] as $port) {
            $fp = @fsockopen($host, $port, $errno, $errstr, 4);
            if ($fp) {
                fclose($fp);

                return response()->json([
                    'success' => true,
                    'ip'      => $routerIp,
                    'port'    => $port,
                ]);
            }
        }

        return response()->json([
            'success' => false,
            'ip'      => $routerIp,
            'message' => "Cannot reach {$routerIp} — " . ($errstr ?? 'no response'),
        ]);
    }

    public function wifiScan(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->deny();
        }

        set_time_limit(180);

        $validated = $request->validate([
            'username'  => 'required|string|max:64',
            'password'  => 'required|string|max:128',
            'router_ip' => 'nullable|string|max:64',
        ]);

        $routerIp   = $validated['router_ip'] ?? '192.168.1.1';
        $scriptPath = base_path('local-agent/puppeteer/wifi_scan_cli.js');

        if (! is_file($scriptPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Wifi scan script not installed on this machine.',
            ], 502);
        }

        $escUser   = escapeshellarg($validated['username']);
        $escPass   = escapeshellarg($validated['password']);
        $escIp     = escapeshellarg($routerIp);
        $escScript = escapeshellarg($scriptPath);

        $cmd = "node $escScript --username $escUser --password $escPass --router-ip $escIp 2>&1";

        Log::info('RelayPldtWifiScan: ' . $cmd);
        $start = microtime(true);
        $output = shell_exec($cmd);
        $elapsed = round(microtime(true) - $start);

        $result = $this->parseJsonOutput($output);

        if (! $result || isset($result['error'])) {
            return response()->json([
                'success'    => false,
                'message'    => $result['error'] ?? 'Unknown error during WiFi password scan',
                'raw_output' => $output,
                'elapsed'    => $elapsed,
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data'    => $result['wifi'] ?? [],
            'elapsed' => $elapsed,
        ]);
    }

    private function parseJsonOutput(?string $output): ?array
    {
        if ($output === null || trim($output) === '') return null;
        $lines = array_reverse(array_filter(explode("\n", $output), fn($l) => trim($l) !== ''));
        foreach ($lines as $line) {
            $decoded = json_decode(trim($line), true);
            if (is_array($decoded)) return $decoded;
        }
        return null;
    }

    public function scanPassword(Request $request): JsonResponse
    {
        if (! $this->authorized($request)) {
            return $this->deny();
        }

        set_time_limit(180);

        $validated = $request->validate([
            'username'  => 'required|string|max:64',
            'password'  => 'required|string|max:128',
            'router_ip' => 'nullable|string|max:64',
        ]);

        $routerIp   = $validated['router_ip'] ?? '192.168.1.1';
        $scriptPath = base_path('local-agent/puppeteer/getxml_file.js');

        if (! is_file($scriptPath)) {
            return response()->json([
                'success' => false,
                'message' => 'Router agent not installed on this machine.',
            ], 502);
        }

        $downloadPath = sys_get_temp_dir() . '/psk_' . bin2hex(random_bytes(4));
        mkdir($downloadPath, 0777, true);

        $escUser = escapeshellarg($validated['username']);
        $escPass = escapeshellarg($validated['password']);
        $escIp   = escapeshellarg($routerIp);
        $escDl   = escapeshellarg($downloadPath);
        $escScript = escapeshellarg($scriptPath);
        $wordlistPath = base_path('cred-scanner/wordlists/common-router-passwords.txt');
        $escWordlist = escapeshellarg($wordlistPath);

        $cmd = "node $escScript --username $escUser --password $escPass --router-ip $escIp --download-path $escDl --wordlist $escWordlist 2>&1";

        Log::info('RelayPldtScanPassword: ' . $cmd);
        $start = microtime(true);
        $output = shell_exec($cmd);
        $elapsed = round(microtime(true) - $start);

        try {
            array_map('unlink', glob("$downloadPath/*.*"));
            rmdir($downloadPath);
        } catch (\Throwable $e) {
            Log::warning('RelayPldt cleanup failed: ' . $e->getMessage());
        }

        $result = $this->parseJsonOutput($output);

        if (! $result || isset($result['error'])) {
            return response()->json([
                'success'    => false,
                'message'    => $result['error'] ?? 'Unknown error during password scan',
                'raw_output' => $output,
                'elapsed'    => $elapsed,
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data'    => $result,
            'elapsed' => $elapsed,
        ]);
    }
}
