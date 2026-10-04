#!/usr/bin/env bash
# Deploy van Project Codex op de VPS (Caddy + PHP + SQLite in Docker).
#
# Wordt aangeroepen door .github/workflows/deploy.yml via SSH, of handmatig:
#   cd ~/codex && ./deploy/deploy.sh
#
# Stappen:
#   1. code bijwerken (git-werkmap of bare repo + work tree, zoals de oude scripts/deploy.sh)
#   2. frontend bouwen (npm ci + npm run build)
#   3. back-up van codex.sqlite (VACUUM INTO) vóór de migraties
#   4. containers bouwen en starten
#   5. migratiescripts in het database-volume zetten, tracker backfillen, migraties draaien
#   6. gezondheidscheck op /api/health
#   7. bij een mislukte migratie of healthcheck: database terugzetten uit de back-up, vorige
#      commit uitchecken, opnieuw bouwen en starten
#
# Omgeving (optioneel): DEPLOY_DIR, BARE_GIT, ENV_FILE, HEALTH_URL, DEPLOY_REF, KEEP_BACKUPS

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-${HOME}/codex}"
BARE_GIT="${BARE_GIT:-${HOME}/repos/codex.git}"
ENV_FILE="${ENV_FILE:-${DEPLOY_DIR}/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-${HOME}/db-backups}"
KEEP_BACKUPS="${KEEP_BACKUPS:-20}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8082/api/health}"
DEPLOY_REF="${DEPLOY_REF:-}"
COMPOSE="docker compose -f ${DEPLOY_DIR}/docker-compose.prod.yml"
DB_IN_CONTAINER="/var/www/html/database/codex.sqlite"

