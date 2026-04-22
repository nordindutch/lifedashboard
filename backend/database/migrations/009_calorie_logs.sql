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

CREATE INDEX IF NOT EXISTS idx_calorie_logs_date ON calorie_logs(log_date);
