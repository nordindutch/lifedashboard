<?php

declare(strict_types=1);

/**
 * Gedeelde bootstrap voor de front controller, de migratie-CLI en tests:
 * PSR-4 autoloader voor de namespace Codex\ (zonder Composer-afhankelijkheid).
 * Als vendor/autoload.php bestaat (Composer), wordt die ook geladen.
 */
spl_autoload_register(static function (string $class): void {
    $prefix = 'Codex\\';
    $base = __DIR__ . '/src/';
    if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
        return;
    }
    $rel = substr($class, strlen($prefix));
    $file = $base . str_replace('\\', '/', $rel) . '.php';
    if (is_readable($file)) {
        require $file;
    }
});

if (is_readable(__DIR__ . '/vendor/autoload.php')) {
    require __DIR__ . '/vendor/autoload.php';
}
