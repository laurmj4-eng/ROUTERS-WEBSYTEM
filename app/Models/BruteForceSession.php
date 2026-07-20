<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BruteForceSession extends Model
{
    protected $fillable = [
        'ssid', 'status', 'total', 'current_index', 'current_password',
        'last_state', 'speed_per_min', 'eta_minutes', 'percent',
        'elapsed_seconds', 'found_password', 'found_ip', 'wordlist_name',
        'error', 'started_at', 'completed_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
}
