<?php

declare(strict_types=1);

namespace Codex\Modules\Tasks;

use Codex\Controllers\GoalController;
use Codex\Controllers\ProjectController;
use Codex\Controllers\TaskController;
use Codex\Core\AbstractModule;
use Codex\Core\Request;
use Codex\Core\Router;
use Codex\Repositories\GoalRepository;
use Codex\Repositories\ProjectRepository;
use Codex\Repositories\TaskRepository;

/** Taken, projecten en doelen (Kanban). */
final class TasksModule extends AbstractModule
{
    public function id(): string
    {
        return 'tasks';
    }

    public function migrationsDir(): ?string
    {
        return $this->defaultMigrationsDir(__FILE__);
    }

    public function registerRoutes(Router $router): void
    {
        $tasks = $this->lazy(static fn (): TaskController => new TaskController(TaskRepository::make()));
        $projects = $this->lazy(static fn (): ProjectController => new ProjectController(ProjectRepository::make()));
        $goals = $this->lazy(static fn (): GoalController => new GoalController(GoalRepository::make()));

        $router->get('/api/tasks', static fn (Request $r) => $tasks()->index($r));
        $router->post('/api/tasks', static fn (Request $r) => $tasks()->store($r));
        $router->patch('/api/tasks/reorder', static fn (Request $r) => $tasks()->reorder($r));
        $router->post('/api/tasks/archive-completed', static fn (Request $r) => $tasks()->archiveCompleted($r));
        $router->get('/api/tasks/:id', static fn (Request $r) => $tasks()->show($r));
        $router->put('/api/tasks/:id', static fn (Request $r) => $tasks()->update($r));
        $router->delete('/api/tasks/:id', static fn (Request $r) => $tasks()->destroy($r));
        $router->patch('/api/tasks/:id/canvas', static fn (Request $r) => $tasks()->patchCanvas($r));

        $router->get('/api/projects', static fn (Request $r) => $projects()->index($r));
        $router->post('/api/projects', static fn (Request $r) => $projects()->store($r));
        $router->get('/api/projects/:id', static fn (Request $r) => $projects()->show($r));
        $router->put('/api/projects/:id', static fn (Request $r) => $projects()->update($r));
        $router->delete('/api/projects/:id', static fn (Request $r) => $projects()->destroy($r));

        $router->get('/api/goals', static fn (Request $r) => $goals()->index($r));
        $router->post('/api/goals', static fn (Request $r) => $goals()->store($r));
        $router->get('/api/goals/:id', static fn (Request $r) => $goals()->show($r));
        $router->put('/api/goals/:id', static fn (Request $r) => $goals()->update($r));
        $router->delete('/api/goals/:id', static fn (Request $r) => $goals()->destroy($r));
    }
}
