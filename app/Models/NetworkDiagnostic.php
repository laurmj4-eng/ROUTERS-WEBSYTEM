<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NetworkDiagnostic extends Model
{
    protected $fillable = [
        'original_ssid',
        'target_ssid',
        'target_url',
        'wifi_connected',
        'ip_address',
        'url_reachable',
        'page_title',
        'page_content_snippet',
        'error',
    ];

    protected $casts = [
        'wifi_connected' => 'boolean',
        'url_reachable' => 'boolean',
    ];
}
