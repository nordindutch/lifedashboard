#!/usr/bin/env php
<?php

declare(strict_types=1);

$baseDir = dirname(__DIR__);
$dbPath = $baseDir . '/database/codex.sqlite';

if (!file_exists($dbPath)) {
    echo "No existing database. Run migrate.php instead.\n";
    exit(0);
}

$pdo = new PDO('sqlite:' . $dbPath, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
]);

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT    PRIMARY KEY,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )',
);

$hasStmt = $pdo->prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1');
$has = static function (string $table) use ($hasStmt): bool {
    $hasStmt->execute(['table', $table]);

    return (bool) $hasStmt->fetchColumn();
};

$hasCol = static function (string $table, string $col) use ($pdo): bool {
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $table) || !preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
        return false;
    }
    $stmt = $pdo->query('PRAGMA table_info(' . $table . ')');
    if ($stmt === false) {
        return false;
    }
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $c) {
        if (($c['name'] ?? '') === $col) {
            return true;
        }
    }

    return false;
};

$markStmt = $pdo->prepare('INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)');
$mark = static function (string $filename) use ($markStmt): void {
    $markStmt->execute([$filename]);
};

if ($has('goals') || $has('tasks') || $has('projects')) {
    $mark('__schema__');
}
if ($has('budget_months')) {
    $mark('001_budget.sql');
}
if ($has('users')) {
    $mark('002_auth.sql');
}
if ($has('note_labels')) {
    $mark('003_note_labels.sql');
}
if ($has('users') && $hasCol('users', 'password_hash')) {
    $mark('004_password_auth.sql');
}
if ($has('budget_accounts') && $has('budget_debts')) {
    $mark('005_accounts_debts.sql');
}
if ($has('budget_debts') && $hasCol('budget_debts', 'paid_amount')) {
    $mark('006_debt_paid_amount.sql');
}
if ($has('budget_months') && $hasCol('budget_months', 'current_balance_account_id')) {
    $mark('007_budget_month_balance_account.sql');
}

echo "Backfilled. Applied migrations:\n";
foreach ($pdo->query('SELECT filename FROM schema_migrations ORDER BY filename')
    ->fetchAll(PDO::FETCH_COLUMN) as $r) {
    echo "  - {$r}\n";
}
echo "\nDone.\n";
