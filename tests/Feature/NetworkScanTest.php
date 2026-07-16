<?php

namespace Tests\Feature;

use App\Models\ScanSession;
use App\Models\TopologyBaseline;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class NetworkScanTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => Hash::make('password'),
        ]);

        $this->token = $this->user->createToken('test-token')->plainTextToken;
    }

    protected function authHeaders(): array
    {
        return [
            'Authorization' => "Bearer {$this->token}",
            'Accept' => 'application/json',
        ];
    }

    public function test_start_scan_creates_session(): void
    {
        $response = $this->postJson('/api/scan/start', [
            'scan_type' => 'passive',
            'sources' => ['arp'],
        ], $this->authHeaders());

        $response->assertStatus(202)
            ->assertJsonStructure([
                'success',
                'session_id',
                'message',
            ]);

        $this->assertDatabaseHas('scan_sessions', [
            'scan_type' => 'passive',
        ]);
    }

    public function test_get_results_returns_full_session(): void
    {
        $session = ScanSession::factory()->create(['user_id' => $this->user->id]);

        $response = $this->getJson("/api/scan/results/{$session->id}", $this->authHeaders());

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'id',
                    'scan_type',
                    'status',
                    'discovered_devices',
                    'vulnerability_findings',
                    'topology_deviations',
                ],
            ]);
    }

    public function test_get_history_returns_recent_sessions(): void
    {
        ScanSession::factory()->count(5)->create(['user_id' => $this->user->id]);

        $response = $this->getJson('/api/scan/history', $this->authHeaders());

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    '*' => ['id', 'scan_type', 'status'],
                ],
            ]);

        $this->assertCount(5, $response->json('data'));
    }

    public function test_topology_upload_validates_json_and_csv(): void
    {
        $jsonFile = UploadedFile::fake()->createWithContent('topology.json', file_get_contents(base_path('tests/fixtures/topology.json')));

        $response = $this->postJson('/api/scan/topology/upload', [
            'name' => 'test-network',
            'topology_file' => $jsonFile,
        ], $this->authHeaders());

        $response->assertOk()
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('topology_baselines', [
            'name' => 'test-network',
            'filename' => 'topology.json',
        ]);
    }

    public function test_topology_upload_rejects_duplicate_names(): void
    {
        TopologyBaseline::factory()->create(['name' => 'existing']);

        $jsonFile = UploadedFile::fake()->createWithContent('topology.json', file_get_contents(base_path('tests/fixtures/topology.json')));

        $response = $this->postJson('/api/scan/topology/upload', [
            'name' => 'existing',
            'topology_file' => $jsonFile,
        ], $this->authHeaders());

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);
    }

    public function test_get_dashboard_returns_summary(): void
    {
        $response = $this->getJson('/api/scan/dashboard', $this->authHeaders());

        $response->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'latest_scan',
                    'summary' => [
                        'total_devices',
                        'critical_findings',
                        'high_findings',
                        'unknown_devices',
                        'missing_devices',
                    ],
                    'stats',
                    'rate_limit' => [
                        'max',
                        'remaining',
                        'resets_at',
                    ],
                ],
            ]);
    }

    public function test_list_baselines_returns_all(): void
    {
        TopologyBaseline::factory()->count(3)->create();

        $response = $this->getJson('/api/scan/topology/baselines', $this->authHeaders());

        $response->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $response = $this->getJson('/api/scan/dashboard');
        $response->assertUnauthorized();
    }
}
