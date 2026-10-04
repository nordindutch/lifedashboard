<?php

declare(strict_types=1);

namespace Codex\Modules\Core;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;

/**
 * Publieke endpoints voor versie en gezondheid.
 *
 * GET /api/version  versie (backend/VERSION), build (backend/BUILD of env CODEX_BUILD) en
 *                   downloadlocaties voor Android en desktop, afgeleid van RELEASE_REPO.
 * GET /api/health   controleert of de database leesbaar is; gebruikt door deploy/deploy.sh.
 */
final class VersionController
{
    public static function version(): string
    {
        $file = dirname(__DIR__, 3) . '/VERSION';
        $v = is_readable($file) ? trim((string) file_get_contents($file)) : '';

        return $v !== '' ? $v : '0.0.0';
    }

    public static function build(): ?string
    {
        $env = getenv('CODEX_BUILD');
        if (is_string($env) && $env !== '') {
            return $env;
        }
        $file = dirname(__DIR__, 3) . '/BUILD';
        if (is_readable($file)) {
            $b = trim((string) file_get_contents($file));

            return $b !== '' ? $b : null;
        }

        return null;
    }

    /** Android versionCode zoals scripts/sync-version.mjs hem afleidt: major*10000 + minor*100 + patch. */
    public static function versionCode(string $version): int
    {
        if (!preg_match('/^(\d+)\.(\d+)\.(\d+)/', $version, $m)) {
            return 0;
        }

        return (int) $m[1] * 10000 + (int) $m[2] * 100 + (int) $m[3];
    }

    public function index(Request $request): void
    {
        unset($request);
        $version = self::version();
        $repo = getenv('RELEASE_REPO');
        $repo = is_string($repo) && $repo !== '' ? trim($repo, '/') : null;
        $base = $repo !== null ? 'https://github.com/' . $repo . '/releases' : null;

        Response::success([
            'version' => $version,
            'build' => self::build(),
            'android' => [
                'version' => $version,
                'version_code' => self::versionCode($version),
                'download_url' => $base !== null ? $base . '/latest/download/codex-android.apk' : null,
                'release_url' => $base !== null ? $base . '/latest' : null,
            ],
            'desktop' => [
                'version' => $version,
                'latest_json_url' => $base !== null ? $base . '/latest/download/latest.json' : null,
                'release_url' => $base !== null ? $base . '/latest' : null,
            ],
        ]);
    }

    public function health(Request $request): void
    {
        unset($request);
        $dbOk = false;
        $migrations = null;
        try {
            $db = Database::getInstance();
            $dbOk = $db->query('SELECT 1')->fetchColumn() !== false;
            $count = $db->query('SELECT COUNT(*) FROM schema_migrations')->fetchColumn();
            $migrations = $count !== false ? (int) $count : null;
        } catch (\Throwable $e) {
            error_log('health: ' . $e->getMessage());
        }

        $payload = [
            'status' => $dbOk ? 'ok' : 'degraded',
            'version' => self::version(),
            'build' => self::build(),
            'database' => $dbOk,
            'migrations' => $migrations,
            'time' => time(),
        ];
        if ($dbOk) {
            Response::success($payload);
        } else {
            Response::json(['success' => false, 'data' => $payload, 'error' => ['code' => 'degraded', 'message' => 'Database niet bereikbaar']], 503);
        }
    }
}
