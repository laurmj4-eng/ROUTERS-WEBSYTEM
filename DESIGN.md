# Network Scanning Module — Design Specification

## Identity
**Product UI Designer** — the question: What state does the user hit 90% of the time?

## Grounding
This is a **technical architecture blueprint** for a passive network scanning module to be integrated into an existing Laravel 12 router control dashboard. The existing project is a dark-themed self-contained dashboard with inline CSS, no auth middleware, no service layer, SQLite database, and WebSocket broadcasting via Laravel Reverb. The design extends these patterns rather than replacing them.

---

## DESIGN.md

### 1. Objective
Add a passive network scanning module to the existing router control dashboard that discovers devices via ARP table analysis and DHCP log parsing, checks firmware against CVE databases, verifies network topology against user-provided baselines, and presents findings in a unified HTML dashboard — all without active probing.

### 2. Product Context
- **Existing stack**: Laravel 12 / PHP 8.2 / SQLite / Laravel Reverb WebSocket
- **Existing patterns**: Anonymous migrations, `$fillable` arrays, named return types, event broadcasting, inline dark-theme CSS
- **No auth middleware exists** — must be added as part of this work
- **No service layer** — all logic in `RouterController`. New scanning logic MUST use a service layer to avoid bloating the controller.
- **Dashboard**: Self-contained `dashboard.blade.php` with inline CSS and `<script>` tags — all UI additions follow this pattern

### 3. Visual Foundations
- **Dark theme preserved**: `#0f172a` background, `#1e293b` cards, `#e2e8f0` text
- **Existing CSS classes reused**: `.card`, `.card-title`, `.badge-*`, `.status-*`, `.log-table`, `.btn-scan`
- **New severity colors**: Critical `#dc2626`, High `#f97316`, Medium `#eab308`, Low `#22c55e`, Info `#3b82f6`
- **Scan section**: Added as a new `.full-width` card between Network Status and Activity Log

### 4. Accessibility
- ARIA labels on scan trigger buttons
- Status text readable without color alone (severity badges include text labels)
- Keyboard-navigable scan controls

### 5. Voice & Tone
- Status messages: factual, no marketing language
- Error messages: specific (not "Something went wrong" — "CVE lookup failed: rate limit exceeded")
- Scan results: severity-first ordering, critical findings at top

### 6. Implementation Practices
- Service classes for business logic, controllers for HTTP only
- Rate limiting via Laravel's built-in `RateLimiter` facade
- All new migrations follow anonymous class pattern from existing code
- Events for WebSocket broadcast on scan completion
- JSON/CSV topology files stored in `storage/app/topology/`

### 7. Anti-Patterns
- Do NOT put scanning logic in the controller (existing pattern, but wrong for this scope)
- Do NOT use `shell_exec` for ARP table — read from system file or agent API response
- Do NOT hardcode NVD API key — use config/env
- Do NOT skip rate limiting — scans are expensive operations

### 8. Decision-Making
- Service layer introduced even though existing code doesn't have one — scanning logic is too complex for controllers
- Auth middleware added even though project doesn't have it — rate limiting requires user identification
- Topology files stored on disk, not database — files may be large, users edit them manually
- CVE checking done asynchronously via queued jobs — NVD API is slow (500ms+ per query)

### 9. Workflow
Implementation order: migrations → models → services → controller → routes → events → dashboard UI → testing

---

## Structure

### 1. Database Schema

#### Table: `scan_sessions`
```php
Schema::create('scan_sessions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
    $table->string('scan_type'); // 'passive', 'firmware', 'topology'
    $table->string('status')->default('pending'); // pending, running, completed, failed
    $table->text('parameters')->nullable(); // JSON: scan config
    $table->text('error_message')->nullable();
    $table->timestamp('started_at')->nullable();
    $table->timestamp('completed_at')->nullable();
    $table->timestamps();
});
```

#### Table: `discovered_devices`
```php
Schema::create('discovered_devices', function (Blueprint $table) {
    $table->id();
    $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
    $table->string('ip_address');
    $table->string('mac_address');
    $table->string('hostname')->nullable();
    $table->string('manufacturer')->nullable(); // OUI lookup
    $table->string('device_type')->nullable(); // 'router', 'phone', 'iot', 'unknown'
    $table->string('os_fingerprint')->nullable();
    $table->string('connection_type'); // 'arp', 'dhcp', 'firmware'
    $table->timestamps();
    
    $table->index(['scan_session_id', 'ip_address']);
    $table->index(['scan_session_id', 'mac_address']);
});
```

#### Table: `vulnerability_findings`
```php
Schema::create('vulnerability_findings', function (Blueprint $table) {
    $table->id();
    $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
    $table->string('cve_id'); // e.g., CVE-2024-12345
    $table->string('severity'); // critical, high, medium, low, info
    $table->text('description');
    $table->text('affected_component'); // firmware version, device model
    $table->text('remediation')->nullable();
    $table->decimal('cvss_score', 3, 1)->nullable();
    $table->string('source'); // 'nvd', 'vendor_advisory', 'internal'
    $table->timestamps();
    
    $table->index(['scan_session_id', 'severity']);
    $table->index(['scan_session_id', 'cve_id']);
});
```

#### Table: `topology_baselines`
```php
Schema::create('topology_baselines', function (Blueprint $table) {
    $table->id();
    $table->string('name'); // e.g., 'office-floor2', 'home-network'
    $table->string('filename'); // uploaded file name
    $table->string('file_hash'); // SHA-256 for change detection
    $table->text('expected_devices'); // JSON: parsed device list
    $table->text('expected_topology')->nullable(); // JSON: topology graph
    $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
    $table->timestamps();
    
    $table->unique('name');
});
```

