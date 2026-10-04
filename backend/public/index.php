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

require dirname(__DIR__) . '/bootstrap.php';

use Codex\Core\Middleware;
use Codex\Core\ModuleRegistry;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Core\Router;

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

$publicPaths = ModuleRegistry::publicPaths();
if (!in_array($request->getPath(), $publicPaths, true)) {
    $userId = Middleware::sessionAuth($request);
    if ($userId === null) {
        exit;
    }
}

$router = new Router();
// Elke module registreert zijn eigen routes (src/Modules/modules.php).
ModuleRegistry::registerAllRoutes($router);

if ($router->dispatch($request)) {
    exit;
}

Response::error('not_found', 'No route matched', 404);
