<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Crypt;

class RouterCredential extends Model
{
    protected $fillable = [
        'username',
        'password',
        'previous_password',
        'encrypted_password',
        'encrypted_previous_password',
        'router_ip',
        'status',
        'last_rotation_result',
        'scheduled_at',
        'last_rotated_at',
        'rotation_count',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'last_rotated_at' => 'datetime',
            'last_rotation_result' => 'array',
            'rotation_count' => 'integer',
        ];
    }

    public function getPasswordAttribute(): ?string
    {
        return $this->encrypted_password
            ? Crypt::decryptString($this->encrypted_password)
            : null;
    }

    public function getPreviousPasswordAttribute(): ?string
    {
        return $this->encrypted_previous_password
            ? Crypt::decryptString($this->encrypted_previous_password)
            : null;
    }

    public function setPasswordAttribute(string $value): void
    {
        $this->attributes['encrypted_password'] = Crypt::encryptString($value);
    }

    public function setPreviousPasswordAttribute(?string $value): void
    {
        $this->attributes['encrypted_previous_password'] = $value
            ? Crypt::encryptString($value)
            : null;
    }

    public function rotateTo(string $newPassword): void
    {
        $this->previous_password = $this->password;
        $this->password = $newPassword;
        $this->status = 'pending';
        $this->rotation_count = $this->rotation_count + 1;
        $this->save();
    }

    public function markVerified(): void
    {
        $this->status = 'active';
        $this->encrypted_previous_password = null;
        $this->last_rotated_at = now();
        $this->last_rotation_result = [
            'success' => true,
            'verified_at' => now()->toISOString(),
        ];
        $this->save();
    }

    public function markFailed(string $reason): void
    {
        $this->last_rotation_result = [
            'success' => false,
            'message' => $reason,
            'failed_at' => now()->toISOString(),
        ];
        $this->save();
    }

    public function rollback(): void
    {
        $previous = $this->previous_password;
        if (! $previous) {
            throw new \RuntimeException('No previous password available for rollback');
        }

        $this->password = $previous;
        $this->status = 'active';
        $this->encrypted_previous_password = null;
        $this->last_rotation_result = [
            'success' => false,
            'message' => 'Rolled back to previous password',
            'rolled_back_at' => now()->toISOString(),
        ];
        $this->save();
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeDueForRotation($query)
    {
        return $query->where('status', 'active')
            ->where('scheduled_at', '<=', now());
    }

    public function logs(): HasMany
    {
        return $this->hasMany(RotationLog::class);
    }
}
