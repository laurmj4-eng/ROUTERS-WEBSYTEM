<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

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

    /**
     * Verify $url looks like a real relay tunnel and answers as a phone-agent
     * (/health). Returns null when OK, or an error message. Guards against the
     * old start scripts saving cloudflared's API hostname (api.trycloudflare.com)
     * instead of the actual tunnel URL.
     */
    public static function validateRelayUrl(string $url): ?string
    {
        if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
            return 'URL must start with http:// or https://.';
        }

        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        if (in_array($host, ['api.trycloudflare.com', 'developers.cloudflare.com', 'localhost', '127.0.0.1', '::1', ''], true)) {
            return "Refused: $host is not a tunnel URL.";
        }

        try {
            $resp = Http::timeout(8)->post(rtrim($url, '/') . '/health');
            $data = $resp->json();

            if (! is_array($data) || ($data['agent'] ?? null) !== 'phone-agent') {
                return 'That URL is not a live phone-agent relay (no phone-agent /health answer). Is the relay + tunnel running?';
            }
        } catch (\Throwable $e) {
            return 'Could not reach that URL — is the relay + tunnel running? (' . $e->getMessage() . ')';
        }

        return null;
    }
}