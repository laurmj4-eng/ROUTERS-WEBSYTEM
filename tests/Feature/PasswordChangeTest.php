<?php

namespace Tests\Feature;

use App\Events\RouterActionTriggered;
use App\Models\RouterLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class PasswordChangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_password_change_returns_success(): void
    {
        $response = $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'MyNewPass123!',
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'message' => 'Password change command dispatched.',
            ])
            ->assertJsonStructure(['log_id', 'timestamp']);
    }

    public function test_password_change_validates_min_length(): void
    {
        $response = $this->postJson('/api/router/password', [
            'new_password' => 'short',
            'new_password_confirmation' => 'short',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_password_change_validates_max_length(): void
    {
        $longPassword = str_repeat('A', 64);

        $response = $this->postJson('/api/router/password', [
            'new_password' => $longPassword,
            'new_password_confirmation' => $longPassword,
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_password_change_requires_confirmation(): void
    {
        $response = $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_password_change_confirmation_must_match(): void
    {
        $response = $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'DifferentPass456!',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_password_change_requires_new_password(): void
    {
        $response = $this->postJson('/api/router/password', []);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['new_password']);
    }

    public function test_password_change_creates_router_log(): void
    {
        $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'MyNewPass123!',
        ]);

        $this->assertDatabaseHas('router_logs', [
            'action_type' => 'password_change',
            'status' => 'pending',
        ]);
    }

    public function test_password_change_log_has_pending_status(): void
    {
        $response = $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'MyNewPass123!',
        ]);

        $logId = $response->json('log_id');
        $log = RouterLog::findOrFail($logId);

        $this->assertEquals('pending', $log->status);
        $this->assertEquals('password_change', $log->action_type);
    }

    public function test_password_change_logs_triggered_by_ip(): void
    {
        $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'MyNewPass123!',
        ]);

        $log = RouterLog::latest()->first();

        $this->assertEquals(request()->ip(), $log->triggered_by);
    }

    public function test_password_change_broadcasts_event(): void
    {
        Event::fake([RouterActionTriggered::class]);

        $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'MyNewPass123!',
        ]);

        Event::assertDispatched(RouterActionTriggered::class, function ($event) {
            return $event->action === 'password_change'
                && isset($event->parameters['new_password'])
                && $event->parameters['new_password'] === 'MyNewPass123!';
        });
    }

    public function test_password_change_returns_timestamp(): void
    {
        $response = $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'MyNewPass123!',
        ]);

        $response->assertJsonStructure(['timestamp']);
        $this->assertIsString($response->json('timestamp'));
    }

    public function test_status_update_changes_log_status(): void
    {
        $log = RouterLog::create([
            'action_type' => 'password_change',
            'payload' => 'test_password',
            'status' => 'pending',
            'triggered_by' => '127.0.0.1',
        ]);

        $response = $this->patchJson("/api/router/log/{$log->id}/status", [
            'status' => 'success',
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'status' => 'success',
            ]);

        $this->assertDatabaseHas('router_logs', [
            'id' => $log->id,
            'status' => 'success',
        ]);
    }

    public function test_status_update_to_failed(): void
    {
        $log = RouterLog::create([
            'action_type' => 'password_change',
            'payload' => 'test_password',
            'status' => 'pending',
            'triggered_by' => '127.0.0.1',
        ]);

        $response = $this->patchJson("/api/router/log/{$log->id}/status", [
            'status' => 'failed',
        ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'status' => 'failed',
            ]);

        $this->assertDatabaseHas('router_logs', [
            'id' => $log->id,
            'status' => 'failed',
        ]);
    }

    public function test_status_update_invalid_status_rejected(): void
    {
        $log = RouterLog::create([
            'action_type' => 'password_change',
            'payload' => 'test_password',
            'status' => 'pending',
            'triggered_by' => '127.0.0.1',
        ]);

        $response = $this->patchJson("/api/router/log/{$log->id}/status", [
            'status' => 'invalid_status',
        ]);

        $response->assertUnprocessable()
            ->assertJsonValidationErrors(['status']);
    }

    public function test_status_update_returns_timestamp(): void
    {
        $log = RouterLog::create([
            'action_type' => 'password_change',
            'payload' => 'test_password',
            'status' => 'pending',
            'triggered_by' => '127.0.0.1',
        ]);

        $response = $this->patchJson("/api/router/log/{$log->id}/status", [
            'status' => 'success',
        ]);

        $response->assertJsonStructure(['timestamp']);
    }

    public function test_password_change_returns_log_id(): void
    {
        $response = $this->postJson('/api/router/password', [
            'new_password' => 'MyNewPass123!',
            'new_password_confirmation' => 'MyNewPass123!',
        ]);

        $logId = $response->json('log_id');
        $this->assertDatabaseHas('router_logs', ['id' => $logId]);
    }

    public function test_password_change_appends_special_character_if_missing(): void
    {
        Event::fake([RouterActionTriggered::class]);

        $response = $this->postJson('/api/router/password', [
            'new_password' => 'Admin1234',
            'new_password_confirmation' => 'Admin1234',
        ]);

        $response->assertOk();

        $this->assertDatabaseHas('router_logs', [
            'action_type' => 'password_change',
            'payload' => 'Admin1234!',
        ]);

        Event::assertDispatched(RouterActionTriggered::class, function ($event) {
            return $event->action === 'password_change'
                && isset($event->parameters['new_password'])
                && $event->parameters['new_password'] === 'Admin1234!';
        });
    }
}
