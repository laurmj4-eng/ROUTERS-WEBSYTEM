<?php

namespace App\Jobs;

use App\Models\ScheduledScan;
use App\Models\ScanSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class ScheduledScanJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $timeout = 60;

    public function handle(): void
    {
        $dueSchedules = ScheduledScan::due()->get();

        foreach ($dueSchedules as $schedule) {
            $session = ScanSession::create([
                'user_id' => $schedule->user_id,
                'scan_type' => $schedule->scan_config['scan_type'] ?? 'passive',
                'status' => 'pending',
                'parameters' => $schedule->scan_config,
            ]);

            ScanJob::dispatch($session, $schedule->scan_config);

            $schedule->update([
                'last_run_at' => now(),
                'next_run_at' => $this->calculateNextRun($schedule->frequency),
            ]);
        }
    }

    private function calculateNextRun(string $frequency): \Illuminate\Support\Carbon
    {
        return match ($frequency) {
            'hourly' => now()->addHour(),
            'daily' => now()->addDay(),
            'weekly' => now()->addWeek(),
            'monthly' => now()->addMonth(),
            default => now()->addDay(),
        };
    }
}
