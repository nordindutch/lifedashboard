#!/bin/sh
set -e
mkdir -p /var/www/html/database
chown -R www-data:www-data /var/www/html/database 2>/dev/null || true
exec "$@"
