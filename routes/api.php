<?php

use App\Http\Controllers\RouterController;
use Illuminate\Support\Facades\Route;

Route::post('/router/reboot', [RouterController::class, 'triggerReboot']);
Route::post('/router/password', [RouterController::class, 'changePassword']);
Route::patch('/router/log/{id}/status', [RouterController::class, 'updateStatus']);
