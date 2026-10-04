<?php

declare(strict_types=1);

namespace Codex\Modules\Hello;

use Codex\Core\AbstractModule;
use Codex\Core\Router;

/**
 * Minimale voorbeeldmodule (zie docs/ADD_MODULE.md).
 * Eén route, één controller, en een voorbeeldmigratie die niet wordt uitgevoerd
 * (extensie .sql.example) zodat productie geen hello-tabel krijgt.
 */
final class HelloModule extends AbstractModule
{
    public function id(): string
    {
        return 'hello';
    }

    public function migrationsDir(): ?string
    {
        return $this->defaultMigrationsDir(__FILE__);
    }

    public function registerRoutes(Router $router): void
    {
        $controller = new HelloController();
        $router->get('/api/hello', [$controller, 'index']);
    }
}
