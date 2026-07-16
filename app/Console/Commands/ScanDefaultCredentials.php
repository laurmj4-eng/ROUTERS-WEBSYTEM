<?php

namespace App\Console\Commands;

use App\Events\DefaultCredentialFound;
use App\Models\CredentialScanResult;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ScanDefaultCredentials extends Command
{
    protected $signature = 'credentials:scan {--url=} {--report-only} {--discover} {--wordlist=} {--max-attempts=} {--username=}';

    protected $description = 'Scan the router for default/hardcoded credentials, or discover unknown passwords via dictionary attack';

    private const CRITICAL_VENDORS = ['Huawei', 'ZTE', 'Cisco', 'MikroTik'];

    public function handle(): int
    {
        $url = $this->option('url') ?: env('ROUTER_IP', '192.168.1.1');
        $dbPath = base_path('cred-scanner/credentials.db');
        $seedPath = base_path('cred-scanner/credentials.json');
        $reportOnly = $this->option('report-only');
        $discover = $this->option('discover');

        // Discovery mode
        if ($discover) {
            return $this->handleDiscovery($url);
        }

        // Collect known/active credentials to test first
        $knownUser = env('ROUTER_USER', '');
        $knownPass = env('ROUTER_PASS', '');

        // Also check router_credentials table
        if (empty($knownUser) || empty($knownPass)) {
            $cred = \App\Models\RouterCredential::where('status', 'active')->first();
            if ($cred) {
                $knownUser = $cred->username;
                $knownPass = $cred->password;
            }
        }

        $this->info("Scanning {$url} for default credentials...");

        $cmd = sprintf(
            'python "%s" --url %s --db "%s" --seed "%s" --output json%s --timeout 15',
            base_path('cred-scanner/cli.py'),
            escapeshellarg($url),
            escapeshellarg($dbPath),
            escapeshellarg($seedPath),
            $reportOnly ? ' --report-only' : ''
        );

        // Pass known credentials if available
        if (!empty($knownUser) && !empty($knownPass)) {
            $cmd .= sprintf(' --known-user %s --known-pass %s',
                escapeshellarg($knownUser),
                escapeshellarg($knownPass)
            );
            $this->info("Testing known credential: {$knownUser}:*** first");
        }

        $output = shell_exec($cmd);

        if ($output === null) {
            $this->error("Failed to execute scanner");
            return 1;
        }

        $result = json_decode(trim($output), true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            $this->error("Scanner returned invalid JSON: " . substr($output, 0, 200));
            Log::error('Credential scanner returned invalid JSON', ['output' => $output]);
            return 1;
        }

        // Store result in database
        CredentialScanResult::create([
            'target_ip' => $url,
            'router_model' => $result['model'] ?? 'Unknown',
            'vendor' => $result['vendor'] ?? null,
            'found_default' => $result['success'] ?? false,
            'username' => $result['username'] ?? null,
            'password' => $result['password'] ?? null,
            'credential_type' => $result['credential_type'] ?? null,
            'credentials_tested' => $result['tested'] ?? 0,
            'candidates' => $result['candidates'] ?? null,
            'status' => 'completed',
        ]);

        // Alert if default credentials found on critical vendor
        if (($result['success'] ?? false) && !empty($result['vendor'])) {
            if (in_array($result['vendor'], self::CRITICAL_VENDORS)) {
                try {
                    broadcast(new DefaultCredentialFound(
                        vendor: $result['vendor'],
                        model: $result['model'] ?? 'Unknown',
                        username: $result['username'],
                    ));
                } catch (\Throwable $e) {
                    Log::warning('Failed to broadcast credential alert: ' . $e->getMessage());
                }
            }
        }

        if ($result['success'] ?? false) {
            $credType = $result['credential_type'] ?? 'default';
            if ($credType === 'known') {
                $this->warn("CURRENT PASSWORD CONFIRMED:");
            } else {
                $this->warn("DEFAULT CREDENTIALS ACTIVE:");
            }
            $this->warn("  Model:    {$result['model']}");
            $this->warn("  Vendor:   {$result['vendor']}");
            $this->warn("  Username: {$result['username']}");
            $this->warn("  Password: {$result['password']}");
            $this->warn("  Tested:   {$result['tested']} combinations");
            return 2;
        }

        $this->info("No default credentials found. Tested {$result['tested']} combinations.");
        return 0;
    }

    private function handleDiscovery(string $url): int
    {
        $wordlist = $this->option('wordlist') ?: base_path('cred-scanner/wordlists/common-router-passwords.txt');
        $maxAttempts = $this->option('max-attempts') ?: 500;
        $username = $this->option('username') ?: 'admin';

        $this->info("Starting password discovery against {$url}...");
        $this->info("Username: {$username}");
        $this->info("Wordlist: {$wordlist}");
        $this->info("Max attempts: {$maxAttempts}");
        $this->newLine();

        $cmd = sprintf(
            'python "%s" --url %s --discover --wordlist "%s" --max-attempts %d --username %s --output text --timeout 15 2>&1',
            base_path('cred-scanner/cli.py'),
            escapeshellarg($url),
            escapeshellarg($wordlist),
            $maxAttempts,
            escapeshellarg($username)
        );

        $output = shell_exec($cmd);

        if ($output === null) {
            $this->error("Failed to execute discovery scanner");
            return 1;
        }

        // Parse JSON events from stdout (progress events printed line by line)
        $lines = explode("\n", trim($output));
        $finalResult = null;

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            $event = json_decode($line, true);
            if (!$event || !isset($event['type'])) continue;

            switch ($event['type']) {
                case 'start':
                    $this->info($event['message'] ?? '');
                    break;
                case 'loaded':
                    $this->info("Wordlist loaded: {$event['total']} passwords");
                    break;
                case 'model':
                    $this->info("Router model: {$event['model']}");
                    break;
                case 'attempt':
                    $attempts = $event['attempt'] ?? 0;
                    $total = $event['total'] ?? 0;
                    $password = $event['password'] ?? '';
                    $status = $event['status'] ?? '';
                    // Progress bar
                    $pct = $total > 0 ? (int) (($attempts / $total) * 100) : 0;
                    $bar = str_repeat('█', (int)($pct / 5)) . str_repeat('░', 20 - (int)($pct / 5));
                    $this->line("  [{$bar}] {$pct}% | Attempt #{$attempts}: {$password} — " . strtoupper($status));
                    break;
                case 'lockout':
                    $this->warn("  ⚠ {$event['message']}");
                    break;
                case 'lockout_detected':
                    $this->warn("  ⚠ {$event['message']}");
                    break;
                case 'found':
                    $finalResult = $event;
                    $this->newLine();
                    $this->warn("PASSWORD DISCOVERED: {$event['password']}");
                    $this->warn("  Username: {$event['username']}");
                    $this->warn("  Password: {$event['password']}");
                    $this->warn("  Attempt:  {$event['attempted']}/{$event['total']}");
                    $this->warn("  Model:    {$event['model']}");
                    $this->warn("  Time:     {$event['elapsed_seconds']}s");
                    break;
                case 'complete':
                    $finalResult = $event;
                    break;
            }
        }

        // If no JSON events found, print raw output as fallback
        if ($finalResult === null && !empty($output)) {
            $this->output->write($output);
            return 1;
        }

        // Store discovery result in database
        if ($finalResult) {
            $foundPassword = $finalResult['password'] ?? null;
            $isDiscovered = ($finalResult['success'] ?? false);

            CredentialScanResult::create([
                'target_ip' => $url,
                'router_model' => $finalResult['model'] ?? 'Unknown',
                'vendor' => null,
                'found_default' => $isDiscovered,
                'username' => $isDiscovered ? ($finalResult['username'] ?? 'admin') : null,
                'password' => $foundPassword,
                'credential_type' => $isDiscovered ? 'discovered' : null,
                'credentials_tested' => $finalResult['attempted'] ?? 0,
                'candidates' => null,
                'status' => 'completed',
            ]);

            // Broadcast alert if password found
            if ($isDiscovered && $foundPassword) {
                try {
                    broadcast(new DefaultCredentialFound(
                        vendor: 'Unknown',
                        model: $finalResult['model'] ?? 'Unknown',
                        username: $finalResult['username'] ?? 'admin',
                    ));
                } catch (\Throwable $e) {
                    Log::warning('Failed to broadcast discovery alert: ' . $e->getMessage());
                }
            }
        }

        if ($finalResult['success'] ?? false) {
            $this->newLine();
            $this->info("Discovery completed — password found!");
            return 3;
        }

        $this->newLine();
        $this->info("Discovery completed — password not found in wordlist.");
        return 0;
    }
}
