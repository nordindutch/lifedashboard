# Docker (development)

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)

If the `php` container fails with `exec ... docker-entrypoint.sh: no such file or directory`, rebuild the image (the Dockerfile normalizes line endings for the entrypoint script):

```bash
docker compose build --no-cache php
```

The Apache image uses **`PassEnv CODEX_API_KEY`** so PHP can read the API key from Docker’s environment (without it, `/api/*` may return **500** `config_error` even when Compose sets `CODEX_API_KEY`). Rebuild the `php` image after changing `docker/php/apache-vhost.conf`.

## Quick start

1. **API key for Compose and the UI**

   Copy `docker.env.example` to `.env` in the project root (next to `docker-compose.yml`):

   ```bash
   cp docker.env.example .env
   ```

   Edit `.env` and set `CODEX_API_KEY` to a non-empty secret.

2. **Backend env (PHP reads this file)**

   Copy `backend/.env.example` to `backend/.env` and set **`CODEX_API_KEY` to the same value** as in the root `.env`.

3. **Start the stack**

   ```bash
   docker compose up --build
   ```

4. **Create the SQLite database (first run only)**

   With the stack running:

   ```bash
   docker compose exec php php database/migrate.php
   ```

   If `php` is not running (or you only want a one-off migrate without starting Apache):

   ```bash
   docker compose run --rm php php database/migrate.php
   ```

## URLs

| Service   | URL                     |
|----------|-------------------------|
| App (Vite) | http://localhost:**5273** (host port → container **5173** where Vite listens) |
| API (Apache) | http://localhost:**8180** (host port → container **80**) |

To use other host ports, edit the `ports` lines under `frontend` and `php` in `docker-compose.yml`.

The Vite container proxies `/api/*` to the PHP service inside Docker (`http://php:80`). Changing host ports does not break that link.

## Port already in use (5273, 8180, …)

If Compose reports `Bind for 0.0.0.0:PORT failed: port is already allocated`, edit the `ports` mappings in `docker-compose.yml` (e.g. `5274:5173` and `8181:80`), then run `docker compose down` and `docker compose up --build`.

On Windows, to see what owns a port:

```powershell
netstat -ano | findstr :5273
netstat -ano | findstr :8180
```

## Stopping

```bash
docker compose down
```

Optional: remove the named volume for `node_modules` inside the frontend container:

```bash
docker compose down -v
```
