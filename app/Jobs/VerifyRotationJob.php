<?php

namespace App\Jobs;

use App\Models\RotationLog;
use App\Models\RouterCredential;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class VerifyRotationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $timeout = 60;

    public int $tries = 1;

    public function __construct(
        public int $credentialId,
        public int $logId,
    ) {
        $this->onQueue('scans');
    }

    public function handle(): void
    {
        $credential = RouterCredential::findOrFail($this->credentialId);

        if ($credential->status !== 'pending') {
            return;
        }

        $credential->markFailed('Agent verification timed out after 5 minutes');

        RotationLog::create([
            'router_credential_id' => $credential->id,
            'action' => 'verification_failed',
            'details' => ['reason' => 'timeout', 'checked_at' => now()->toISOString()],
            'status' => 'failure',
        ]);

        try {
            $credential->rollback();
            RotationLog::create([
                'router_credential_id' => $credential->id,
                'action' => 'rollback',
                'details' => ['reason' => 'timeout_auto_rollback'],
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
