-- Rente per schuld (percentage per jaar) en de keuze om de maandelijkse rente als uitgavepost
-- in het maandbudget mee te tellen. Rente van de maand = openstaand saldo x percentage / 100 / 12.
ALTER TABLE budget_debts ADD COLUMN interest_rate_pct REAL NOT NULL DEFAULT 0;
ALTER TABLE budget_debts ADD COLUMN include_interest_in_budget INTEGER NOT NULL DEFAULT 0
    CHECK(include_interest_in_budget IN (0,1));
