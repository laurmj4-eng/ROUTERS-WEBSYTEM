<?php

return [
    'rate_limit' => [
        'max' => (int) env('SCAN_RATE_LIMIT_MAX', 10),
        'decay' => (int) env('SCAN_RATE_LIMIT_DECAY', 60),
    ],

    'nvd' => [
        'api_key' => env('NVD_API_KEY'),
        'timeout' => 10,
    ],

    'cache' => [
        'nvd_ttl' => (int) env('NVD_CACHE_TTL', 86400),
        'prefix' => env('NVD_CACHE_PREFIX', 'nvd:'),
    ],

    'topology' => [
        'storage_path' => 'app/topology',
        'allowed_extensions' => ['json', 'csv'],
    ],

    'firmware' => [
        'default_vendor' => 'fiberhome',
        'default_product' => 'an5506',
    ],

    'agent_url' => env('LOCAL_AGENT_URL'),

    'lpb_url' => env('LPB_URL', 'http://10.0.0.1'),

    'adu_url' => env('ADU_URL', 'http://10.0.0.1'),

    'pldt_url' => env('PLDT_URL', 'http://192.168.1.1'),

    'relay' => [
        'token' => env('RELAY_TOKEN'),
    ],
];
