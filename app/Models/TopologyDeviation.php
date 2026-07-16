<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TopologyDeviation extends Model
{
    use HasFactory;
    protected $fillable = [
        'scan_session_id',
        'topology_baseline_id',
        'deviation_type',
        'details',
        'severity',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }

    public function scanSession(): BelongsTo
    {
        return $this->belongsTo(ScanSession::class);
    }

    public function topologyBaseline(): BelongsTo
    {
        return $this->belongsTo(TopologyBaseline::class);
    }
}
