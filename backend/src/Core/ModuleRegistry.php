<?php

declare(strict_types=1);

namespace Codex\Core;

/**
 * Laadt de modulelijst uit src/Modules/modules.php.
 */
final class ModuleRegistry
{
    /** @var list<ModuleInterface>|null */
    private static ?array $modules = null;

    /**
     * @return list<ModuleInterface>
     */
    public static function all(): array
    {
        if (self::$modules !== null) {
            return self::$modules;
        }
        /** @var list<class-string<ModuleInterface>> $classes */
        $classes = require dirname(__DIR__) . '/Modules/modules.php';
        $out = [];
        foreach ($classes as $class) {
            $module = new $class();
            if (!$module instanceof ModuleInterface) {
                throw new \RuntimeException(sprintf('%s implementeert ModuleInterface niet', $class));
            }
            $out[] = $module;
        }
        self::$modules = $out;

        return $out;
    }

    /**
     * Alle migratiemappen: de kernmap plus die van elke module.
     *
     * @return list<string>
     */
    public static function migrationDirs(string $coreDir): array
    {
        $dirs = [$coreDir];
        foreach (self::all() as $module) {
            $dir = $module->migrationsDir();
            if ($dir !== null && is_dir($dir)) {
                $dirs[] = $dir;
            }
        }

        return $dirs;
    }

    /**
     * @return list<string>
     */
    public static function publicPaths(): array
    {
        $paths = [];
        foreach (self::all() as $module) {
            foreach ($module->publicPaths() as $p) {
                $paths[] = $p;
            }
        }

        return array_values(array_unique($paths));
    }

    public static function registerAllRoutes(Router $router): void
    {
        foreach (self::all() as $module) {
            $module->registerRoutes($router);
        }
    }
}
