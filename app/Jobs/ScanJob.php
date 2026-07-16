<?php

namespace App\Jobs;

use App\Models\ScanSession;
use App\Services\NetworkScanner\ScanOrchestrator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ScanJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout = 300;

    public function __construct(
        public ScanSession $session,
        public array $config,
    ) {
        $this->onQueue('scans');
    }

    public function handle(ScanOrchestrator $orchestrator): void
    {
        $this->session->update([
            'job_id' => $this->job->getJobId(),
            'status' => 'running',
            'started_at' => now(),
        ]);

        $orchestrator->execute($this->session, $this->config);
    }

    public function failed(\Throwable $exception): void
    {
        $this->session->update([
            'status' => 'failed',
            'error_message' => $exception->getMessage(),
            'completed_at' => now(),
        ]);
    }
}
