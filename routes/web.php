<?php

use Illuminate\Support\Facades\Route;

Route::get('/up', fn () => response()->json(['status' => 'ok']));

Route::get('/login', fn () => redirect('/'))->name('login');

Route::view('/', 'dashboard.choose')->name('home');

Route::view('/lpb', 'dashboard', ['tools' => 'lpb'])->name('tools.lpb');
Route::view('/pldt', 'dashboard', ['tools' => 'pldt'])->name('tools.pldt');
Route::view('/adu', 'dashboard', ['tools' => 'adu'])->name('tools.adu');