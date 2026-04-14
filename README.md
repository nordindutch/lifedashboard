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

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services** → **Credentials**.
2. Create an **OAuth 2.0 Client ID** with type **Web application**.
3. Add **Authorised redirect URIs** for every environment you use:
   - `http://localhost:8180/api/auth/google/callback` (Docker Compose, backend on 8180)
   - `http://localhost:5173/api/auth/google/callback` (bare-metal Vite dev)
   - Your production callback URL when deployed
4. Add **Authorised JavaScript origins**:
   - `http://localhost:5273`
   - `http://localhost:5173`
5. Enable the **Google Calendar API** in **APIs & Services** → **Library**.
6. Save your `client_id` and `client_secret` in the app Settings.

## Status

Foundation: SQLite schema, migration CLI, PHP router, goals CRUD, Vite + React + Tailwind scaffold. External integrations (weather, Google, Anthropic) are not wired yet—add API keys when you are ready.
