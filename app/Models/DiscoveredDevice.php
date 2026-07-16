<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DiscoveredDevice extends Model
{
    use HasFactory;

    protected $fillable = [
        'scan_session_id',
        'ip_address',
        'mac_address',
        'hostname',
        'manufacturer',
        'device_type',
        'os_fingerprint',
        'connection_type',
    ];

    public function scanSession(): BelongsTo
    {
        return $this->belongsTo(ScanSession::class);
    }
}
