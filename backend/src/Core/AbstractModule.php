<?php

declare(strict_types=1);

namespace Codex\Core;

/**
 * Basisklasse met zinnige standaardwaarden: geen migraties, geen publieke paden,
 * en een helper om controllers pas bij het eerste verzoek te instantiëren.
 */
abstract class AbstractModule implements ModuleInterface
{
    public function migrationsDir(): ?string
    {
        return null;
    }

    public function publicPaths(): array
    {
        return [];
    }

    /**
     * Lazy-init: DB-gebonden controllers pas maken bij gebruik, zodat een ontbrekende of
     * nog niet gemigreerde database geen 500 geeft op routes die hem niet nodig hebben.
     *
     * @template T of object
     * @param callable(): T $factory
     * @return callable(): T
     */
    protected function lazy(callable $factory): callable
    {
        $instance = null;

        return static function () use (&$instance, $factory) {
            return $instance ??= $factory();
        };
    }

    /**
     * Standaardmap voor module-migraties: <ModuleDir>/migrations.
     */
    protected function defaultMigrationsDir(string $moduleFile): ?string
    {
        $dir = dirname($moduleFile) . '/migrations';

        return is_dir($dir) ? $dir : null;
    }
}
