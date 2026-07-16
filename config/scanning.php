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
        'default_vendor' => 'huawei',
        'default_product' => 'hg8145x6',
    ],

    'agent_url' => env('LOCAL_AGENT_URL'),
];
