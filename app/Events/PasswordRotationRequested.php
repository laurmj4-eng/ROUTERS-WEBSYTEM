<?php

namespace App\Events;

use App\Models\RouterCredential;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PasswordRotationRequested implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public RouterCredential $credential,
        public string $newPassword,
        public int $logId,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('router-control')];
    }

    public function broadcastAs(): string
    {
        return 'PasswordRotationRequested';
    }

    public function broadcastWith(): array
    {
        return [
            'credential_id' => $this->credential->id,
            'router_ip' => $this->credential->router_ip,
            'username' => $this->credential->username,
            'new_password' => $this->newPassword,
            'log_id' => $this->logId,
            'timestamp' => now()->toISOString(),
        ];
    }
}
