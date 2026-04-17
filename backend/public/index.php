<?php

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Codex\\';
    $base = dirname(__DIR__) . '/src/';
    if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
        return;
    }
    $rel = substr($class, strlen($prefix));
    $file = $base . str_replace('\\', '/', $rel) . '.php';
    if (is_readable($file)) {
        require $file;
    }
});

use Codex\Controllers\BriefingController;
use Codex\Controllers\BudgetController;
use Codex\Controllers\AuthController;
use Codex\Controllers\AiController;
use Codex\Controllers\DiaryController;
use Codex\Controllers\GoalController;
use Codex\Controllers\NoteController;
use Codex\Controllers\ProjectController;
use Codex\Controllers\SettingsController;
use Codex\Controllers\TaskController;
use Codex\Core\Middleware;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Core\Router;
use Codex\Repositories\DiaryRepository;
use Codex\Repositories\AiPlanRepository;
use Codex\Repositories\GoalRepository;
use Codex\Repositories\NoteRepository;
use Codex\Repositories\ProjectRepository;
use Codex\Repositories\TaskRepository;

$backendRoot = dirname(__DIR__);

if (is_readable($backendRoot . '/.env')) {
    $lines = file($backendRoot . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines !== false) {
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            if (!str_contains($line, '=')) {
                continue;
            }
            [$k, $v] = explode('=', $line, 2);
            $k = trim($k);
            $v = trim($v);
            // Do not apply empty values — they would wipe keys injected by Docker (e.g. CODEX_API_KEY).
            if ($v === '') {
                continue;
            }
            putenv("{$k}={$v}");
            $_ENV[$k] = $v;
        }
    }
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['http://localhost:5173', 'http://localhost:5273', 'http://localhost:8180'];
$prodUrl = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');
if ($prodUrl !== '') {
    $allowedOrigins[] = rtrim($prodUrl, '/');
}
$allowOrigin = in_array($origin, $allowedOrigins, true) ? $origin : ($allowedOrigins[0] ?? '*');
header('Access-Control-Allow-Origin: ' . $allowOrigin);
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Codex-Key, Authorization, X-Codex-Session');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawBody = file_get_contents('php://input') ?: '';
$request = Request::fromGlobals($_SERVER, $rawBody);

$publicPaths = [
    '/api/auth/google',
    '/api/auth/google/callback',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/auth/tauri/claim',
];
if (!in_array($request->getPath(), $publicPaths, true)) {
    $userId = Middleware::sessionAuth($request);
    if ($userId === null) {
        exit;
    }
}

$router = new Router();

// Lazy-init goals + DB only for /api/goals* — avoids 500 on /api/briefing when SQLite is missing or not migrated yet.
$goalController = null;
$goalsController = static function () use (&$goalController): GoalController {
    if ($goalController === null) {
        $goalController = new GoalController(GoalRepository::make());
    }

    return $goalController;
};

$diaryController = null;
$diariesController = static function () use (&$diaryController): DiaryController {
    if ($diaryController === null) {
        $diaryController = new DiaryController(DiaryRepository::make());
    }

    return $diaryController;
};

$taskController = null;
$tasksController = static function () use (&$taskController): TaskController {
    if ($taskController === null) {
        $taskController = new TaskController(TaskRepository::make());
    }

    return $taskController;
};

$projectController = null;
$projectsController = static function () use (&$projectController): ProjectController {
    if ($projectController === null) {
        $projectController = new ProjectController(ProjectRepository::make());
    }

    return $projectController;
};

$noteController = null;
$notesController = static function () use (&$noteController): NoteController {
    if ($noteController === null) {
        $noteController = new NoteController(NoteRepository::make());
    }

    return $noteController;
};

$briefingController = new BriefingController();
$budgetController = new BudgetController();
$authController = new AuthController();
$settingsController = new SettingsController();
$aiController = null;
$aiCtrl = static function () use (&$aiController): AiController {
    if ($aiController === null) {
        $aiController = new AiController(AiPlanRepository::make());
    }

    return $aiController;
};
$router->get('/api/auth/me', [$authController, 'me']);
$router->post('/api/auth/logout', [$authController, 'logout']);
$router->post('/api/auth/tauri/claim', [$authController, 'tauriClaim']);

