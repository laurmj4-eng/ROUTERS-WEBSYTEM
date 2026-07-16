<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WifiPassword extends Model
{
    protected $fillable = [
        'ssid',
        'password',
        'band',
        'router_ip',
        'encryption',
        'authentication',
        'scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'scanned_at' => 'datetime',
        ];
    }
}
