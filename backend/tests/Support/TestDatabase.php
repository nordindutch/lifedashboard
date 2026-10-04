<?php

declare(strict_types=1);

namespace Codex\Tests\Support;

use Codex\Core\Database;
use PDO;

/**
 * Verse database per test: verwijdert het bestand en draait de echte migratie-CLI,
 * zodat tests ook de migraties zelf dekken.
 */
final class TestDatabase
{
    public static function fresh(): PDO
    {
        $path = Database::path();
        Database::resetForTesting();
        foreach ([$path, $path . '-wal', $path . '-shm', $path . '-journal'] as $f) {
            if (file_exists($f)) {
                unlink($f);
            }
        }

        $migrate = dirname(__DIR__, 2) . '/database/migrate.php';
        $cmd = sprintf(
            'CODEX_DB_PATH=%s %s %s 2>&1',
            escapeshellarg($path),
            escapeshellarg(PHP_BINARY),
            escapeshellarg($migrate),
        );
        exec($cmd, $output, $exit);
        if ($exit !== 0) {
            throw new \RuntimeException("migrate.php failed:\n" . implode("\n", $output));
        }

        return Database::getInstance();
    }
}
