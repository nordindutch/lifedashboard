#!/bin/sh
set -e
mkdir -p /var/www/html/database
chown -R www-data:www-data /var/www/html/database 2>/dev/null || true

# Apply runtime schema (idempotent — all statements use IF NOT EXISTS).
# This ensures tables added after initial deploy are always present.
if [ -f /var/www/html/sql/schema.sql ]; then
    php -r "
        \$db = new PDO('sqlite:/var/www/html/database/codex.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
        \$db->exec(file_get_contents('/var/www/html/sql/schema.sql'));
    " && echo "Schema OK" || echo "Schema apply failed (non-fatal)" >&2
fi

exec "$@"
