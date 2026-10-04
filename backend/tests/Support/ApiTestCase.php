<?php

declare(strict_types=1);

namespace Codex\Tests\Support;

use Codex\Core\ModuleRegistry;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Core\Router;
use PDO;
use PHPUnit\Framework\TestCase;

/**
 * Basis voor API-tests: echte router met alle module-routes, verse database,
 * en Response in capture-modus (geen headers in CLI).
 */
abstract class ApiTestCase extends TestCase
{
    protected PDO $db;
    protected Router $router;

    protected function setUp(): void
    {
        parent::setUp();
        $this->db = TestDatabase::fresh();
        $this->router = new Router();
        ModuleRegistry::registerAllRoutes($this->router);
        Response::enableCapture(true);
    }

    protected function tearDown(): void
    {
        Response::enableCapture(false);
        parent::tearDown();
    }

    /**
     * @param array<string, mixed>|null $body
     * @return array{status: int, json: array<string, mixed>}
     */
    protected function call(string $method, string $path, ?array $body = null): array
    {
        $raw = $body === null ? '' : (json_encode($body, JSON_THROW_ON_ERROR) ?: '');
        $request = new Request(strtoupper($method), $path, ['content-type' => 'application/json'], [], $raw);
        ob_start();
        try {
            $matched = $this->router->dispatch($request);
        } finally {
            $out = (string) ob_get_clean();
        }
        if (!$matched) {
            return ['status' => 404, 'json' => ['success' => false, 'error' => ['code' => 'not_found', 'message' => 'No route matched']]];
        }
        /** @var array<string, mixed> $json */
        $json = json_decode($out, true, 512, JSON_THROW_ON_ERROR);

        return ['status' => Response::capturedStatus(), 'json' => $json];
    }

    /**
     * @return array<string, mixed>
     */
    protected function assertOk(array $res): array
    {
        $this->assertSame(200, $res['status'], json_encode($res['json']));
        $this->assertTrue($res['json']['success'] ?? false, json_encode($res['json']));
        /** @var array<string, mixed> $data */
        $data = $res['json']['data'];

        return $data;
    }
}
