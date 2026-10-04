#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Migratie-CLI. Past schema.sql toe op een lege database en daarna alle nog niet
 * uitgevoerde NNN_naam.sql-bestanden uit:
 *   - backend/database/migrations (kern)
 *   - elke module-map die ModuleInterface::migrationsDir() teruggeeft
 * Bestandsnamen moeten uniek zijn over alle mappen; de volgorde is alfabetisch op naam.
 *
 * Opties:
 *   --dry-run   toon wat er zou gebeuren zonder iets te wijzigen
 *   --list      toon alle migraties met status
 * Omgeving:
 *   CODEX_DB_PATH  alternatief pad naar het SQLite-bestand
 */

require dirname(__DIR__) . '/bootstrap.php';

use Codex\Core\Database;
use Codex\Core\ModuleRegistry;


/**
 * `PRAGMA journal_mode` kan niet binnen een transactie; voer die regels apart uit en
 * geef de rest van de SQL terug.
 */
function applyJournalPragmasOutsideTransaction(PDO $pdo, string $sql): string
{
    $kept = [];
    foreach (preg_split('/\R/', $sql) ?: [] as $line) {
        if (preg_match('/^\s*PRAGMA\s+(journal_mode|synchronous)/i', $line) === 1) {
            $pdo->exec($line);
            continue;
        }
        $kept[] = $line;
    }

    return implode("\n", $kept);
}

$dryRun = in_array('--dry-run', $argv, true);
$listOnly = in_array('--list', $argv, true);

$schemaPath    = __DIR__ . '/schema.sql';
$coreMigrations = __DIR__ . '/migrations';
$dbPath        = Database::path();

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

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   TEXT    PRIMARY KEY,
        applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )'
);

$hasSchemaSentinel = (bool) $pdo->query(
    "SELECT 1 FROM schema_migrations WHERE filename = '__schema__'"
)->fetchColumn();

if (!$hasSchemaSentinel && !$listOnly) {
    if (!is_readable($schemaPath)) {
        fwrite(STDERR, "Schema file not found: {$schemaPath}\n");
        exit(1);
    }
    if ($dryRun) {
        echo "→ Would apply schema.sql (fresh install)\n";
    } else {
        $schemaSql = file_get_contents($schemaPath);
        if ($schemaSql === false) {
            fwrite(STDERR, "Could not read schema file.\n");
            exit(1);
        }
        $schemaSql = applyJournalPragmasOutsideTransaction($pdo, $schemaSql);
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
}

/** @var array<string, string> $migrationFiles basename => absolute path */
$migrationFiles = [];
foreach (ModuleRegistry::migrationDirs($coreMigrations) as $dir) {
    foreach (glob($dir . '/*.sql') ?: [] as $path) {
        $name = basename($path);
        if (isset($migrationFiles[$name])) {
            fwrite(STDERR, "Duplicate migration name {$name}:\n  {$migrationFiles[$name]}\n  {$path}\n");
            exit(1);
        }
        $migrationFiles[$name] = $path;
    }
}
ksort($migrationFiles, SORT_STRING);

$applied = [];
foreach ($pdo->query('SELECT filename FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN) as $name) {
    $applied[(string) $name] = true;
}

if ($listOnly) {
    foreach ($migrationFiles as $name => $path) {
        $status = isset($applied[$name]) ? 'applied' : 'pending';
        echo str_pad($status, 8) . $name . "  (" . $path . ")\n";
    }
    exit(0);
}

$count = 0;
foreach ($migrationFiles as $name => $path) {
    if (isset($applied[$name])) {
        continue;
    }
    if ($dryRun) {
        echo "→ Would apply {$name}\n";
        $count++;
        continue;
    }

    $sql = file_get_contents($path);
    if ($sql === false) {
        fwrite(STDERR, "Could not read migration: {$name}\n");
        exit(1);
    }

    $sql = applyJournalPragmasOutsideTransaction($pdo, $sql);
    $pdo->beginTransaction();
    try {
        $pdo->exec($sql);
        $pdo->prepare('INSERT INTO schema_migrations (filename) VALUES (?)')
            ->execute([$name]);
        $pdo->commit();
        echo "→ Applied {$name}\n";
        $count++;
    } catch (Throwable $e) {
        $pdo->rollBack();
        fwrite(STDERR, "Migration {$name} failed: " . $e->getMessage() . "\n");
        exit(1);
    }
}

if ($count === 0) {
    echo "All migrations up to date.\n";
}
echo ($dryRun ? 'Dry run OK: ' : 'Migration OK: ') . $dbPath . "\n";
