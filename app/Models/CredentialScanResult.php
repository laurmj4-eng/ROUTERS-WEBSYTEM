<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CredentialScanResult extends Model
{
    protected $fillable = [
        'target_ip',
        'router_model',
        'vendor',
        'found_default',
        'username',
        'password',
        'credential_type',
        'credentials_tested',
        'candidates',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'found_default' => 'boolean',
            'candidates' => 'array',
        ];
    }
}
