#!/usr/bin/env php
<?php

declare(strict_types=1);

$baseDir = dirname(__DIR__);
$schemaPath = __DIR__ . '/schema.sql';
$migrationsDir = __DIR__ . '/migrations';
$dbPath = $baseDir . '/database/codex.sqlite';

$dbDir = dirname($dbPath);
if (!is_dir($dbDir) && !mkdir($dbDir, 0755, true) && !is_dir($dbDir)) {
    fwrite(STDERR, "Could not create database directory: {$dbDir}\n");
    exit(1);
}

try {
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
} catch (PDOException $e) {
    fwrite(STDERR, 'Database connection failed: ' . $e->getMessage() . "\n");
    exit(1);
}

// Tracking table
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT    PRIMARY KEY,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )',
);

// First-time schema bootstrap (sentinel = "__schema__")
$hasSchemaSentinel = (bool) $pdo->query(
    "SELECT 1 FROM schema_migrations WHERE filename = '__schema__'",
)->fetchColumn();

if (!$hasSchemaSentinel) {
    if (!is_readable($schemaPath)) {
        fwrite(STDERR, "Schema file not found: {$schemaPath}\n");
        exit(1);
    }
    $schemaSql = file_get_contents($schemaPath);
    if ($schemaSql === false) {
        fwrite(STDERR, "Could not read schema file.\n");
        exit(1);
    }
    $pdo->beginTransaction();
    try {
        $pdo->exec($schemaSql);
        $pdo->prepare('INSERT INTO schema_migrations (filename) VALUES (?)')
            ->execute(['__schema__']);
        $pdo->commit();
        echo "→ Applied schema.sql (fresh install)\n";
    } catch (Throwable $e) {
        $pdo->rollBack();
        fwrite(STDERR, 'Schema apply failed: ' . $e->getMessage() . "\n");
        exit(1);
    }
}

// Apply pending migrations in alphabetical order
if (!is_dir($migrationsDir)) {
    echo "No migrations directory — done.\n";
    exit(0);
}

$migrationFiles = glob($migrationsDir . '/*.sql') ?: [];
sort($migrationFiles, SORT_STRING);

$applied = [];
foreach ($pdo->query('SELECT filename FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN) as $name) {
    $applied[(string) $name] = true;
}

$count = 0;
foreach ($migrationFiles as $path) {
    $name = basename($path);
    if (isset($applied[$name])) {
        continue;
    }

    $sql = file_get_contents($path);
    if ($sql === false) {
        fwrite(STDERR, "Could not read migration: {$name}\n");
        exit(1);
    }

    $pdo->beginTransaction();
    try {
        $pdo->exec($sql);
        $pdo->prepare('INSERT INTO schema_migrations (filename) VALUES (?)')
            ->execute([$name]);
        $pdo->commit();
        echo "→ Applied {$name}\n";
        ++$count;
    } catch (Throwable $e) {
        $pdo->rollBack();
        fwrite(STDERR, "Migration {$name} failed: " . $e->getMessage() . "\n");
        exit(1);
    }
}

if ($count === 0) {
    echo "All migrations up to date.\n";
}
echo "Migration OK: {$dbPath}\n";
