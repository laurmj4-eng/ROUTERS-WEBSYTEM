<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ScanSession extends Model
{
    use HasFactory;
    protected $fillable = [
        'user_id',
        'scan_type',
        'status',
        'parameters',
        'error_message',
        'progress',
        'total_tasks',
        'completed_tasks',
        'current_phase',
        'job_id',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'parameters' => 'array',
            'progress' => 'integer',
            'total_tasks' => 'integer',
            'completed_tasks' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function discoveredDevices(): HasMany
    {
        return $this->hasMany(DiscoveredDevice::class);
    }

    public function vulnerabilityFindings(): HasMany
    {
        return $this->hasMany(VulnerabilityFinding::class);
    }

    public function topologyDeviations(): HasMany
    {
        return $this->hasMany(TopologyDeviation::class);
    }
}
