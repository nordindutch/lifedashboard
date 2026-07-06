<?php

declare(strict_types=1);

ob_start();

set_exception_handler(static function (\Throwable $e): void {
    ob_end_clean();
    // Full details go to the server log only — never to the client.
    error_log(sprintf('[codex] Uncaught %s: %s in %s:%d', $e::class, $e->getMessage(), $e->getFile(), $e->getLine()));
    if (!headers_sent()) {
        header('Content-Type: application/json');
        http_response_code(500);
    }
    $error = ['code' => 'internal_error', 'message' => 'An unexpected server error occurred'];
    if (getenv('APP_DEBUG') === 'true') {
        $error['message'] = $e->getMessage();
        $error['file'] = basename($e->getFile()) . ':' . $e->getLine();
    }
    echo json_encode(['success' => false, 'error' => $error]);
    exit;
});

register_shutdown_function(static function (): void {
    $err = error_get_last();
    if ($err !== null && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        ob_end_clean();
        if (!headers_sent()) {
            header('Content-Type: application/json');
            http_response_code(500);
        }
        echo json_encode([
            'success' => false,
            'error' => ['code' => 'internal_error', 'message' => 'An unexpected server error occurred'],
        ]);
    }
});

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

use Codex\Controllers\AccountController;
use Codex\Controllers\BriefingController;
use Codex\Controllers\BudgetController;
use Codex\Controllers\DebtController;
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
            // Strip optional surrounding quotes (KEY="value" / KEY='value')
            if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && str_ends_with($v, $v[0])) {
                $v = substr($v, 1, -1);
            }
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
$allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5273',
    'http://localhost:8180',
    // Tauri v2 desktop webview (XHR/fetch to remote API)
    'http://tauri.localhost',
];
$prodUrl = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');
if (is_string($prodUrl) && $prodUrl !== '') {
    $allowedOrigins[] = rtrim($prodUrl, '/');
}

