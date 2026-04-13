#!/usr/bin/env php
<?php

declare(strict_types=1);

$baseDir = dirname(__DIR__);
$schemaPath = __DIR__ . '/schema.sql';
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

echo "Migration OK: {$dbPath}\n";
