<?php

declare(strict_types=1);

namespace Codex\Core;

/**
 * Een module bundelt zijn eigen routes en migraties. Modules worden geregistreerd in
 * src/Modules/modules.php; de front controller en migrate.php lezen die lijst.
 * Zie docs/ADD_MODULE.md.
 */
interface ModuleInterface
{
    /** Stabiele id, gelijk aan de frontend-module-id (bijvoorbeeld "budget"). */
    public function id(): string;

    /** Registreer alle HTTP-routes van deze module. */
    public function registerRoutes(Router $router): void;

    /**
     * Absolute map met .sql-migraties voor deze module, of null.
     * Bestandsnamen moeten uniek zijn over de hele repo (NNN_naam.sql).
     */
    public function migrationsDir(): ?string;

    /**
     * Paden die zonder sessie bereikbaar zijn (bijvoorbeeld login).
     *
     * @return list<string>
     */
    public function publicPaths(): array;
}
