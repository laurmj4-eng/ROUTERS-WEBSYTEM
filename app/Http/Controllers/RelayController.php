<?php

namespace App\Http\Controllers;

use App\Support\Relay;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RelayController extends Controller
{
    public function get(string $family): JsonResponse
    {
        if (! in_array($family, Relay::FAMILIES, true)) {
            return response()->json(['success' => false, 'message' => 'Unknown family.'], 422);
        }

        return response()->json([
            'success' => true,
            'family'  => $family,
            'url'     => Relay::get($family) ?: Relay::default($family),
            'active'  => (bool) Relay::get($family),
        ]);
    }

    public function set(Request $request, string $family): JsonResponse
    {
        if (! in_array($family, Relay::FAMILIES, true)) {
            return response()->json(['success' => false, 'message' => 'Unknown family.'], 422);
        }

        $validated = $request->validate([
            'url' => 'nullable|string|max:255',
        ]);

        $url = trim((string) $validated['url']);

        if ($url === '') {
            Relay::set($family, '');

            return response()->json(['success' => true, 'url' => '', 'active' => false]);
        }

        if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
            return response()->json(['success' => false, 'message' => 'URL must start with http:// or https://.'], 422);
        }

        Relay::set($family, $url);

        return response()->json(['success' => true, 'url' => $url, 'active' => true]);
    }
}