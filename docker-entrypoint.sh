#!/bin/sh
set -e

if [ "$RUN_MIGRATE_FRESH" = "1" ]; then
    echo "RUN_MIGRATE_FRESH=1 -> running migrate:fresh (data reset)"
    php artisan migrate:fresh --force
fi

php artisan migrate --force
php artisan db:seed --force

exec apache2-foreground