#### Table: `topology_deviations`
```php
Schema::create('topology_deviations', function (Blueprint $table) {
    $table->id();
    $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
    $table->foreignId('topology_baseline_id')->constrained()->cascadeOnDelete();
    $table->string('deviation_type'); // 'unknown_device', 'missing_device', 'ip_conflict', 'wrong_subnet'
    $table->text('details'); // JSON: specific deviation data
    $table->string('severity'); // 'warning', 'critical'
    $table->timestamps();
    
    $table->index(['scan_session_id', 'deviation_type']);
});
```

**Migration file**: `database/migrations/2026_07_15_000002_create_network_scanning_tables.php`

### 2. Service Classes

#### `app/Services/NetworkScanner/ArpTableScanner.php`
```php
namespace App\Services\NetworkScanner;

use App\Models\DiscoveredDevice;
use App\Models\ScanSession;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ArpTableScanner
{
    /**
     * Parse ARP table from system output or agent API response.
     * Reads from /proc/net/arp (Linux) or agent-provided ARP cache.
     */
    public function scan(ScanSession $session): array
    {
        $arpEntries = $this->fetchArpTable();
        $devices = [];
        
        foreach ($arpEntries as $entry) {
            $device = DiscoveredDevice::create([
                'scan_session_id' => $session->id,
                'ip_address'      => $entry['ip'],
                'mac_address'     => $entry['mac'],
                'hostname'        => $entry['hostname'] ?? null,
                'manufacturer'    => $this->lookupOui($entry['mac']),
                'connection_type' => 'arp',
            ]);
            $devices[] = $device;
        }
        
        return $devices;
    }
    
    private function fetchArpTable(): array
    {
        // Try agent API first (router is on Node.js agent network)
        // Fallback to system ARP table if running locally
        if (file_exists('/proc/net/arp')) {
            return $this->parseArpFile('/proc/net/arp');
        }
        
        // For non-Linux: query router API endpoint for ARP table
        return $this->queryAgentForArpTable();
    }
    
    private function parseArpFile(string $path): array { /* ... */ }
    private function queryAgentForArpTable(): array { /* ... */ }
    private function lookupOui(string $mac): ?string { /* OUI DB lookup */ }
}
```

#### `app/Services/NetworkScanner/DhcpLogParser.php`
```php
namespace App\Services\NetworkScanner;

use App\Models\DiscoveredDevice;
use App\Models\ScanSession;

class DhcpLogParser
{
    /**
     * Parse DHCP lease files or router DHCP logs.
     * Common paths: /var/lib/dhcp/dhclient.leases, router DHCP log
     */
    public function parse(ScanSession $session): array
    {
        $leases = $this->fetchDhcpLeases();
        $devices = [];
        
        foreach ($leases as $lease) {
            $device = DiscoveredDevice::updateOrCreate(
                [
                    'scan_session_id' => $session->id,
                    'mac_address'     => $lease['mac'],
                ],
                [
                    'ip_address'      => $lease['ip'],
                    'hostname'        => $lease['hostname'] ?? null,
                    'connection_type' => 'dhcp',
                ]
            );
            $devices[] = $device;
        }
        
        return $devices;
    }
    
    private function fetchDhcpLeases(): array { /* ... */ }
}
```

#### `app/Services/NetworkScanner/FirmwareVersionChecker.php`
```php
namespace App\Services\NetworkScanner;

use App\Models\ScanSession;
use App\Models\VulnerabilityFinding;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class FirmwareVersionChecker
{
    private string $nvdApiBase = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
    
    /**
     * Check firmware version against NVD CVE database.
     * @param string $firmwareVersion e.g., "V300R015C10"
     * @param string $vendor e.g., "huawei"
     * @param string $product e.g., "hg8145x6"
     */
    public function check(ScanSession $session, string $firmwareVersion, string $vendor, string $product): array
    {
        $findings = [];
        
        // Query NVD API for matching CVEs
        $cves = $this->queryNvd($vendor, $product);
        
        foreach ($cves as $cve) {
            if ($this->isAffected($firmwareVersion, $cve)) {
                $finding = VulnerabilityFinding::create([
                    'scan_session_id'     => $session->id,
                    'cve_id'              => $cve['id'],
                    'severity'            => $this->mapSeverity($cve['cvssSeverity']),
                    'description'         => $cve['description'],
                    'affected_component'  => "Firmware {$firmwareVersion}",
                    'remediation'         => $cve['remediation'] ?? null,
                    'cvss_score'          => $cve['cvssScore'] ?? null,
                    'source'              => 'nvd',
                ]);
                $findings[] = $finding;
            }
        }
        
        // Also check vendor advisory feeds
        $vendorFindings = $this->checkVendorAdvisories($session, $vendor, $product, $firmwareVersion);
        
        return array_merge($findings, $vendorFindings);
    }
    
    private function queryNvd(string $vendor, string $product): array
    {
        $apiKey = config('services.nvd.api_key');
        $keywordSearch = "{$vendor} {$product}";
        
        $response = Http::timeout(10)
            ->withHeaders(['apiKey' => $apiKey])
            ->get($this->nvdApiBase, [
                'keywordSearch' => $keywordSearch,
                'resultsPerPage' => 20,
            ]);
        
        if ($response->successful()) {
            return $this->parseNvdResponse($response->json());
        }
        
        Log::warning('NVD API query failed', [
            'status' => $response->status(),
            'vendor' => $vendor,
        ]);
        
        return [];
    }
    
    private function isAffected(string $firmwareVersion, array $cve): bool { /* version comparison logic */ }
    private function mapSeverity(string $cvss): string { /* CVSS to severity mapping */ }
    private function checkVendorAdvisories(ScanSession $session, string $vendor, string $product, string $version): array { /* ... */ }
    private function parseNvdResponse(array $data): array { /* ... */ }
}
```