$allowOrigin = in_array($origin, $allowedOrigins, true) ? $origin : '';
if ($allowOrigin !== '') {
    header('Access-Control-Allow-Origin: ' . $allowOrigin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Codex-Session, Authorization');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$rawBody = file_get_contents('php://input') ?: '';
$request = Request::fromGlobals($_SERVER, $rawBody);

$publicPaths = [
    '/api/auth/google/callback',
    '/api/auth/me',
    '/api/auth/logout',
    '/api/auth/login',
    '/api/auth/setup',
    '/api/auth/bootstrap',
];
if (!in_array($request->getPath(), $publicPaths, true)) {
    $userId = Middleware::sessionAuth($request);
    if ($userId === null) {
        exit;
    }
}

$router = new Router();

// Lazy-init DB-backed controllers — avoids 500 on /api/briefing when SQLite is missing or not migrated yet.
$lazy = static function (callable $factory): callable {
    $instance = null;
    return static function () use (&$instance, $factory) {
        return $instance ??= $factory();
    };
};

$goalsController = $lazy(static fn (): GoalController => new GoalController(GoalRepository::make()));
$diariesController = $lazy(static fn (): DiaryController => new DiaryController(DiaryRepository::make()));
$tasksController = $lazy(static fn (): TaskController => new TaskController(TaskRepository::make()));
$projectsController = $lazy(static fn (): ProjectController => new ProjectController(ProjectRepository::make()));
$notesController = $lazy(static fn (): NoteController => new NoteController(NoteRepository::make()));
$aiCtrl = $lazy(static fn (): AiController => new AiController(AiPlanRepository::make()));

$briefingController = new BriefingController();
$budgetController = new BudgetController();
$accountController = new AccountController();
$debtController = new DebtController();
$authController = new AuthController();
$settingsController = new SettingsController();

$router->get('/api/auth/me', [$authController, 'me']);
$router->get('/api/auth/bootstrap', [$authController, 'bootstrap']);
$router->post('/api/auth/login', [$authController, 'login']);
$router->post('/api/auth/setup', [$authController, 'setup']);
$router->post('/api/auth/logout', [$authController, 'logout']);

$router->get('/api/briefing', [$briefingController, 'index']);
$router->get('/api/evening-plan', [$briefingController, 'eveningPlan']);
$router->get('/api/ai/plan', static fn (Request $r) => $aiCtrl()->getPlan($r));
$router->post('/api/ai/plan/generate', static fn (Request $r) => $aiCtrl()->generate($r));
$router->get('/api/ai/history', static fn (Request $r) => $aiCtrl()->history($r));

$router->get('/api/integrations/google/oauth-url', [$settingsController, 'googleIntegrationOAuthUrl']);
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

$router->get('/api/budget/accounts', [$accountController, 'index']);
$router->post('/api/budget/accounts', [$accountController, 'upsert']);
$router->delete('/api/budget/accounts/:id', [$accountController, 'destroy']);

$router->get('/api/budget/debts', [$debtController, 'index']);
$router->post('/api/budget/debts', [$debtController, 'upsert']);
$router->delete('/api/budget/debts/:id', [$debtController, 'destroy']);

$router->get('/api/budget/analytics', [$budgetController, 'analytics']);
$router->get('/api/budget/insights', [$budgetController, 'insights']);

$router->get('/api/budget/:month', [$budgetController, 'getMonth']);
$router->put('/api/budget/:month', [$budgetController, 'updateMonth']);
$router->post('/api/budget/:month/income', [$budgetController, 'upsertIncome']);
$router->post('/api/budget/:month/expenses', [$budgetController, 'upsertExpense']);
$router->delete('/api/budget/:month/income/:id', [$budgetController, 'deleteIncome']);
$router->delete('/api/budget/:month/expenses/:id', [$budgetController, 'deleteExpense']);
$router->post('/api/budget/:month/copy-previous', [$budgetController, 'copyFromPrevious']);

$router->get('/api/diary', static fn (Request $r) => $diariesController()->index($r));
$router->post('/api/diary', static fn (Request $r) => $diariesController()->store($r));
$router->get('/api/diary/:id', static fn (Request $r) => $diariesController()->show($r));
$router->put('/api/diary/:id', static fn (Request $r) => $diariesController()->update($r));
$router->delete('/api/diary/:id', static fn (Request $r) => $diariesController()->destroy($r));

$router->get('/api/tasks', static fn (Request $r) => $tasksController()->index($r));
$router->post('/api/tasks', static fn (Request $r) => $tasksController()->store($r));
$router->patch('/api/tasks/reorder', static fn (Request $r) => $tasksController()->reorder($r));
$router->post('/api/tasks/archive-completed', static fn (Request $r) => $tasksController()->archiveCompleted($r));
$router->get('/api/tasks/:id', static fn (Request $r) => $tasksController()->show($r));
$router->put('/api/tasks/:id', static fn (Request $r) => $tasksController()->update($r));
$router->delete('/api/tasks/:id', static fn (Request $r) => $tasksController()->destroy($r));
$router->patch('/api/tasks/:id/canvas', static fn (Request $r) => $tasksController()->patchCanvas($r));

$router->get('/api/notes', static fn (Request $r) => $notesController()->index($r));
$router->post('/api/notes', static fn (Request $r) => $notesController()->store($r));
$router->get('/api/notes/:id', static fn (Request $r) => $notesController()->show($r));
$router->put('/api/notes/:id', static fn (Request $r) => $notesController()->update($r));
$router->delete('/api/notes/:id', static fn (Request $r) => $notesController()->destroy($r));

$router->get('/api/projects', static fn (Request $r) => $projectsController()->index($r));
$router->post('/api/projects', static fn (Request $r) => $projectsController()->store($r));
$router->get('/api/projects/:id', static fn (Request $r) => $projectsController()->show($r));
$router->put('/api/projects/:id', static fn (Request $r) => $projectsController()->update($r));
$router->delete('/api/projects/:id', static fn (Request $r) => $projectsController()->destroy($r));

$router->get('/api/goals', static fn (Request $r) => $goalsController()->index($r));
$router->post('/api/goals', static fn (Request $r) => $goalsController()->store($r));
$router->get('/api/goals/:id', static fn (Request $r) => $goalsController()->show($r));
$router->put('/api/goals/:id', static fn (Request $r) => $goalsController()->update($r));
$router->delete('/api/goals/:id', static fn (Request $r) => $goalsController()->destroy($r));

if ($router->dispatch($request)) {
    exit;
}

Response::error('not_found', 'No route matched', 404);
