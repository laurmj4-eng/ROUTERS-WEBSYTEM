<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RouterStatus extends Model
{
    protected $table = 'router_status';

    protected $fillable = [
        'wifi_name_2g',
        'wifi_password_2g',
        'wifi_name_5g',
        'wifi_password_5g',
        'connection_status',
        'total_connected_devices',
        'last_scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'last_scanned_at' => 'datetime',
            'total_connected_devices' => 'integer',
        ];
    }
}
