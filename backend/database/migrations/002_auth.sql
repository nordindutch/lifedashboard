CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    google_id     TEXT    NOT NULL UNIQUE,
    email         TEXT    NOT NULL,
    name          TEXT    NOT NULL,
    avatar_url    TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    last_login_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token         TEXT    NOT NULL UNIQUE,
    expires_at    INTEGER NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
