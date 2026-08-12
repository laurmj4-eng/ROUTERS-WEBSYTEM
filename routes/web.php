<?php

use Illuminate\Support\Facades\Route;

Route::get('/up', fn () => response()->json(['status' => 'ok']));

Route::get('/login', fn () => redirect('/'))->name('login');

Route::view('/', 'dashboard.choose')->name('home');

Route::view('/lpb', 'dashboard', ['tools' => 'lpb'])->name('tools.lpb');
Route::view('/pldt', 'dashboard', ['tools' => 'pldt'])->name('tools.pldt');
Route::view('/adu', 'dashboard', ['tools' => 'adu'])->name('tools.adu');

// Public "Add Time to THIS device" page — works for customers on the shop WiFi:
// the phone's own browser POSTs straight to the portal, so the portal credits
// the phone (its session), not the tunnel exit.
Route::get('/lpb/add', fn () => view('lpb-add'))->name('lpb.add');