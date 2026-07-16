<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NetworkScanCompleted implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $sessionId,
        public int $deviceCount,
        public int $findingsCount,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('router-control')];
    }

    public function broadcastAs(): string
    {
        return 'NetworkScanCompleted';
    }

    public function broadcastWith(): array
    {
        return [
            'session_id' => $this->sessionId,
            'device_count' => $this->deviceCount,
            'findings_count' => $this->findingsCount,
            'timestamp' => now()->toISOString(),
        ];
    }
}
