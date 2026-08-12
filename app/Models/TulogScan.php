<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TulogScan extends Model
{
    protected $fillable = [
        'log_id',
        'original_ssid',
        'target_ssid',
        'status',
        'connected',
        'bssid',
        'signal',
        'band',
        'ip_address',
        'gateway',
        'gateway_mac',
        'ports_open',
        'http_probes',
        'devices_found',
        'beacon_analysis',
        'restore_status',
        'error',
        'duration_ms',
    ];

    protected $casts = [
        'connected'      => 'boolean',
        'signal'         => 'integer',
        'ports_open'     => 'array',
        'http_probes'    => 'array',
        'devices_found'  => 'array',
        'beacon_analysis'=> 'array',
        'duration_ms'    => 'integer',
    ];
}