#### `app/Services/NetworkScanner/TopologyVerifier.php`
```php
namespace App\Services\NetworkScanner;

use App\Models\DiscoveredDevice;
use App\Models\ScanSession;
use App\Models\TopologyBaseline;
use App\Models\TopologyDeviation;

class TopologyVerifier
{
    /**
     * Compare scanned devices against expected topology baseline.
     */
    public function verify(ScanSession $session, int $baselineId): array
    {
        $baseline = TopologyBaseline::findOrFail($baselineId);
        $expected = json_decode($baseline->expected_devices, true);
        $actual = DiscoveredDevice::where('scan_session_id', $session->id)->get();
        
        $deviations = [];
        
        // 1. Find unknown devices (in actual, not in expected)
        $expectedMacs = collect($expected)->pluck('mac_address')->map('lowercase')->flip();
        $unknownDevices = $actual->filter(fn ($d) => !$expectedMacs->has(strtolower($d->mac_address)));
        
        foreach ($unknownDevices as $device) {
            $deviations[] = $this->recordDeviation(
                $session->id, $baseline->id,
                'unknown_device',
                'critical',
                ['device' => $device->toArray(), 'message' => 'Device not in expected topology']
            );
        }
        
        // 2. Find missing devices (in expected, not in actual)
        $actualMacs = $actual->pluck('mac_address')->map('lowercase')->flip();
        $missingDevices = collect($expected)->filter(fn ($d) => !$actualMacs->has(strtolower($d['mac_address'])));
        
        foreach ($missingDevices as $device) {
            $deviations[] = $this->recordDeviation(
                $session->id, $baseline->id,
                'missing_device',
                'warning',
                ['device' => $device, 'message' => 'Expected device not found on network']
            );
        }
        
        // 3. Check IP conflicts (same IP, different MAC)
        $ipGroups = $actual->groupBy('ip_address');
        foreach ($ipGroups as $ip => $devices) {
            if ($devices->count() > 1) {
                $deviations[] = $this->recordDeviation(
                    $session->id, $baseline->id,
                    'ip_conflict',
                    'critical',
                    ['ip' => $ip, 'devices' => $devices->toArray(), 'message' => 'Multiple devices on same IP']
                );
            }
        }
        
        return $deviations;
    }
    
    private function recordDeviation(int $sessionId, int $baselineId, string $type, string $severity, array $details): TopologyDeviation
    {
        return TopologyDeviation::create([
            'scan_session_id'      => $sessionId,
            'topology_baseline_id' => $baselineId,
            'deviation_type'       => $type,
            'details'              => json_encode($details),
            'severity'             => $severity,
        ]);
    }
}
```

#### `app/Services/NetworkScanner/ScanOrchestrator.php`
```php
namespace App\Services\NetworkScanner;

use App\Models\ScanSession;
use App\Events\NetworkScanCompleted;
use Illuminate\Support\Facades\Log;

class ScanOrchestrator
{
    public function __construct(
        private ArpTableScanner $arpScanner,
        private DhcpLogParser $dhcpParser,
        private FirmwareVersionChecker $firmwareChecker,
        private TopologyVerifier $topologyVerifier,
    ) {}
    
    /**
     * Execute a full passive scan pipeline.
     */
    public function execute(ScanSession $session, array $config): ScanSession
    {
        $session->update(['status' => 'running', 'started_at' => now()]);
        
        try {
            // Phase 1: ARP table analysis
            $arpDevices = $this->arpScanner->scan($session);
            Log::info('ARP scan completed', ['devices' => count($arpDevices)]);
            
            // Phase 2: DHCP log parsing (if enabled)
            if (in_array('dhcp', $config['sources'] ?? ['arp', 'dhcp'])) {
                $dhcpDevices = $this->dhcpParser->parse($session);
                Log::info('DHCP parse completed', ['devices' => count($dhcpDevices)]);
            }
            
            // Phase 3: Firmware vulnerability check (if firmware info available)
            if (!empty($config['firmware_version'])) {
                $findings = $this->firmwareChecker->check(
                    $session,
                    $config['firmware_version'],
                    $config['vendor'] ?? 'huawei',
                    $config['product'] ?? 'hg8145x6'
                );
                Log::info('Firmware check completed', ['findings' => count($findings)]);
            }
            
            // Phase 4: Topology verification (if baseline provided)
            if (!empty($config['topology_baseline_id'])) {
                $deviations = $this->topologyVerifier->verify($session, $config['topology_baseline_id']);
                Log::info('Topology verification completed', ['deviations' => count($deviations)]);
            }
            
            $session->update(['status' => 'completed', 'completed_at' => now()]);
            
            // Broadcast completion event via WebSocket
            event(new NetworkScanCompleted(
                sessionId: $session->id,
                deviceCount: $session->discoveredDevices()->count(),
                findingsCount: $session->vulnerabilityFindings()->count(),
            ));
            
        } catch (\Throwable $e) {
            $session->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at' => now(),
            ]);
            Log::error('Scan failed', ['session_id' => $session->id, 'error' => $e->getMessage()]);
        }
        
        return $session->fresh();
    }
}
```

### 3. Models

#### `app/Models/ScanSession.php`
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScanSession extends Model
{
    protected $fillable = [
        'user_id',
        'scan_type',
        'status',
        'parameters',
        'error_message',
        'started_at',
        'completed_at',
    ];
    
    protected function casts(): array
    {
        return [
            'parameters'  => 'array',
            'started_at'  => 'datetime',
            'completed_at' => 'datetime',
        ];
    }
    
    public function discoveredDevices(): HasMany
    {
        return $this->hasMany(DiscoveredDevice::class);
    }
    
    public function vulnerabilityFindings(): HasMany
    {
        return $this->hasMany(VulnerabilityFinding::class);
    }
    
    public function topologyDeviations(): HasMany
    {
        return $this->hasMany(TopologyDeviation::class);
    }
}
```

#### `app/Models/DiscoveredDevice.php`
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscoveredDevice extends Model
{
    protected $fillable = [
        'scan_session_id',
        'ip_address',
        'mac_address',
        'hostname',
        'manufacturer',
        'device_type',
        'os_fingerprint',
        'connection_type',
    ];
    
    public function scanSession(): BelongsTo
    {
        return $this->belongsTo(ScanSession::class);
    }
}
```

