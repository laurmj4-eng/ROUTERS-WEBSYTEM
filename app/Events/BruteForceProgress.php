<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BruteForceProgress implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $sessionId,
        public array $progress,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('router-control')];
    }

    public function broadcastAs(): string
    {
        return 'BruteForceProgress';
    }

    public function broadcastWith(): array
    {
        return [
            'session_id' => $this->sessionId,
            'progress'   => $this->progress,
            'timestamp'  => now()->toISOString(),
        ];
    }
}
