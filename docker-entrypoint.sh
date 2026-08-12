#!/bin/sh
set -e

if [ "$RUN_MIGRATE_FRESH" = "1" ]; then
    echo "RUN_MIGRATE_FRESH=1 -> running migrate:fresh (data reset)"
    php artisan migrate:fresh --force
else
    php artisan migrate --force
fi

exec apache2-foreground
