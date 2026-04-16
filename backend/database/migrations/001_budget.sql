PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS budget_months (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    month           TEXT    NOT NULL UNIQUE,
    current_balance REAL    NOT NULL DEFAULT 0,
    minimum_balance REAL    NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS budget_income (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id   INTEGER NOT NULL REFERENCES budget_months(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    amount     REAL    NOT NULL DEFAULT 0,
    received   INTEGER NOT NULL DEFAULT 0 CHECK(received IN (0,1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS budget_expenses (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    month_id   INTEGER NOT NULL REFERENCES budget_months(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL,
    amount     REAL    NOT NULL DEFAULT 0,
    category   TEXT    NOT NULL DEFAULT 'Vaste Last'
                      CHECK(category IN (
                          'Vaste Last','Abonnement','Tijdelijke Last',
                          'Persoonlijk','Politiek/Vakbond','Overig'
                      )),
    paid       INTEGER NOT NULL DEFAULT 0 CHECK(paid IN (0,1)),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_budget_income_month ON budget_income(month_id);
CREATE INDEX IF NOT EXISTS idx_budget_expenses_month ON budget_expenses(month_id);

CREATE TRIGGER IF NOT EXISTS trg_budget_months_updated
    AFTER UPDATE ON budget_months
    BEGIN UPDATE budget_months SET updated_at = unixepoch() WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_budget_income_updated
    AFTER UPDATE ON budget_income
    BEGIN UPDATE budget_income SET updated_at = unixepoch() WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_budget_expenses_updated
    AFTER UPDATE ON budget_expenses
    BEGIN UPDATE budget_expenses SET updated_at = unixepoch() WHERE id = NEW.id; END;
