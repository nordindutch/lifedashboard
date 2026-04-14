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
use Codex\Controllers\DiaryController;
use Codex\Controllers\GoalController;
use Codex\Controllers\SettingsController;
use Codex\Core\Middleware;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Core\Router;
use Codex\Repositories\DiaryRepository;
use Codex\Repositories\GoalRepository;

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

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Codex-Key, Authorization');

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
];
if (!in_array($request->getPath(), $publicPaths, true)) {
    if (!Middleware::apiKeyAuth($request)) {
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

$briefingController = new BriefingController();
$settingsController = new SettingsController();
$router->get('/api/briefing', [$briefingController, 'index']);
$router->get('/api/auth/google', [$settingsController, 'googleAuth']);
$router->get('/api/auth/google/callback', [$settingsController, 'googleCallback']);
$router->delete('/api/auth/google', [$settingsController, 'revokeGoogle']);
$router->post('/api/calendar/sync', [$settingsController, 'syncCalendar']);
$router->get('/api/integrations/status', [$settingsController, 'integrationStatus']);
$router->get('/api/settings/weather-test', [$settingsController, 'weatherTest']);
$router->get('/api/settings', [$settingsController, 'index']);
$router->put('/api/settings', [$settingsController, 'update']);

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
