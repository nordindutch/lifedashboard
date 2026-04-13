# Project Codex

Personal Life OS dashboard: daily briefing, Kanban, spatial canvas, diary, and AI planning.

## Requirements

- PHP 8.2+ with **pdo_sqlite** enabled
- Node.js 20+ (for the frontend)

## Backend

```bash
cd backend
cp .env.example .env
# Set CODEX_API_KEY in .env

php database/migrate.php
```

Serve the front controller (example):

```bash
php -S 127.0.0.1:8180 -t public
```

All JSON routes expect header: `X-Codex-Key: <your CODEX_API_KEY>`.

## Frontend

```bash
cd frontend
cp .env.example .env
# Optional: VITE_CODEX_API_KEY for the dev proxy

npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8180` by default (see `vite.config.ts`). Docker: see `DOCKER.md` (app **5273**, API **8180** on the host).

## Status

Foundation: SQLite schema, migration CLI, PHP router, goals CRUD, Vite + React + Tailwind scaffold. External integrations (weather, Google, Anthropic) are not wired yet—add API keys when you are ready.
