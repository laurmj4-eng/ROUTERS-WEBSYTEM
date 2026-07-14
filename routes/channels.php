<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('router-control', function () {
    return true;
});
