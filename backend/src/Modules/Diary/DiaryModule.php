<?php

declare(strict_types=1);

namespace Codex\Modules\Diary;

use Codex\Controllers\DiaryController;
use Codex\Core\AbstractModule;
use Codex\Core\Request;
use Codex\Core\Router;
use Codex\Repositories\DiaryRepository;

final class DiaryModule extends AbstractModule
{
    public function id(): string
    {
        return 'diary';
    }

    public function migrationsDir(): ?string
    {
        return $this->defaultMigrationsDir(__FILE__);
    }

    public function registerRoutes(Router $router): void
    {
        $diary = $this->lazy(static fn (): DiaryController => new DiaryController(DiaryRepository::make()));

        $router->get('/api/diary', static fn (Request $r) => $diary()->index($r));
        $router->post('/api/diary', static fn (Request $r) => $diary()->store($r));
        $router->get('/api/diary/:id', static fn (Request $r) => $diary()->show($r));
        $router->put('/api/diary/:id', static fn (Request $r) => $diary()->update($r));
        $router->delete('/api/diary/:id', static fn (Request $r) => $diary()->destroy($r));
    }
}
