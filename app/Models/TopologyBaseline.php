<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TopologyBaseline extends Model
{
    use HasFactory;
    protected $fillable = [
        'name',
        'filename',
        'file_hash',
        'expected_devices',
        'expected_topology',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'expected_devices' => 'array',
            'expected_topology' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
