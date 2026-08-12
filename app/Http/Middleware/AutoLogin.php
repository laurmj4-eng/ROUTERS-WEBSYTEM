<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AutoLogin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (Auth::guard('web')->guest()) {
            $user = User::query()
                ->orderBy('id')
                ->first();

            if ($user !== null) {
                Auth::guard('web')->login($user);
            }
        }

        return $next($request);
    }
}