#!/bin/bash
set -e

DEPLOY_DIR="${HOME}/codex"
ENV_FILE="${DEPLOY_DIR}/.env.production"
COMPOSE="docker compose -f ${DEPLOY_DIR}/docker-compose.prod.yml"

echo "→ Pulling latest code..."
cd "$DEPLOY_DIR"
git pull origin main

echo "→ Building frontend..."
cd "${DEPLOY_DIR}/frontend"
npm ci --prefer-offline
VITE_API_BASE_URL="" npm run build

echo "→ Rebuilding PHP container and restarting..."
cd "$DEPLOY_DIR"
set -a && source "$ENV_FILE" && set +a
$COMPOSE up -d --build php caddy

echo "→ Running database migrations..."
$COMPOSE exec -T php php database/migrate.php

echo "→ Deploy complete. Running at ${FRONTEND_URL}"