#### `app/Models/VulnerabilityFinding.php`
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VulnerabilityFinding extends Model
{
    protected $fillable = [
        'scan_session_id',
        'cve_id',
        'severity',
        'description',
        'affected_component',
        'remediation',
        'cvss_score',
        'source',
    ];
    
    protected function casts(): array
    {
        return [
            'cvss_score' => 'decimal:1',
        ];
    }
    
    public function scanSession(): BelongsTo
    {
        return $this->belongsTo(ScanSession::class);
    }
}
```

#### `app/Models/TopologyBaseline.php`
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TopologyBaseline extends Model
{
    protected $fillable = [
        'name',
        'filename',
        'file_hash',
        'expected_devices',
        'expected_topology',
        'user_id',
    ];
    
    protected function casts(): array
    {
        return [
            'expected_devices'  => 'array',
            'expected_topology' => 'array',
        ];
    }
}
```

#### `app/Models/TopologyDeviation.php`
```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TopologyDeviation extends Model
{
    protected $fillable = [
        'scan_session_id',
        'topology_baseline_id',
        'deviation_type',
        'details',
        'severity',
    ];
    
    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }
    
    public function scanSession(): BelongsTo
    {
        return $this->belongsTo(ScanSession::class);
    }
}
```

### 4. Controller & Routes

#### `app/Http/Controllers/NetworkScanController.php`
```php
namespace App\Http\Controllers;

use App\Http\Requests\StartScanRequest;
use App\Http\Requests\UploadTopologyRequest;
use App\Models\ScanSession;
use App\Models\TopologyBaseline;
use App\Services\NetworkScanner\ScanOrchestrator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;

class NetworkScanController extends Controller
{
    /**
     * POST /api/scan/start
     * Start a passive network scan.
     */
    public function startScan(StartScanRequest $request, ScanOrchestrator $orchestrator): JsonResponse
    {
        $key = 'scan:' . ($request->user()?->id ?? $request->ip());
        
        if (RateLimiter::tooManyAttempts($key, config('scanning.rate_limit.max', 10))) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'success' => false,
                'message' => "Rate limit exceeded. Try again in {$seconds} seconds.",
                'retry_after' => $seconds,
            ], 429);
        }
        
        RateLimiter::hit($key, config('scanning.rate_limit.decay', 3600));
        
        $session = ScanSession::create([
            'user_id'    => $request->user()?->id,
            'scan_type'  => $request->input('scan_type', 'passive'),
            'status'     => 'pending',
            'parameters' => $request->validated(),
        ]);
        
        // Execute synchronously for now; switch to queue later for large scans
        $session = $orchestrator->execute($session, $request->validated());
        
        return response()->json([
            'success'   => true,
            'session'   => $session->load(['discoveredDevices', 'vulnerabilityFindings', 'topologyDeviations']),
            'message'   => 'Scan completed.',
        ]);
    }
    
    /**
     * GET /api/scan/results/{id}
     * Retrieve scan results by session ID.
     */
    public function getResults(int $id): JsonResponse
    {
        $session = ScanSession::with([
            'discoveredDevices',
            'vulnerabilityFindings',
            'topologyDeviations',
        ])->findOrFail($id);
        
        return response()->json(['data' => $session]);
    }
    
    /**
     * GET /api/scan/history
     * List recent scan sessions.
     */
    public function getHistory(Request $request): JsonResponse
    {
        $sessions = ScanSession::withCount(['discoveredDevices', 'vulnerabilityFindings', 'topologyDeviations'])
            ->latest()
            ->take(20)
            ->get();
        
        return response()->json(['data' => $sessions]);
    }
    
    /**
     * POST /api/scan/topology/upload
     * Upload a topology baseline file (JSON or CSV).
     */
    public function uploadTopology(UploadTopologyRequest $request): JsonResponse
    {
        $file = $request->file('topology_file');
        $content = file_get_contents($file->getRealPath());
        $hash = hash('sha256', $content);
        
        // Parse based on extension
        $extension = strtolower($file->getClientOriginalExtension());
        $devices = match ($extension) {
            'json' => json_decode($content, true),
            'csv'  => $this->parseCsv($content),
            default => throw new \InvalidArgumentException('Unsupported file type. Use JSON or CSV.'),
        };
        
        $baseline = TopologyBaseline::create([
            'name'             => $request->input('name'),
            'filename'         => $file->getClientOriginalName(),
            'file_hash'        => $hash,
            'expected_devices' => $devices,
            'user_id'          => $request->user()?->id,
        ]);
        
        return response()->json([
            'success'  => true,
            'baseline' => $baseline,
            'message'  => 'Topology baseline uploaded.',
        ]);
    }
    
    /**
     * GET /api/scan/topology/baselines
     * List available topology baselines.
     */
    public function listBaselines(): JsonResponse
    {
        $baselines = TopologyBaseline::latest()->get();
        return response()->json(['data' => $baselines]);
    }
    
    /**
     * GET /api/scan/dashboard
     * Aggregated dashboard data for the UI.
     */
    public function getDashboard(): JsonResponse
    {
        $latestSession = ScanSession::with([
            'discoveredDevices',
            'vulnerabilityFindings',
            'topologyDeviations',
        ])->latest()->first();
        
        return response()->json([
            'data' => [
                'latest_scan' => $latestSession,
                'summary' => [
                    'total_devices'     => $latestSession?->discoveredDevices->count() ?? 0,
                    'critical_findings' => $latestSession?->vulnerabilityFindings->where('severity', 'critical')->count() ?? 0,
                    'high_findings'     => $latestSession?->vulnerabilityFindings->where('severity', 'high')->count() ?? 0,
                    'unknown_devices'   => $latestSession?->topologyDeviations->where('deviation_type', 'unknown_device')->count() ?? 0,
                    'missing_devices'   => $latestSession?->topologyDeviations->where('deviation_type', 'missing_device')->count() ?? 0,
                ],
                'rate_limit' => [
                    'max'         => config('scanning.rate_limit.max', 10),
                    'remaining'   => $this->getRemainingScans(),
                    'resets_at'   => now()->addSeconds(config('scanning.rate_limit.decay', 3600)),
                ],
            ],
        ]);
    }
    
    private function getRemainingScans(): int
    {
        $key = 'scan:' . (auth()->id() ?? request()->ip());
        $max = config('scanning.rate_limit.max', 10);
        $attempts = RateLimiter::attempts($key);
        return max(0, $max - $attempts);
    }
    
    private function parseCsv(string $content): array
    {
        $lines = explode("\n", $content);
        $headers = str_getcsv(array_shift($lines));
        $devices = [];
        
        foreach ($lines as $line) {
            if (trim($line) === '') continue;
            $values = str_getcsv($line);
            $devices[] = array_combine($headers, $values);
        }
        
        return $devices;
    }
}
```

