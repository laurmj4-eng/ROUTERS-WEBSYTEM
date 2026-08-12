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

    return response()->json($out);
});

Route::view('/', 'dashboard.choose')->name('home');

Route::view('/lpb', 'dashboard', ['tools' => 'lpb'])->name('tools.lpb');
Route::view('/pldt', 'dashboard', ['tools' => 'pldt'])->name('tools.pldt');
Route::view('/adu', 'dashboard', ['tools' => 'adu'])->name('tools.adu');