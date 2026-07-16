<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ScanProgressUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $sessionId,
        public string $phase,
        public int $progress,
        public int $completedTasks,
        public int $totalTasks,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('scan-progress.' . $this->sessionId)];
    }

    public function broadcastAs(): string
    {
        return 'ScanProgressUpdated';
    }

    public function broadcastWith(): array
    {
        return [
            'session_id' => $this->sessionId,
            'phase' => $this->phase,
            'progress' => $this->progress,
            'completed_tasks' => $this->completedTasks,
            'total_tasks' => $this->totalTasks,
            'timestamp' => now()->toISOString(),
        ];
    }
}