### 5. Routes — `routes/api.php` additions

```php
use App\Http\Controllers\NetworkScanController;

// Network scanning routes (rate-limited)
Route::prefix('scan')->group(function () {
    Route::post('/start', [NetworkScanController::class, 'startScan']);
    Route::get('/results/{id}', [NetworkScanController::class, 'getResults']);
    Route::get('/history', [NetworkScanController::class, 'getHistory']);
    Route::get('/dashboard', [NetworkScanController::class, 'getDashboard']);
    Route::post('/topology/upload', [NetworkScanController::class, 'uploadTopology']);
    Route::get('/topology/baselines', [NetworkScanController::class, 'listBaselines']);
});
```

### 6. Form Requests

#### `app/Http/Requests/StartScanRequest.php`
```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StartScanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Allow unauthenticated for now; tighten later
    }
    
    public function rules(): array
    {
        return [
            'scan_type'             => 'sometimes|string|in:passive,firmware,topology,full',
            'sources'               => 'sometimes|array',
            'sources.*'             => 'string|in:arp,dhcp',
            'firmware_version'      => 'nullable|string|max:64',
            'vendor'                => 'nullable|string|max:32',
            'product'               => 'nullable|string|max:32',
            'topology_baseline_id'  => 'nullable|exists:topology_baselines,id',
        ];
    }
}
```

#### `app/Http/Requests/UploadTopologyRequest.php`
```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadTopologyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }
    
    public function rules(): array
    {
        return [
            'name'           => 'required|string|max:64|unique:topology_baselines,name',
            'topology_file'  => 'required|file|mimes:json,csv|max:1024',
        ];
    }
}
```

### 7. Events

#### `app/Events/NetworkScanCompleted.php`
```php
namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NetworkScanCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
    
    public function __construct(
        public int $sessionId,
        public int $deviceCount,
        public int $findingsCount,
    ) {}
    
    public function broadcastOn(): array
    {
        return [new Channel('router-control')];
    }
    
    public function broadcastAs(): string
    {
        return 'NetworkScanCompleted';
    }
    
    public function broadcastWith(): array
    {
        return [
            'session_id'     => $this->sessionId,
            'device_count'   => $this->deviceCount,
            'findings_count' => $this->findingsCount,
            'timestamp'      => now()->toISOString(),
        ];
    }
}
```

### 8. Config — `config/scanning.php`

```php
return [
    'rate_limit' => [
        'max'    => (int) env('SCAN_RATE_LIMIT_MAX', 10),
        'decay'  => (int) env('SCAN_RATE_LIMIT_DECAY', 3600),
    ],
    
    'nvd' => [
        'api_key' => env('NVD_API_KEY'),
        'timeout' => 10,
    ],
    
    'topology' => [
        'storage_path' => 'app/topology',
        'allowed_extensions' => ['json', 'csv'],
    ],
    
    'firmware' => [
        'default_vendor'  => 'huawei',
        'default_product' => 'hg8145x6',
    ],
];
```

### 9. Dashboard UI — Additions to `resources/views/dashboard.blade.php`

Add a new `.full-width` card section between the existing Network Status card and Activity Log. The section contains three sub-sections: **Scan Control**, **Vulnerability Findings**, and **Topology Status**.

#### HTML Structure (added inside `<div class="container">`):

```html
{{-- Network Security Scan Card --}}
<div class="card full-width">
    <div class="network-header">
        <div class="card-title" style="margin-bottom:0">
            Network Security Scan
            <span class="badge badge-blue" id="scanStatusBadge">Idle</span>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn-scan" id="btnPassiveScan" onclick="startPassiveScan()">
                <span class="spinner"></span>
                <span class="btn-text">Passive Scan</span>
            </button>
            <button class="btn-scan" id="btnFullScan" onclick="startFullScan()" style="background:linear-gradient(135deg,#7c3aed,#6d28d9)">
                <span class="spinner"></span>
                <span class="btn-text">Full Audit</span>
            </button>
        </div>
    </div>
    
    {{-- Scan Summary Grid --}}
    <div class="network-grid" id="scanSummary">
        <div class="network-item">
            <div class="label">Devices Found</div>
            <div class="value" id="scanDeviceCount">--</div>
        </div>
        <div class="network-item">
            <div class="label">Critical Vulnerabilities</div>
            <div class="value" style="color:#f87171" id="scanCriticalCount">--</div>
        </div>
        <div class="network-item">
            <div class="label">Unknown Devices</div>
            <div class="value" style="color:#fbbf24" id="scanUnknownCount">--</div>
        </div>
        <div class="network-item">
            <div class="label">Missing Devices</div>
            <div class="value" style="color:#fb923c" id="scanMissingCount">--</div>
        </div>
    </div>
    
    {{-- Vulnerability Findings Table --}}
    <div id="vulnerabilitySection" style="display:none">
        <div class="card-title" style="margin-top:24px;margin-bottom:12px">
            Vulnerability Findings
            <span class="badge" style="background:#450a0a;color:#f87171" id="vulnCountBadge">0</span>
        </div>
        <div id="vulnContainer"></div>
    </div>
    
    {{-- Topology Deviations --}}
    <div id="topologySection" style="display:none">
        <div class="card-title" style="margin-top:24px;margin-bottom:12px">
            Topology Deviations
            <span class="badge" style="background:#422006;color:#fbbf24" id="topoCountBadge">0</span>
        </div>
        <div id="topoContainer"></div>
    </div>
    
    {{-- Topology Upload --}}
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155">
        <div class="card-title" style="margin-bottom:12px">Upload Topology Baseline</div>
        <form id="topoForm" onsubmit="return uploadTopology(event)" style="display:flex;gap:12px;align-items:flex-end">
            <div class="form-group" style="flex:1;margin-bottom:0">
                <label>Baseline Name</label>
                <input type="text" id="topoName" placeholder="e.g., home-network" required>
            </div>
            <div class="form-group" style="flex:2;margin-bottom:0">
                <label>JSON or CSV File</label>
                <input type="file" id="topoFile" accept=".json,.csv" required
                    style="padding:10px;background:#0f172a;border:1px solid #334155;border-radius:10px;color:#f1f5f9;font-size:13px">
            </div>
            <button type="submit" class="btn-save" style="width:auto;padding:12px 24px" id="btnTopoUpload">Upload</button>
        </form>
        <div id="topoBaselines" style="margin-top:12px"></div>
    </div>
</div>
```

