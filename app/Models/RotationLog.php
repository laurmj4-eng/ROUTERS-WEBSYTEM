<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RotationLog extends Model
{
    protected $table = 'password_rotation_logs';

    protected $fillable = [
        'router_credential_id',
        'action',
        'details',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
        ];
    }

    public function credential(): BelongsTo
    {
        return $this->belongsTo(RouterCredential::class);
    }
}
