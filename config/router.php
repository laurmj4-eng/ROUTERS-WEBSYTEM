<?php

return [
    'password_rotation' => [
        'enabled' => env('ROUTER_PASSWORD_ROTATION_ENABLED', false),
        'frequency' => env('ROUTER_PASSWORD_ROTATION_FREQUENCY', 'weekly'),
        'min_length' => (int) env('ROUTER_PASSWORD_MIN_LENGTH', 12),
        'verification_timeout' => 300,
        'auto_rollback' => true,
    ],

    'admin_panel' => [
        'default_username' => env('ROUTER_USER', 'admin'),
        'ip' => env('ROUTER_IP', '192.168.1.1'),
    ],
];
