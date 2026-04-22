PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,
    description     TEXT,
    color           TEXT    NOT NULL DEFAULT '#6366f1',
    icon            TEXT,
    status          TEXT    NOT NULL DEFAULT 'active'
                            CHECK(status IN ('active','completed','paused','archived')),
    target_date     INTEGER,
    completed_at    INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at      INTEGER
);

CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id         INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    title           TEXT    NOT NULL,
    description     TEXT,
    color           TEXT    NOT NULL DEFAULT '#8b5cf6',
    icon            TEXT,
    status          TEXT    NOT NULL DEFAULT 'active'
                            CHECK(status IN ('active','completed','on_hold','archived')),
    priority        INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 4),
    target_date     INTEGER,
    completed_at    INTEGER,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at      INTEGER
);

CREATE TABLE IF NOT EXISTS tasks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    goal_id         INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    parent_task_id  INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    title           TEXT    NOT NULL,
    description     TEXT,
    status          TEXT    NOT NULL DEFAULT 'backlog'
                            CHECK(status IN ('backlog','todo','in_progress','in_review','done','cancelled')),
    priority        INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 1 AND 4),
    display_order   REAL    NOT NULL DEFAULT 0,
    estimated_mins  INTEGER,
    actual_mins     INTEGER,
    due_date        INTEGER,
    completed_at    INTEGER,
    canvas_x        REAL,
    canvas_y        REAL,
    canvas_width    REAL    DEFAULT 240,
    canvas_color    TEXT    DEFAULT '#fef9c3',
    canvas_pinned   INTEGER NOT NULL DEFAULT 0 CHECK(canvas_pinned IN (0,1)),
    recurrence_rule TEXT,
    recurrence_parent_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at      INTEGER
);

CREATE TABLE IF NOT EXISTS labels (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#94a3b8'
);

CREATE TABLE IF NOT EXISTS task_labels (
    task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_id)
);

CREATE TABLE IF NOT EXISTS notes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id      INTEGER REFERENCES goals(id) ON DELETE CASCADE,
    project_id   INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    task_id      INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    canvas_x     REAL,
    canvas_y     REAL,
    canvas_width REAL    DEFAULT 240,
    canvas_color TEXT    DEFAULT '#fef9c3',
    canvas_pinned INTEGER NOT NULL DEFAULT 0 CHECK(canvas_pinned IN (0,1)),
    canvas_z_index INTEGER DEFAULT 0,
    title        TEXT,
    body         TEXT    NOT NULL DEFAULT '',
    body_format  TEXT    NOT NULL DEFAULT 'markdown'
                         CHECK(body_format IN ('markdown','plain','html')),
    is_pinned    INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0,1)),
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at   INTEGER
);

CREATE TABLE IF NOT EXISTS diary_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id      INTEGER REFERENCES goals(id) ON DELETE SET NULL,
    project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    task_id      INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    log_type     TEXT NOT NULL DEFAULT 'activity'
                      CHECK(log_type IN ('activity','reflection','win','blocker','idea','mood')),
    body         TEXT NOT NULL,
    mood_score   INTEGER CHECK(mood_score BETWEEN 1 AND 10),
    energy_score INTEGER CHECK(energy_score BETWEEN 1 AND 10),
    duration_mins INTEGER,
    logged_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    deleted_at   INTEGER
);

