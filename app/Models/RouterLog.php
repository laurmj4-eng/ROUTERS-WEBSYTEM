<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RouterLog extends Model
{
    protected $fillable = [
        'action_type',
        'payload',
        'status',
        'triggered_by',
    ];
}
