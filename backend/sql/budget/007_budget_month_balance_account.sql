-- Link a checking (betaalrekening) to budget month "current balance" for live saldo.
ALTER TABLE budget_months ADD COLUMN current_balance_account_id INTEGER NULL REFERENCES budget_accounts(id);
