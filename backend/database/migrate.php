#!/usr/bin/env php
<?php

declare(strict_types=1);

$baseDir = dirname(__DIR__);
$schemaPath = __DIR__ . '/schema.sql';
$budgetMigrationPath = __DIR__ . '/migrations/001_budget.sql';
$authMigrationPath = __DIR__ . '/migrations/002_auth.sql';
$noteLabelsMigrationPath = __DIR__ . '/migrations/003_note_labels.sql';
$passwordAuthMigrationPath = __DIR__ . '/migrations/004_password_auth.sql';
$dbPath = $baseDir . '/database/codex.sqlite';

if (!is_readable($schemaPath)) {
    fwrite(STDERR, "Schema file not found: {$schemaPath}\n");
    exit(1);
}

$dbDir = dirname($dbPath);
if (!is_dir($dbDir)) {
    if (!mkdir($dbDir, 0755, true) && !is_dir($dbDir)) {
        fwrite(STDERR, "Could not create database directory: {$dbDir}\n");
        exit(1);
    }
}

$dsn = 'sqlite:' . $dbPath;
try {
    $pdo = new PDO($dsn, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, 'Database connection failed: ' . $e->getMessage() . "\n");
    exit(1);
}

$sql = file_get_contents($schemaPath);
if ($sql === false) {
    fwrite(STDERR, "Could not read schema file.\n");
    exit(1);
}

$pdo->exec($sql);

$tableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'budget_months'")->fetchColumn();
if ($tableCheck === false) {
    if (!is_readable($budgetMigrationPath)) {
        fwrite(STDERR, "Budget migration file not found: {$budgetMigrationPath}\n");
        exit(1);
    }
    $budgetSql = file_get_contents($budgetMigrationPath);
    if ($budgetSql === false) {
        fwrite(STDERR, "Could not read budget migration file.\n");
        exit(1);
    }
    $pdo->exec($budgetSql);
}

$usersTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")->fetchColumn();
if ($usersTableCheck === false) {
    if (!is_readable($authMigrationPath)) {
        fwrite(STDERR, "Auth migration file not found: {$authMigrationPath}\n");
        exit(1);
    }
    $authSql = file_get_contents($authMigrationPath);
    if ($authSql === false) {
        fwrite(STDERR, "Could not read auth migration file.\n");
        exit(1);
    }
    $pdo->exec($authSql);
}

$noteLabelsTableCheck = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'note_labels'")->fetchColumn();
if ($noteLabelsTableCheck === false) {
    if (!is_readable($noteLabelsMigrationPath)) {
        fwrite(STDERR, "Note labels migration file not found: {$noteLabelsMigrationPath}\n");
        exit(1);
    }
    $noteLabelsSql = file_get_contents($noteLabelsMigrationPath);
    if ($noteLabelsSql === false) {
        fwrite(STDERR, "Could not read note labels migration file.\n");
        exit(1);
    }
    $pdo->exec($noteLabelsSql);
}

$usersTableForPassword = $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")->fetchColumn();
if ($usersTableForPassword !== false) {
    $usersInfo = $pdo->query('PRAGMA table_info(users)')->fetchAll(PDO::FETCH_ASSOC);
    $hasPasswordHash = false;
    foreach ($usersInfo as $col) {
        if (($col['name'] ?? '') === 'password_hash') {
            $hasPasswordHash = true;
            break;
        }
    }
    if (!$hasPasswordHash) {
        if (!is_readable($passwordAuthMigrationPath)) {
            fwrite(STDERR, "Password auth migration file not found: {$passwordAuthMigrationPath}\n");
            exit(1);
        }
        $passwordSql = file_get_contents($passwordAuthMigrationPath);
        if ($passwordSql === false) {
            fwrite(STDERR, "Could not read password auth migration file.\n");
            exit(1);
        }
        $pdo->exec($passwordSql);
    }
}

echo "Migration OK: {$dbPath}\n";
