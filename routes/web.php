<?php

use Illuminate\Support\Facades\Route;

Route::get('/up', fn () => response()->json(['status' => 'ok']));

Route::get('/diag', function () {
    $out = ['debug' => config('app.debug'), 'driver' => config('database.default')];

    try {
        $out['users_count'] = \Illuminate\Support\Facades\DB::table('users')->count();
    } catch (\Throwable $e) {
        $out['users_error'] = $e->getMessage();
        $out['users_error_class'] = get_class($e);
    }

    try {
        $out['relay'] = \Illuminate\Support\Facades\Cache::get('relay:lpb', 'CACHE_EMPTY');
    } catch (\Throwable $e) {
        $out['cache_error'] = $e->getMessage();
    }

    try {
        $out['session_id'] = request()->session()->getId();
        $out['session_driver'] = config('session.driver');
    } catch (\Throwable $e) {
        $out['session_error'] = get_class($e).': '.$e->getMessage();
    }

    try {
        $out['sanctum_user'] = optional(auth()->guard('sanctum')->user())->email ?? 'NONE';
    } catch (\Throwable $e) {
        $out['sanctum_error'] = get_class($e).': '.$e->getMessage();
    }

    try {
        $out['web_user'] = optional(auth()->guard('web')->user())->email ?? 'NONE';
    } catch (\Throwable $e) {
        $out['web_error'] = get_class($e).': '.$e->getMessage();
    }

    return response()->json($out);
});

Route::view('/', 'dashboard.choose')->name('home');

Route::view('/lpb', 'dashboard', ['tools' => 'lpb'])->name('tools.lpb');
Route::view('/pldt', 'dashboard', ['tools' => 'pldt'])->name('tools.pldt');
Route::view('/adu', 'dashboard', ['tools' => 'adu'])->name('tools.adu');