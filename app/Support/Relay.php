<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

class Relay
{
    public const FAMILIES = ['lpb', 'adu', 'pldt'];

    public static function get(string $family): string
    {
        $url = Cache::get('relay:' . $family);

        if (is_string($url) && $url !== '') {
            return rtrim($url, '/');
        }

        return self::default($family);
    }

    public static function set(string $family, string $url): void
    {
        Cache::put('relay:' . $family, trim($url), now()->addDays(30));
    }

    public static function default(string $family): string
    {
        return rtrim((string) config('scanning.' . $family . '_url', ''), '/');
    }

    public static function isDefault(string $family): bool
    {
        $url = Cache::get('relay:' . $family);

        return ! (is_string($url) && $url !== '');
    }
}