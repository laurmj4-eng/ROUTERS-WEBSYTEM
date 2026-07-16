<?php

namespace App\Jobs;

use App\Events\PasswordRotationRequested;
use App\Models\RotationLog;
use App\Models\RouterCredential;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PasswordRotationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 300;

    public int $tries = 1;

    public function __construct(
        public int $credentialId,
        public bool $force = false,
    ) {
        $this->onQueue('scans');
    }

    public function handle(): void
    {
        $credential = RouterCredential::findOrFail($this->credentialId);

        if (! $this->force && $credential->status === 'pending') {
            return;
        }

        $newPassword = $this->generatePassword();

        $log = RotationLog::create([
            'router_credential_id' => $credential->id,
            'action' => 'generated',
            'details' => [
                'old_status' => $credential->status,
                'new_status' => 'pending',
                'rotation_count' => $credential->rotation_count + 1,
            ],
            'status' => 'success',
        ]);

        $credential->rotateTo($newPassword);

        PasswordRotationRequested::dispatch($credential, $newPassword, $log->id);

        $log->update(['action' => 'broadcast_sent']);

        dispatch(new VerifyRotationJob($credential->id, $log->id))
            ->delay(now()->addMinutes(5));
    }

    private function generatePassword(): string
    {
        $length = config('router.password_rotation.min_length', 12);
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=';

        do {
            $password = '';
            for ($i = 0; $i < $length; $i++) {
                $password .= $chars[random_int(0, strlen($chars) - 1)];
            }
        } while (
            ! preg_match('/[A-Z]/', $password) ||
            ! preg_match('/[a-z]/', $password) ||
            ! preg_match('/[0-9]/', $password) ||
            ! preg_match('/[^A-Za-z0-9]/', $password)
        );

        return $password;
    }
}
