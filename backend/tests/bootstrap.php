<?php

declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';

// Elke testrun krijgt een eigen SQLite-bestand; zie Codex\Tests\Support\TestDatabase.
$dbDir = sys_get_temp_dir() . '/codex-tests-' . getmypid();
if (!is_dir($dbDir)) {
    mkdir($dbDir, 0777, true);
}
putenv('CODEX_DB_PATH=' . $dbDir . '/codex.sqlite');
$_ENV['CODEX_DB_PATH'] = $dbDir . '/codex.sqlite';

register_shutdown_function(static function () use ($dbDir): void {
    foreach (glob($dbDir . '/*') ?: [] as $f) {
        @unlink($f);
    }
    @rmdir($dbDir);
});