log() { printf '\n→ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

cd "$DEPLOY_DIR"

# --- 1. Code -----------------------------------------------------------------------------
PREVIOUS_COMMIT=""
if [[ -d "${DEPLOY_DIR}/.git" ]]; then
  PREVIOUS_COMMIT="$(git rev-parse HEAD)"
  if [[ -n "$DEPLOY_REF" ]]; then
    log "Uitchecken van ${DEPLOY_REF}..."
    git fetch --tags origin
    git checkout -f "$DEPLOY_REF"
    git pull --ff-only origin "$DEPLOY_REF" 2>/dev/null || true
  else
    log "Code is al uitgecheckt door de aanroeper ($(git rev-parse --short HEAD))."
  fi
elif [[ -d "$BARE_GIT" ]]; then
  log "Code ophalen uit bare repo ${BARE_GIT}..."
  PREVIOUS_COMMIT="$(git --git-dir="$BARE_GIT" rev-parse "${DEPLOY_REF:-main}~0" 2>/dev/null || true)"
  git --work-tree="$DEPLOY_DIR" --git-dir="$BARE_GIT" checkout -f "${DEPLOY_REF:-main}"
else
  fail "Geen git-werkmap in ${DEPLOY_DIR} en geen bare repo in ${BARE_GIT}."
fi
CURRENT_COMMIT="$(git -C "$DEPLOY_DIR" rev-parse --short HEAD 2>/dev/null || git --git-dir="$BARE_GIT" rev-parse --short "${DEPLOY_REF:-main}")"
echo "$CURRENT_COMMIT" > "${DEPLOY_DIR}/backend/BUILD"
log "Versie $(cat "${DEPLOY_DIR}/backend/VERSION" 2>/dev/null || echo onbekend), build ${CURRENT_COMMIT}"

# --- 2. Env ------------------------------------------------------------------------------
[[ -f "$ENV_FILE" ]] || fail ".env.production niet gevonden op ${ENV_FILE}"
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

# --- 3. Frontend --------------------------------------------------------------------------
log "Frontend bouwen..."
( cd "${DEPLOY_DIR}/frontend" && npm ci --prefer-offline --no-audit --no-fund && CODEX_BUILD="$CURRENT_COMMIT" npm run build )

# --- 4. Back-up ---------------------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
BACKUP_FILE=""
if $COMPOSE ps --status running php >/dev/null 2>&1 && $COMPOSE exec -T php test -f "$DB_IN_CONTAINER" 2>/dev/null; then
  log "Back-up van de database..."
  BACKUP_FILE="${BACKUP_DIR}/codex-$(date +%Y%m%d-%H%M%S)-${CURRENT_COMMIT}.sqlite"
  $COMPOSE exec -T php php -r "(new PDO('sqlite:${DB_IN_CONTAINER}'))->exec(\"VACUUM INTO '/tmp/db-backup.sqlite'\");"
  $COMPOSE cp php:/tmp/db-backup.sqlite "$BACKUP_FILE"
  $COMPOSE exec -T php rm -f /tmp/db-backup.sqlite
  ls -1t "${BACKUP_DIR}"/codex-*.sqlite 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f
  echo "  back-up: ${BACKUP_FILE}"
else
  log "Nog geen database (eerste deploy), back-up overgeslagen."
fi

# --- 5. Containers en migraties -----------------------------------------------------------
sync_migrations() {
  # Het sqlite-volume verbergt backend/database in de container; kopieer de scripts erin.
  # Nooit sqlite-bestanden meekopiëren: die zouden de live database overschrijven.
  $COMPOSE cp "${DEPLOY_DIR}/backend/database" php:/tmp/db-sync
  $COMPOSE exec -T php sh -c 'rm -f /tmp/db-sync/*.sqlite* && rm -rf /var/www/html/database/migrations && cp -a /tmp/db-sync/. /var/www/html/database/ && rm -rf /tmp/db-sync'
}

run_migrations() {
  sync_migrations
  $COMPOSE exec -T php php /var/www/html/database/mark_existing_migrations.php
  $COMPOSE exec -T php php /var/www/html/database/migrate.php
  $COMPOSE exec -T php chown -R www-data:www-data /var/www/html/database
}

health_check() {
  local tries="${1:-15}"
  for _ in $(seq 1 "$tries"); do
    if curl -fsS --max-time 5 "$HEALTH_URL" | grep -q '"status":"ok"'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback() {
  local reason="$1"
  printf '\n✗ %s\n' "$reason" >&2
  log "Terugrollen..."
  if [[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]]; then
    log "Database terugzetten uit ${BACKUP_FILE}..."
    $COMPOSE cp "$BACKUP_FILE" php:/tmp/db-restore.sqlite
    $COMPOSE exec -T php sh -c "rm -f ${DB_IN_CONTAINER} ${DB_IN_CONTAINER}-wal ${DB_IN_CONTAINER}-shm && mv /tmp/db-restore.sqlite ${DB_IN_CONTAINER} && chown www-data:www-data ${DB_IN_CONTAINER}"
  fi
  if [[ -n "$PREVIOUS_COMMIT" ]]; then
    log "Vorige commit ${PREVIOUS_COMMIT:0:7} uitchecken..."
    if [[ -d "${DEPLOY_DIR}/.git" ]]; then
      git -C "$DEPLOY_DIR" checkout -f "$PREVIOUS_COMMIT"
    else
      git --work-tree="$DEPLOY_DIR" --git-dir="$BARE_GIT" checkout -f "$PREVIOUS_COMMIT"
    fi
    echo "${PREVIOUS_COMMIT:0:7}" > "${DEPLOY_DIR}/backend/BUILD"
    ( cd "${DEPLOY_DIR}/frontend" && npm ci --prefer-offline --no-audit --no-fund && npm run build ) || true
    $COMPOSE up -d --build php caddy
    sync_migrations || true
  fi
  if health_check 10; then
    printf '\nRollback geslaagd: de vorige versie draait weer.\n' >&2
  else
    printf '\nRollback uitgevoerd, maar de healthcheck faalt nog. Controleer: %s logs php\n' "$COMPOSE" >&2
  fi
  exit 1
}

log "Containers bouwen en starten..."
$COMPOSE up -d --build php caddy
sleep 3

log "Migraties..."
if ! run_migrations; then
  rollback "Migratie mislukt."
fi

# --- 6. Healthcheck -----------------------------------------------------------------------
log "Gezondheidscheck op ${HEALTH_URL}..."
if ! health_check 15; then
  rollback "Healthcheck mislukt na deploy."
fi

log "Deploy klaar: versie $(cat backend/VERSION) (${CURRENT_COMMIT}) draait op ${FRONTEND_URL:-<FRONTEND_URL in .env.production>}"
