-- Cumulative amount paid toward each debt (partial payments). Remaining = amount - paid_amount.
ALTER TABLE budget_debts ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0;
