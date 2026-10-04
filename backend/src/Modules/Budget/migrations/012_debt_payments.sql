-- Geregistreerde aflossingen per schuld. paid_amount op budget_debts blijft de som van de aflossingen
-- plus handmatige correcties; deze tabel geeft de historie.
CREATE TABLE IF NOT EXISTS budget_debt_payments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id    INTEGER NOT NULL REFERENCES budget_debts(id) ON DELETE CASCADE,
    amount     REAL    NOT NULL,
    note       TEXT,
    paid_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_budget_debt_payments_debt ON budget_debt_payments(debt_id);
