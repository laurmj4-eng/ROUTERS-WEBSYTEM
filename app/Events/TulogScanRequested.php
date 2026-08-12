<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TulogScanRequested implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $logId,
        public ?string $ssid = null,
        public ?string $restoreSsid = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('router-control')];
    }

    public function broadcastAs(): string
    {
        return 'TulogScanRequested';
    }

    public function broadcastWith(): array
    {
        return [
            'log_id'       => $this->logId,
            'ssid'         => $this->ssid,
            'restore_ssid' => $this->restoreSsid,
            'timestamp'    => now()->toISOString(),
        ];
    }
}