#### CSS Additions (inline in `<style>` block):

```css
/* Scan severity colors */
.severity-critical { background: #450a0a; color: #f87171; }
.severity-high { background: #431407; color: #fb923c; }
.severity-medium { background: #422006; color: #fbbf24; }
.severity-low { background: #14532d; color: #4ade80; }
.severity-info { background: #1e3a5f; color: #60a5fa; }

/* Deviation types */
.deviation-unknown_device { background: #450a0a; color: #f87171; }
.deviation-missing_device { background: #422006; color: #fbbf24; }
.deviation-ip_conflict { background: #431407; color: #fb923c; }

/* Scan progress */
.scan-progress { height: 3px; background: #334155; border-radius: 2px; margin: 12px 0; overflow: hidden; }
.scan-progress-bar { height: 100%; background: linear-gradient(90deg, #2563eb, #7c3aed); width: 0%; transition: width 0.5s ease; }

/* Finding rows */
.finding-row { display: flex; align-items: center; gap: 12px; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 10px; margin-bottom: 8px; }
.finding-row .severity-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; white-space: nowrap; }
.finding-row .finding-detail { flex: 1; }
.finding-row .finding-title { font-size: 13px; font-weight: 600; color: #f1f5f9; }
.finding-row .finding-meta { font-size: 11px; color: #64748b; margin-top: 2px; }
```

#### JavaScript Additions:

```javascript
// --- Network Security Scan ---
async function startPassiveScan() {
    await runScan({ scan_type: 'passive', sources: ['arp', 'dhcp'] });
}

async function startFullScan() {
    // Prompt for firmware version
    const fw = prompt('Enter firmware version (e.g., V300R015C10):');
    if (!fw) return;
    
    await runScan({
        scan_type: 'full',
        sources: ['arp', 'dhcp'],
        firmware_version: fw,
        vendor: 'huawei',
        product: 'hg8145x6',
    });
}

async function runScan(config) {
    const btn = document.getElementById(config.scan_type === 'full' ? 'btnFullScan' : 'btnPassiveScan');
    const btnText = btn.querySelector('.btn-text');
    btn.disabled = true;
    btn.classList.add('loading');
    btnText.textContent = 'Scanning...';
    document.getElementById('scanStatusBadge').textContent = 'Running...';
    
    try {
        const res = await fetch(`${API_BASE}/scan/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(config),
        });
        const data = await res.json();
        
        if (data.success) {
            showToast('Scan completed successfully!');
            renderScanResults(data.session);
            refreshLogs();
        } else {
            showToast(data.message || 'Scan failed.', 'error');
        }
    } catch (err) {
        showToast('Connection error: ' + err.message, 'error');
    }
    
    btn.disabled = false;
    btn.classList.remove('loading');
    btnText.textContent = config.scan_type === 'full' ? 'Full Audit' : 'Passive Scan';
}

function renderScanResults(session) {
    const badge = document.getElementById('scanStatusBadge');
    badge.textContent = `Completed ${new Date(session.completed_at).toLocaleTimeString()}`;
    badge.className = 'badge badge-green';
    
    document.getElementById('scanDeviceCount').textContent = session.discovered_devices?.length || 0;
    
    const vulns = session.vulnerability_findings || [];
    const critical = vulns.filter(v => v.severity === 'critical').length;
    const high = vulns.filter(v => v.severity === 'high').length;
    document.getElementById('scanCriticalCount').textContent = critical;
    document.getElementById('scanCriticalCount').nextElementSibling;
    
    const deviants = session.topology_deviations || [];
    document.getElementById('scanUnknownCount').textContent = deviants.filter(d => d.deviation_type === 'unknown_device').length;
    document.getElementById('scanMissingCount').textContent = deviants.filter(d => d.deviation_type === 'missing_device').length;
    
    // Render vulnerabilities
    const vulnSection = document.getElementById('vulnerabilitySection');
    const vulnContainer = document.getElementById('vulnContainer');
    if (vulns.length > 0) {
        vulnSection.style.display = 'block';
        document.getElementById('vulnCountBadge').textContent = vulns.length;
        vulnContainer.innerHTML = vulns.map(v => `
            <div class="finding-row">
                <span class="severity-badge severity-${v.severity}">${v.severity}</span>
                <div class="finding-detail">
                    <div class="finding-title">${v.cve_id} — ${v.description?.substring(0, 80) || 'No description'}</div>
                    <div class="finding-meta">CVSS ${v.cvss_score || 'N/A'} · ${v.affected_component} · ${v.source}</div>
                </div>
            </div>
        `).join('');
    } else {
        vulnSection.style.display = 'none';
    }
    
    // Render topology deviations
    const topoSection = document.getElementById('topologySection');
    const topoContainer = document.getElementById('topoContainer');
    if (deviants.length > 0) {
        topoSection.style.display = 'block';
        document.getElementById('topoCountBadge').textContent = deviants.length;
        topoContainer.innerHTML = deviants.map(d => `
            <div class="finding-row">
                <span class="severity-badge deviation-${d.deviation_type}">${d.deviation_type.replace('_', ' ')}</span>
                <div class="finding-detail">
                    <div class="finding-title">${d.details?.message || d.deviation_type}</div>
                    <div class="finding-meta">${JSON.stringify(d.details?.device || d.details?.ip || '').substring(0, 80)}</div>
                </div>
            </div>
        `).join('');
    } else {
        topoSection.style.display = 'none';
    }
}

