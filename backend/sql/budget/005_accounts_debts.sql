CREATE TABLE IF NOT EXISTS budget_accounts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    kind       TEXT    NOT NULL DEFAULT 'checking'
                       CHECK(kind IN ('checking','savings','cash','investment','other')),
    balance    REAL    NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS budget_debts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    amount       REAL    NOT NULL DEFAULT 0,
    deadline     INTEGER,
    paid         INTEGER NOT NULL DEFAULT 0 CHECK(paid IN (0,1)),
    notes        TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TRIGGER IF NOT EXISTS trg_budget_accounts_updated
    AFTER UPDATE ON budget_accounts
    BEGIN UPDATE budget_accounts SET updated_at = unixepoch() WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_budget_debts_updated
    AFTER UPDATE ON budget_debts
    BEGIN UPDATE budget_debts SET updated_at = unixepoch() WHERE id = NEW.id; END;
