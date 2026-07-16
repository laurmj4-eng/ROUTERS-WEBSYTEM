<?php

namespace App\Jobs;

use App\Models\RouterCredential;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

class ScheduledPasswordRotationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $timeout = 60;

    public function __construct()
    {
        $this->onQueue('scans');
    }

    public function handle(): void
    {
        if (! config('router.password_rotation.enabled', false)) {
            return;
        }

        $credentials = RouterCredential::dueForRotation()->get();

        foreach ($credentials as $credential) {
            dispatch(new PasswordRotationJob($credential->id));
        }
    }
}
