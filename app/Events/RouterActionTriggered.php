<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RouterActionTriggered implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $logId,
        public string $action,
        public ?array $parameters = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('router-control')];
    }

    public function broadcastAs(): string
    {
        return 'RouterActionTriggered';
    }

    public function broadcastWith(): array
    {
        return [
            'log_id'     => $this->logId,
            'action'     => $this->action,
            'parameters' => $this->parameters,
            'timestamp'  => now()->toISOString(),
        ];
    }
}
