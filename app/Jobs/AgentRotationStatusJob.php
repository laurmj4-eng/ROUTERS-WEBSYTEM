<?php

namespace App\Jobs;

use App\Models\RotationLog;
use App\Models\RouterCredential;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class AgentRotationStatusJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $timeout = 60;

    public function __construct(
        public int $credentialId,
        public string $action,
        public array $details = [],
    ) {
        $this->onQueue('scans');
    }

    public function handle(): void
    {
        $credential = RouterCredential::findOrFail($this->credentialId);

        RotationLog::create([
            'router_credential_id' => $credential->id,
            'action' => $this->action,
            'details' => $this->details,
            'status' => str_contains($this->action, 'failed') ? 'failure' : 'success',
        ]);

        match ($this->action) {
            'rotation_success' => $credential->update(['status' => 'pending']),
            'rotation_failed' => $this->handleRotationFailed($credential),
            'verified' => $credential->markVerified(),
            'verification_failed' => $this->handleVerificationFailed($credential),
            default => null,
        };
    }

    private function handleRotationFailed(RouterCredential $credential): void
    {
        $credential->markFailed($this->details['message'] ?? 'Rotation failed');
        $this->attemptRollback($credential, 'rotation_failure_auto_rollback');
    }

    private function handleVerificationFailed(RouterCredential $credential): void
    {
        $credential->markFailed($this->details['message'] ?? 'Verification failed');
        $this->attemptRollback($credential, 'verification_failure_auto_rollback');
    }

    private function attemptRollback(RouterCredential $credential, string $reason): void
    {
        try {
            $credential->rollback();
            RotationLog::create([
                'router_credential_id' => $credential->id,
                'action' => 'rollback',
                'details' => ['reason' => $reason],
                'status' => 'success',
            ]);
        } catch (\Exception $e) {
            RotationLog::create([
                'router_credential_id' => $credential->id,
                'action' => 'rollback_failed',
                'details' => ['reason' => $e->getMessage()],
                'status' => 'failure',
            ]);
        }
    }
}