$router->get('/api/briefing', [$briefingController, 'index']);
$router->get('/api/evening-plan', [$briefingController, 'eveningPlan']);
$router->get('/api/ai/plan', static fn (Request $r) => $aiCtrl()->getPlan($r));
$router->post('/api/ai/plan/generate', static fn (Request $r) => $aiCtrl()->generate($r));
$router->get('/api/ai/history', static fn (Request $r) => $aiCtrl()->history($r));
$router->get('/api/auth/google', [$settingsController, 'googleAuth']);
$router->get('/api/auth/google/callback', [$settingsController, 'googleCallback']);
$router->delete('/api/auth/google', [$settingsController, 'revokeGoogle']);
$router->post('/api/calendar/sync', [$settingsController, 'syncCalendar']);
$router->post('/api/calendar/events', [$settingsController, 'createCalendarEvent']);
$router->delete('/api/calendar/events/:id', [$settingsController, 'deleteCalendarEvent']);
$router->post('/api/gmail/sync', [$settingsController, 'syncGmail']);
$router->get('/api/integrations/status', [$settingsController, 'integrationStatus']);
$router->get('/api/settings/weather-test', [$settingsController, 'weatherTest']);
$router->get('/api/settings', [$settingsController, 'index']);
$router->put('/api/settings', [$settingsController, 'update']);

$router->get('/api/budget/:month', [$budgetController, 'getMonth']);
$router->put('/api/budget/:month', [$budgetController, 'updateMonth']);
$router->post('/api/budget/:month/income', [$budgetController, 'upsertIncome']);
$router->post('/api/budget/:month/expenses', [$budgetController, 'upsertExpense']);
$router->delete('/api/budget/:month/income/:id', [$budgetController, 'deleteIncome']);
$router->delete('/api/budget/:month/expenses/:id', [$budgetController, 'deleteExpense']);
$router->post('/api/budget/:month/copy-previous', [$budgetController, 'copyFromPrevious']);

$router->get('/api/diary', static function (Request $request) use ($diariesController): void {
    $diariesController()->index($request);
});
$router->post('/api/diary', static function (Request $request) use ($diariesController): void {
    $diariesController()->store($request);
});
$router->get('/api/diary/:id', static function (Request $request) use ($diariesController): void {
    $diariesController()->show($request);
});
$router->put('/api/diary/:id', static function (Request $request) use ($diariesController): void {
    $diariesController()->update($request);
});
$router->delete('/api/diary/:id', static function (Request $request) use ($diariesController): void {
    $diariesController()->destroy($request);
});

$router->get('/api/tasks', static function (Request $request) use ($tasksController): void {
    $tasksController()->index($request);
});
$router->post('/api/tasks', static function (Request $request) use ($tasksController): void {
    $tasksController()->store($request);
});
$router->patch('/api/tasks/reorder', static function (Request $request) use ($tasksController): void {
    $tasksController()->reorder($request);
});
$router->get('/api/tasks/:id', static function (Request $request) use ($tasksController): void {
    $tasksController()->show($request);
});
$router->put('/api/tasks/:id', static function (Request $request) use ($tasksController): void {
    $tasksController()->update($request);
});
$router->delete('/api/tasks/:id', static function (Request $request) use ($tasksController): void {
    $tasksController()->destroy($request);
});
$router->patch('/api/tasks/:id/canvas', static function (Request $request) use ($tasksController): void {
    $tasksController()->patchCanvas($request);
});

$router->get('/api/notes', static fn (Request $r) => $notesController()->index($r));
$router->post('/api/notes', static fn (Request $r) => $notesController()->store($r));
$router->get('/api/notes/:id', static fn (Request $r) => $notesController()->show($r));
$router->put('/api/notes/:id', static fn (Request $r) => $notesController()->update($r));
$router->delete('/api/notes/:id', static fn (Request $r) => $notesController()->destroy($r));

$router->get('/api/projects', static function (Request $request) use ($projectsController): void {
    $projectsController()->index($request);
});
$router->post('/api/projects', static function (Request $request) use ($projectsController): void {
    $projectsController()->store($request);
});
$router->get('/api/projects/:id', static function (Request $request) use ($projectsController): void {
    $projectsController()->show($request);
});
$router->put('/api/projects/:id', static function (Request $request) use ($projectsController): void {
    $projectsController()->update($request);
});
$router->delete('/api/projects/:id', static function (Request $request) use ($projectsController): void {
    $projectsController()->destroy($request);
});

$router->get('/api/goals', static function (Request $request) use ($goalsController): void {
    $goalsController()->index($request);
});
$router->post('/api/goals', static function (Request $request) use ($goalsController): void {
    $goalsController()->store($request);
});
$router->get('/api/goals/:id', static function (Request $request) use ($goalsController): void {
    $goalsController()->show($request);
});
$router->put('/api/goals/:id', static function (Request $request) use ($goalsController): void {
    $goalsController()->update($request);
});
$router->delete('/api/goals/:id', static function (Request $request) use ($goalsController): void {
    $goalsController()->destroy($request);
});

if ($router->dispatch($request)) {
    exit;
}

Response::error('not_found', 'No route matched', 404);
