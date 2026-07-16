<?php

use App\Jobs\ScheduledPasswordRotationJob;
use App\Jobs\ScheduledScanJob;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::job(new ScheduledScanJob)->everyMinute();
Schedule::job(new ScheduledPasswordRotationJob)->everyMinute();
