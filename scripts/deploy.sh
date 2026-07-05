#!/bin/bash
set -e

DEPLOY_DIR="${HOME}/codex"
BARE_GIT="${HOME}/repos/codex.git"
ENV_FILE="${DEPLOY_DIR}/.env.production"
COMPOSE="docker compose -f ${DEPLOY_DIR}/docker-compose.prod.yml"

echo "→ Pulling latest code..."
cd "$DEPLOY_DIR"
git --work-tree="$DEPLOY_DIR" --git-dir="$BARE_GIT" checkout -f main

echo "→ Loading env..."
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: .env.production not found at $ENV_FILE"
  exit 1
fi
set -a && source "$ENV_FILE" && set +a

echo "→ Building frontend..."
cd "${DEPLOY_DIR}/frontend"
npm ci --prefer-offline --no-audit --no-fund
# VITE_* can be set in .env.production (e.g. VITE_API_BASE_URL); omit for same-origin /api
npm run build

echo "→ Rebuilding PHP container..."
cd "$DEPLOY_DIR"
$COMPOSE up -d --build php caddy

echo "→ Waiting for PHP container to be ready..."
sleep 3

echo "→ Backing up database..."
mkdir -p "${HOME}/db-backups"
if $COMPOSE exec -T php php -r '(new PDO("sqlite:/var/www/html/database/codex.sqlite"))->exec("VACUUM INTO '\''/tmp/db-backup.sqlite'\''");' 2>/dev/null; then
  $COMPOSE cp php:/tmp/db-backup.sqlite "${HOME}/db-backups/codex-$(date +%Y%m%d-%H%M%S).sqlite"
  $COMPOSE exec -T php rm -f /tmp/db-backup.sqlite
  ls -1t "${HOME}/db-backups"/codex-*.sqlite 2>/dev/null | tail -n +15 | xargs -r rm -f
else
  echo "  (no database yet — skipping backup)"
fi

# The sqlite_data volume shadows backend/database inside the container, so the repo's
# migration scripts are invisible there. Sync them into the volume before running.
# docker cp can't write into the volume directly (the parent /var/www/html mount is
# read-only), so stage via /tmp and copy from inside the container. Never copy sqlite
# files: a stray codex.sqlite in the work tree would overwrite the live database.
echo "→ Syncing migration scripts into database volume..."
$COMPOSE cp "${DEPLOY_DIR}/backend/database" php:/tmp/db-sync
$COMPOSE exec -T php sh -c 'rm -f /tmp/db-sync/*.sqlite* && rm -rf /var/www/html/database/migrations && cp -a /tmp/db-sync/. /var/www/html/database/ && rm -rf /tmp/db-sync'

echo "→ Backfilling migration tracker (safe to re-run)..."
$COMPOSE exec -T php php /var/www/html/database/mark_existing_migrations.php

echo "→ Running database migrations..."
$COMPOSE exec -T php php /var/www/html/database/migrate.php

echo "→ Fixing database permissions..."
$COMPOSE exec -T php chown -R www-data:www-data /var/www/html/database

echo "✓ Deploy complete. Running at ${FRONTEND_URL:-<set FRONTEND_URL in .env.production>}"
