#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Set or update a user's password (for Google-only accounts or recovery).
 *
 * Usage: php set_password.php <email> <new_password>
 */

if ($argc < 3) {
    fwrite(STDERR, "Usage: php set_password.php <email> <new_password>\n");
    exit(1);
}

$email = trim((string) $argv[1]);
$plain = (string) $argv[2];

if ($email === '' || strlen($plain) < 10) {
    fwrite(STDERR, "Email required; password must be at least 10 characters.\n");
    exit(1);
}

$baseDir = dirname(__DIR__);
$dbPath = $baseDir . '/database/codex.sqlite';

if (!is_readable($dbPath)) {
    fwrite(STDERR, "Database not found: {$dbPath}\n");
    exit(1);
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

$hash = password_hash($plain, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ? COLLATE NOCASE');
$stmt->execute([$hash, $email]);

if ($stmt->rowCount() < 1) {
    fwrite(STDERR, "No user found with that email.\n");
    exit(1);
}

fwrite(STDOUT, "Password updated for {$email}\n");
