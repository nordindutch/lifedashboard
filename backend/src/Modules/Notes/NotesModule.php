<?php

declare(strict_types=1);

namespace Codex\Modules\Notes;

use Codex\Controllers\NoteController;
use Codex\Core\AbstractModule;
use Codex\Core\Request;
use Codex\Core\Router;
use Codex\Repositories\NoteRepository;

final class NotesModule extends AbstractModule
{
    public function id(): string
    {
        return 'notes';
    }

    public function migrationsDir(): ?string
    {
        return $this->defaultMigrationsDir(__FILE__);
    }

    public function registerRoutes(Router $router): void
    {
        $notes = $this->lazy(static fn (): NoteController => new NoteController(NoteRepository::make()));

        $router->get('/api/notes', static fn (Request $r) => $notes()->index($r));
        $router->post('/api/notes', static fn (Request $r) => $notes()->store($r));
        $router->get('/api/notes/:id', static fn (Request $r) => $notes()->show($r));
        $router->put('/api/notes/:id', static fn (Request $r) => $notes()->update($r));
        $router->delete('/api/notes/:id', static fn (Request $r) => $notes()->destroy($r));
    }
}