// --- Topology Upload ---
async function uploadTopology(e) {
    e.preventDefault();
    const name = document.getElementById('topoName').value;
    const file = document.getElementById('topoFile').files[0];
    if (!name || !file) return;
    
    const formData = new FormData();
    formData.append('name', name);
    formData.append('topology_file', file);
    
    const btn = document.getElementById('btnTopoUpload');
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    
    try {
        const res = await fetch(`${API_BASE}/scan/topology/upload`, {
            method: 'POST',
            headers: { 'Accept': 'application/json' },
            body: formData,
        });
        const data = await res.json();
        if (data.success) {
            showToast('Topology baseline uploaded!');
            document.getElementById('topoForm').reset();
            refreshBaselines();
        } else {
            showToast(data.message || 'Upload failed.', 'error');
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
    
    btn.disabled = false;
    btn.textContent = 'Upload';
    return false;
}

async function refreshBaselines() {
    try {
        const res = await fetch(`${API_BASE}/scan/topology/baselines`, { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        const container = document.getElementById('topoBaselines');
        if (!data.data?.length) {
            container.innerHTML = '<span style="color:#475569;font-size:12px">No baselines uploaded.</span>';
            return;
        }
        container.innerHTML = data.data.map(b => `
            <div style="display:flex;justify-content:space-between;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:6px;font-size:12px">
                <span style="color:#f1f5f9;font-weight:600">${b.name}</span>
                <span style="color:#64748b">${b.filename} · ${new Date(b.created_at).toLocaleDateString()}</span>
            </div>
        `).join('');
    } catch {}
}

// Auto-load dashboard data and baselines
async function loadScanDashboard() {
    try {
        const res = await fetch(`${API_BASE}/scan/dashboard`, { headers: { 'Accept': 'application/json' } });
        const data = await res.json();
        if (data.data?.latest_scan) {
            renderScanResults(data.data.latest_scan);
        }
        // Update rate limit info
        if (data.data?.rate_limit) {
            document.getElementById('scanStatusBadge').textContent = `${data.data.rate_limit.remaining} scans remaining`;
        }
    } catch {}
}

loadScanDashboard();
refreshBaselines();
```

### 10. Topology File Format

#### JSON format (`home-network.json`):
```json
{
  "network_name": "Home Network",
  "devices": [
    {
      "name": "Router",
      "mac_address": "AA:BB:CC:DD:EE:FF",
      "ip_address": "192.168.1.1",
      "device_type": "router",
      "expected": true
    },
    {
      "name": "Work Laptop",
      "mac_address": "11:22:33:44:55:66",
      "ip_address": "192.168.1.100",
      "device_type": "laptop",
      "expected": true
    },
    {
      "name": "Smart TV",
      "mac_address": "AA:11:BB:22:CC:33",
      "ip_address": "192.168.1.50",
      "device_type": "iot",
      "expected": true
    }
  ]
}
```

#### CSV format (`home-network.csv`):
```csv
name,mac_address,ip_address,device_type
Router,AA:BB:CC:DD:EE:FF,192.168.1.1,router
Work Laptop,11:22:33:44:55:66,192.168.1.100,laptop
Smart TV,AA:11:BB:22:CC:33,192.168.1.50,iot
```

Storage path: `storage/app/topology/` (create directory, add to `.gitignore`)

### 11. Rate Limiting

Register the rate limiter in `AppServiceProvider::boot()`:

```php
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

public function boot(): void
{
    RateLimiter::for('network-scan', function (Request $request) {
        return Limit::perMinute(
            config('scanning.rate_limit.max', 10)
        )->by(
            $request->user()?->id ?? $request->ip()
        );
    });
}
```

The `NetworkScanController` uses this via the `RateLimiter` facade directly (not middleware) to return a custom 429 response with `retry_after`.

### 12. Migration File

**File**: `database/migrations/2026_07_15_000002_create_network_scanning_tables.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('scan_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('scan_type');
            $table->string('status')->default('pending');
            $table->text('parameters')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('discovered_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
            $table->string('ip_address');
            $table->string('mac_address');
            $table->string('hostname')->nullable();
            $table->string('manufacturer')->nullable();
            $table->string('device_type')->nullable();
            $table->string('os_fingerprint')->nullable();
            $table->string('connection_type');
            $table->timestamps();
            $table->index(['scan_session_id', 'ip_address']);
            $table->index(['scan_session_id', 'mac_address']);
        });

        Schema::create('vulnerability_findings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
            $table->string('cve_id');
            $table->string('severity');
            $table->text('description');
            $table->text('affected_component');
            $table->text('remediation')->nullable();
            $table->decimal('cvss_score', 3, 1)->nullable();
            $table->string('source');
            $table->timestamps();
            $table->index(['scan_session_id', 'severity']);
        });

        Schema::create('topology_baselines', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('filename');
            $table->string('file_hash');
            $table->text('expected_devices');
            $table->text('expected_topology')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('topology_deviations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('scan_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('topology_baseline_id')->constrained()->cascadeOnDelete();
            $table->string('deviation_type');
            $table->text('details');
            $table->string('severity');
            $table->timestamps();
            $table->index(['scan_session_id', 'deviation_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('topology_deviations');
        Schema::dropIfExists('topology_baselines');
        Schema::dropIfExists('vulnerability_findings');
        Schema::dropIfExists('discovered_devices');
        Schema::dropIfExists('scan_sessions');
    }
};
```

### 13. File Structure Summary

```
app/
├── Events/
│   ├── NetworkScanCompleted.php          (NEW)
│   └── RouterActionTriggered.php         (existing)
├── Http/
│   ├── Controllers/
│   │   ├── NetworkScanController.php     (NEW)
│   │   └── RouterController.php          (existing)
│   └── Requests/
│       ├── StartScanRequest.php          (NEW)
│       └── UploadTopologyRequest.php     (NEW)
├── Models/
│   ├── DiscoveredDevice.php              (NEW)
│   ├── ScanSession.php                   (NEW)
│   ├── TopologyBaseline.php              (NEW)
│   ├── TopologyDeviation.php             (NEW)
│   └── VulnerabilityFinding.php          (NEW)
├── Providers/
│   └── AppServiceProvider.php            (MODIFIED — add rate limiter)
└── Services/
    └── NetworkScanner/
        ├── ArpTableScanner.php           (NEW)
        ├── DhcpLogParser.php             (NEW)
        ├── FirmwareVersionChecker.php    (NEW)
        ├── ScanOrchestrator.php          (NEW)
        └── TopologyVerifier.php          (NEW)

config/
└── scanning.php                          (NEW)

database/migrations/
└── 2026_07_15_000002_create_network_scanning_tables.php  (NEW)

resources/views/
└── dashboard.blade.php                   (MODIFIED — add scan section)

routes/
└── api.php                               (MODIFIED — add scan routes)

storage/app/
└── topology/                             (NEW — directory for baseline files)
```

### 14. Testing Approach

#### Unit Tests
- `tests/Unit/Services/ArpTableScannerTest.php` — test ARP file parsing with fixture data
- `tests/Unit/Services/DhcpLogParserTest.php` — test DHCP lease parsing
- `tests/Unit/Services/TopologyVerifierTest.php` — test deviation detection logic
- `tests/Unit/Services/FirmwareVersionCheckerTest.php` — test version comparison logic (mock NVD API)

#### Feature Tests
- `tests/Feature/NetworkScanTest.php`:
  - `test_start_scan_creates_session` — POST /api/scan/start creates a ScanSession
  - `test_rate_limit_blocks_excess_scans` — 11th scan in an hour returns 429
  - `test_topology_upload_validates_json_and_csv` — accepts .json/.csv, rejects .txt
  - `test_topology_upload_rejects_duplicate_names` — unique constraint on name
  - `test_get_results_returns_full_session` — GET /api/scan/results/{id} includes all relations
  - `test_get_history_returns_recent_sessions` — GET /api/scan/history limits to 20
  - `test_scan_with_topology_comparison_flags_deviations` — upload baseline, run scan, check deviations
  - `test_scan_broadcasts_websocket_event` — NetworkScanCompleted event fires on completion

#### Test Fixtures
- `tests/fixtures/arp_table.txt` — sample /proc/net/arp output
- `tests/fixtures/dhcp_leases.conf` — sample ISC DHCP leases
- `tests/fixtures/topology.json` — valid topology JSON
- `tests/fixtures/topology.csv` — valid topology CSV
- `tests/fixtures/nvd_response.json` — mocked NVD API response

#### Running Tests
```bash
php artisan test --filter=NetworkScan
```

### 15. Decision Trace

| # | Decision | Reason | Alternatives | Tradeoff |
|---|----------|--------|-------------|----------|
| 1 | Introduced service layer despite existing controller-only pattern | Scan logic spans 4+ services; putting it in a controller would make RouterController 500+ lines | Put all logic in NetworkScanController (existing pattern) | Adds new directory structure; slightly more files to navigate |
| 2 | Synchronous scan execution instead of queued jobs | Initial implementation simplicity; scans are fast (<5s for ARP + DHCP) | Dispatch to queue with progress via WebSocket | Blocks HTTP request; won't scale for large networks |
| 3 | NVD API with env-configurable key | NVD rate-limits unauthenticated requests to 5 requests/30s; API key gives 50 requests/30s | Hardcode key, skip NVD entirely | Key management overhead; key exposure risk if .env committed |
| 4 | Topology files on disk, not database | Users edit these manually; files can be large; git-trackable | Store parsed data in DB only | Disk reads on each verification; need to handle file encoding |
| 5 | Rate limiting via facade, not middleware | Need custom 429 response body with retry_after; middleware gives generic response | Use throttle middleware | Duplicates rate limit check logic; middleware would be simpler |
| 6 | User ID nullable on scan_sessions | Project has no auth yet; allow IP-based rate limiting as fallback | Require auth (block all scans without login) | Less secure; IP spoofing behind proxies |
| 7 | Broadcast events on existing `router-control` channel | Dashboard already subscribes to this channel; no frontend changes needed for WebSocket | Create separate `scan-events` channel | Mixes concerns on one channel; may cause confusion at scale |
| 8 | Topology baseline unique by name | Users typically have 2-3 baselines (home, office, test); name is natural identifier | Use file hash as primary key | Name collision requires user intervention; hash is opaque |
| 9 | Dashboard additions inline in existing blade file | Project uses self-contained blade with inline CSS/JS; no build toolchain exists | Extract to separate component files | Blade file grows; harder to diff |
| 10 | CVSS score stored as DECIMAL(3,1) | CVSS v3 scores range 0.0-10.0; one decimal precision is standard | Store as string or integer (multiply by 10) | Loses comparison flexibility; string comparison is lexicographic |
