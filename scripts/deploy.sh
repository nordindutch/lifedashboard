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

echo "→ Backfilling migration tracker (safe to re-run)..."
$COMPOSE exec -T php php /var/www/html/database/mark_existing_migrations.php

echo "→ Running database migrations..."
$COMPOSE exec -T php php /var/www/html/database/migrate.php

echo "→ Fixing database permissions..."
$COMPOSE exec -T php chown -R www-data:www-data /var/www/html/database

echo "✓ Deploy complete. Running at ${FRONTEND_URL:-<set FRONTEND_URL in .env.production>}"