CREATE TABLE IF NOT EXISTS ai_plans (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_date         TEXT    NOT NULL,
    plan_type         TEXT    NOT NULL DEFAULT 'morning'
                              CHECK(plan_type IN ('morning','evening','weekly','adhoc')),
    tasks_snapshot    TEXT    NOT NULL DEFAULT '[]',
    logs_snapshot     TEXT    NOT NULL DEFAULT '[]',
    weather_context   TEXT,
    calendar_context  TEXT,
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    model_used        TEXT    DEFAULT 'claude-sonnet-4-6',
    raw_response      TEXT,
    parsed_schedule   TEXT,
    reflection        TEXT,
    suggested_tasks   TEXT,
    score             INTEGER CHECK(score BETWEEN 1 AND 100),
    created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS daily_snapshots (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date        TEXT    NOT NULL UNIQUE,
    tasks_planned        INTEGER NOT NULL DEFAULT 0,
    tasks_completed      INTEGER NOT NULL DEFAULT 0,
    tasks_added          INTEGER NOT NULL DEFAULT 0,
    tasks_deferred       INTEGER NOT NULL DEFAULT 0,
    total_estimated_mins INTEGER NOT NULL DEFAULT 0,
    total_actual_mins    INTEGER NOT NULL DEFAULT 0,
    log_count            INTEGER NOT NULL DEFAULT 0,
    avg_mood_score       REAL,
    avg_energy_score     REAL,
    unread_emails        INTEGER,
    calendar_events      INTEGER,
    ai_plan_id           INTEGER REFERENCES ai_plans(id) ON DELETE SET NULL,
    created_at           INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at           INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS integration_tokens (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    service       TEXT NOT NULL UNIQUE CHECK(service IN ('google','openweather')),
    access_token  TEXT,
    refresh_token TEXT,
    token_expiry  INTEGER,
    scope         TEXT,
    metadata      TEXT DEFAULT '{}',
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS cached_calendar_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id   TEXT NOT NULL UNIQUE,
    title         TEXT NOT NULL,
    description   TEXT,
    location      TEXT,
    start_at      INTEGER NOT NULL,
    end_at        INTEGER NOT NULL,
    is_all_day    INTEGER NOT NULL DEFAULT 0,
    calendar_name TEXT,
    color         TEXT,
    meet_link     TEXT,
    raw_data      TEXT,
    fetched_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS cached_emails (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id    TEXT NOT NULL UNIQUE,
    thread_id      TEXT,
    subject        TEXT,
    sender_name    TEXT,
    sender_email   TEXT,
    snippet        TEXT,
    is_unread      INTEGER NOT NULL DEFAULT 1,
    has_attachment INTEGER NOT NULL DEFAULT 0,
    received_at    INTEGER NOT NULL,
    fetched_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    value_type TEXT NOT NULL DEFAULT 'string'
                    CHECK(value_type IN ('string','integer','float','boolean','json')),
    description TEXT,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS calorie_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    log_date      TEXT    NOT NULL,
    food_name     TEXT    NOT NULL,
    food_brand    TEXT,
    amount_g      REAL    NOT NULL DEFAULT 100,
    kcal_per_100g REAL    NOT NULL,
    kcal_total    REAL    NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calorie_logs_date ON calorie_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status, display_order);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_notes_task     ON notes(task_id);
CREATE INDEX IF NOT EXISTS idx_diary_logged   ON diary_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_calendar_start ON cached_calendar_events(start_at);
CREATE INDEX IF NOT EXISTS idx_emails_unread  ON cached_emails(is_unread, received_at);

-- Auto-update triggers
CREATE TRIGGER IF NOT EXISTS trg_goals_updated    AFTER UPDATE ON goals    BEGIN UPDATE goals    SET updated_at = unixepoch() WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_projects_updated AFTER UPDATE ON projects BEGIN UPDATE projects SET updated_at = unixepoch() WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_tasks_updated    AFTER UPDATE ON tasks    BEGIN UPDATE tasks    SET updated_at = unixepoch() WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_notes_updated    AFTER UPDATE ON notes    BEGIN UPDATE notes    SET updated_at = unixepoch() WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_diary_updated    AFTER UPDATE ON diary_logs BEGIN UPDATE diary_logs SET updated_at = unixepoch() WHERE id = NEW.id; END;

-- Default settings
INSERT OR IGNORE INTO settings (key, value, value_type, description) VALUES
    ('app_name',                'Project Codex', 'string',  'Display name'),
    ('timezone',                'UTC',           'string',  'IANA timezone'),
    ('theme',                   'dark',          'string',  'dark | light | system'),
    ('openweather_api_key',     '',              'string',  'OpenWeather key'),
    ('openweather_lat',         '',              'string',  'Latitude'),
    ('openweather_lon',         '',              'string',  'Longitude'),
    ('anthropic_api_key',       '',              'string',  'Anthropic API key'),
    ('google_client_id',        '',              'string',  'Google OAuth client ID'),
    ('google_client_secret',    '',              'string',  'Google OAuth client secret'),
    ('ai_morning_plan_enabled', '1',             'boolean', 'Auto morning plans'),
    ('ai_evening_plan_enabled', '1',             'boolean', 'Auto evening reflections'),
    ('work_start_hour',         '9',             'integer', 'Work start (24h)'),
    ('work_end_hour',           '18',            'integer', 'Work end (24h)'),
    ('kanban_columns',          '["backlog","todo","in_progress","in_review","done"]', 'json', 'Visible Kanban columns'),
    ('gmail_last_sync_at',      '0',             'integer', 'Unix time of last successful Gmail inbox sync');
