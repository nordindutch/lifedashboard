<?php

declare(strict_types=1);

namespace Codex\Core;

use Codex\Core\Database;

final class Middleware
{
    public static function apiKeyAuth(Request $request): bool
    {
        $expected = self::codexApiKeyFromEnvironment();
        if ($expected === false || $expected === '') {
            Response::error('config_error', 'CODEX_API_KEY is not configured', 500);
            return false;
        }
        $provided = $request->getHeader('x-codex-key');
        if ($provided === null || !hash_equals((string) $expected, $provided)) {
            Response::error('unauthorized', 'Invalid or missing X-Codex-Key header', 401);
            return false;
        }
        return true;
    }

    /**
     * Resolve API key from the environment. Apache/mod_php often omits Docker `ENV` from getenv()
     * unless PassEnv is set; $_SERVER / $_ENV may still contain the value.
     *
     * @return string|false
     */
    private static function codexApiKeyFromEnvironment(): string|false
    {
        $g = getenv('CODEX_API_KEY');
        if (is_string($g) && $g !== '') {
            return $g;
        }
        if (isset($_SERVER['CODEX_API_KEY']) && is_string($_SERVER['CODEX_API_KEY']) && $_SERVER['CODEX_API_KEY'] !== '') {
            return $_SERVER['CODEX_API_KEY'];
        }
        if (isset($_ENV['CODEX_API_KEY']) && is_string($_ENV['CODEX_API_KEY']) && $_ENV['CODEX_API_KEY'] !== '') {
            return $_ENV['CODEX_API_KEY'];
        }

        return false;
    }

    /**
     * Simple fixed-window rate limit placeholder (per-IP). Extend with Redis/file store later.
     *
     * @param array<string, list<float>> $staticStore Mutated between requests only in long-running SAPIs; for PHP-FPM use external store in production.
     */
    public static function rateLimit(Request $request, int $maxPerMinute = 120, ?array &$staticStore = null): bool
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $now = microtime(true);
        if ($staticStore === null) {
            $staticStore = [];
        }
        if (!isset($staticStore[$ip])) {
            $staticStore[$ip] = [];
        }
        $windowStart = $now - 60.0;
        $staticStore[$ip] = array_values(array_filter(
            $staticStore[$ip],
            static fn (float $t): bool => $t >= $windowStart,
        ));
        if (count($staticStore[$ip]) >= $maxPerMinute) {
            Response::error('rate_limited', 'Too many requests', 429);
            return false;
        }
        $staticStore[$ip][] = $now;
        return true;
    }

    public static function sessionAuth(Request $request): ?int
    {
        $token = $_COOKIE['codex_session'] ?? '';
        if ($token === '') {
            Response::error('unauthorized', 'Not logged in', 401);
            return null;
        }

        $db = Database::getInstance();
        $db->prepare('DELETE FROM sessions WHERE expires_at < ?')->execute([time()]);

        $stmt = $db->prepare(
            'SELECT s.user_id FROM sessions s
             WHERE s.token = ? AND s.expires_at > ?
             LIMIT 1',
        );
        $stmt->execute([$token, time()]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!is_array($row)) {
            Response::error('unauthorized', 'Session expired or invalid', 401);
            return null;
        }

        $newExpiry = time() + 30 * 86400;
        $db->prepare('UPDATE sessions SET expires_at = ? WHERE token = ?')
            ->execute([$newExpiry, $token]);

        return (int) $row['user_id'];
    }
}
