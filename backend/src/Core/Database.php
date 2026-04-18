<?php

declare(strict_types=1);

namespace Codex\Core;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $instance = null;

    public static function getInstance(): PDO
    {
        if (self::$instance !== null) {
            return self::$instance;
        }

        $baseDir = dirname(__DIR__, 2);
        $path = $baseDir . '/database/codex.sqlite';
        $dsn = 'sqlite:' . $path;

        try {
            $pdo = new PDO($dsn, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $e) {
            throw new \RuntimeException('Database connection failed: ' . $e->getMessage(), 0, $e);
        }

        $pdo->exec('PRAGMA journal_mode = WAL;');
        $pdo->exec('PRAGMA foreign_keys = ON;');
        $pdo->exec('PRAGMA synchronous = NORMAL;');
        // Wait up to 10s when another request (OAuth callback, calendar sync, etc.) holds the DB.
        // Without this, concurrent SQLite access often surfaces as SQLSTATE[HY000] "database is locked".
        $pdo->exec('PRAGMA busy_timeout = 10000;');

        self::$instance = $pdo;
        return self::$instance;
    }

    public static function resetForTesting(): void
    {
        self::$instance = null;
    }
}
