<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DefaultCredentialFound implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $vendor,
        public string $model,
        public string $username,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('router-control')];
    }

    public function broadcastAs(): string
    {
        return 'DefaultCredentialFound';
    }

    public function broadcastWith(): array
    {
        return [
            'vendor' => $this->vendor,
            'model' => $this->model,
            'username' => $this->username,
            'severity' => 'critical',
            'message' => "Default credentials detected on {$this->vendor} {$this->model} (user: {$this->username})",
            'timestamp' => now()->toISOString(),
        ];
    }
}
