<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Middleware;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Services\GoogleAuthService;
use PDO;

final class AuthController
{
    private const SESSION_TTL = 30 * 86400;

    public function me(Request $request): void
    {
        $userId = Middleware::sessionAuth($request);
        if ($userId === null) {
            return;
        }

        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, email, name, avatar_url FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!is_array($user)) {
            Response::error('not_found', 'User not found', 404);
            return;
        }

        Response::success([
            'id' => (int) $user['id'],
            'email' => (string) $user['email'],
            'name' => (string) $user['name'],
            'avatar_url' => $user['avatar_url'] ? (string) $user['avatar_url'] : null,
        ]);
    }

    public function login(Request $request): void
    {
        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            http_response_code(503);
            echo 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.';
            exit;
        }

        $state = bin2hex(random_bytes(16));
        $redirectUri = $this->buildCallbackUri($request);

        $db = Database::getInstance();
        $db->prepare(
            "INSERT INTO settings (key, value, value_type, description, updated_at)
             VALUES ('auth_oauth_state', :v, 'string', 'Login OAuth state', unixepoch())
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        )->execute(['v' => $state]);
        $db->prepare(
            "INSERT INTO settings (key, value, value_type, description, updated_at)
             VALUES ('auth_oauth_redirect_uri', :v, 'string', 'Login OAuth redirect URI', unixepoch())
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        )->execute(['v' => $redirectUri]);

        header('Location: ' . $service->buildAuthUrl($redirectUri, $state), true, 302);
        exit;
    }

    public function callback(Request $request): void
    {
        $frontendUrl = $this->frontendUrl($request);

        $error = $request->getQueryString('error');
        if ($error !== null && $error !== '') {
            header('Location: ' . $frontendUrl . '/login?error=' . rawurlencode($error), true, 302);
            exit;
        }

        $code = $request->getQueryString('code') ?? '';
        $state = $request->getQueryString('state') ?? '';
        if ($code === '' || $state === '') {
            header('Location: ' . $frontendUrl . '/login?error=missing_code', true, 302);
            exit;
        }

        $db = Database::getInstance();

        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'auth_oauth_state' LIMIT 1");
        $stmt->execute();
        $expectedState = (string) ($stmt->fetchColumn() ?: '');
        $db->prepare("DELETE FROM settings WHERE key = 'auth_oauth_state'")->execute();

        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'auth_oauth_redirect_uri' LIMIT 1");
        $stmt->execute();
        $redirectUri = (string) ($stmt->fetchColumn() ?: '');
        $db->prepare("DELETE FROM settings WHERE key = 'auth_oauth_redirect_uri'")->execute();

        if ($expectedState === '' || !hash_equals($expectedState, $state)) {
            header('Location: ' . $frontendUrl . '/login?error=invalid_state', true, 302);
            exit;
        }

        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            header('Location: ' . $frontendUrl . '/login?error=not_configured', true, 302);
            exit;
        }

        $tokens = $service->exchangeCodeForTokens($code, $redirectUri);
        if ($tokens === null) {
            header('Location: ' . $frontendUrl . '/login?error=token_exchange_failed', true, 302);
            exit;
        }

        $profile = $this->fetchGoogleProfile((string) ($tokens['access_token'] ?? ''));
        if ($profile === null) {
            header('Location: ' . $frontendUrl . '/login?error=profile_fetch_failed', true, 302);
            exit;
        }

        $googleId = (string) ($profile['sub'] ?? '');
        $email = (string) ($profile['email'] ?? '');
        $name = (string) ($profile['name'] ?? '');
        $avatarUrl = isset($profile['picture']) ? (string) $profile['picture'] : null;

        if ($googleId === '' || $email === '' || $name === '') {
            header('Location: ' . $frontendUrl . '/login?error=incomplete_profile', true, 302);
            exit;
        }

        $ownerStmt = $db->query('SELECT google_id FROM users ORDER BY id ASC LIMIT 1');
        $ownerGoogleId = $ownerStmt->fetchColumn();
        if ($ownerGoogleId !== false && (string) $ownerGoogleId !== $googleId) {
            header('Location: ' . $frontendUrl . '/login?error=account_not_allowed', true, 302);
            exit;
        }

        $db->prepare(
            'INSERT INTO users (google_id, email, name, avatar_url, last_login_at)
             VALUES (:google_id, :email, :name, :avatar_url, unixepoch())
             ON CONFLICT(google_id) DO UPDATE SET
                email         = excluded.email,
                name          = excluded.name,
                avatar_url    = excluded.avatar_url,
                last_login_at = unixepoch()',
        )->execute([
            'google_id' => $googleId,
            'email' => $email,
            'name' => $name,
            'avatar_url' => $avatarUrl,
        ]);

        $userStmt = $db->prepare('SELECT id FROM users WHERE google_id = ?');
        $userStmt->execute([$googleId]);
        $userId = (int) $userStmt->fetchColumn();

        $service->storeTokens($tokens);

        $token = bin2hex(random_bytes(32));
        $expiresAt = time() + self::SESSION_TTL;
        $db->prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
            ->execute([$userId, $token, $expiresAt]);

        $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $sameSite = $secure ? 'None' : 'Lax';
        setcookie('codex_session', $token, [
            'expires' => $expiresAt,
            'path' => '/',
            'httponly' => true,
            'secure' => $secure,
            'samesite' => $sameSite,
        ]);

        header('Location: ' . $frontendUrl . '/', true, 302);
        exit;
    }

    public function logout(Request $request): void
    {
        $token = $_COOKIE['codex_session'] ?? '';
        if ($token !== '') {
            Database::getInstance()
                ->prepare('DELETE FROM sessions WHERE token = ?')
                ->execute([$token]);
        }

        setcookie('codex_session', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'samesite' => 'Lax',
        ]);

        Response::success(['logged_out' => true]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function fetchGoogleProfile(string $accessToken): ?array
    {
        if ($accessToken === '') {
            return null;
        }

        $ctx = stream_context_create(['http' => [
            'method' => 'GET',
            'timeout' => 8,
            'ignore_errors' => true,
            'header' => "Authorization: Bearer {$accessToken}\r\n",
        ]]);

        $raw = @file_get_contents('https://openidconnect.googleapis.com/v1/userinfo', false, $ctx);
        if (!is_string($raw)) {
            return null;
        }

        $json = json_decode($raw, true);
        return is_array($json) && isset($json['sub']) ? $json : null;
    }

    private function buildCallbackUri(Request $request): string
    {
        $configured = getenv('GOOGLE_REDIRECT_URI') ?: ($_ENV['GOOGLE_REDIRECT_URI'] ?? '');
        if (is_string($configured) && trim($configured) !== '') {
            return rtrim(trim($configured), '/');
        }

        $host = $request->getHeader('host') ?? ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $hostParts = explode(':', $host, 2);
        $hostname = strtolower($hostParts[0] ?? 'localhost');
        if ($hostname === '127.0.0.1' || $hostname === '::1' || $hostname === '[::1]') {
            $host = 'localhost' . (isset($hostParts[1]) ? ':' . $hostParts[1] : '');
        }

        $scheme = 'http';
        $proto = $request->getHeader('x-forwarded-proto');
        if ($proto !== null && $proto !== '') {
            $scheme = $proto;
        } elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            $scheme = 'https';
        }

        return $scheme . '://' . $host . '/api/auth/callback';
    }

    private function frontendUrl(Request $request): string
    {
        $env = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');
        if (is_string($env) && $env !== '') {
            return rtrim($env, '/');
        }

        $origin = $request->getHeader('origin') ?? '';
        if ($origin !== '') {
            $p = parse_url($origin);
            if (is_array($p) && isset($p['scheme'], $p['host'])) {
                $base = $p['scheme'] . '://' . $p['host'];
                if (isset($p['port'])) {
                    $base .= ':' . $p['port'];
                }
                return $base;
            }
        }

        $host = $request->getHeader('host') ?? ($_SERVER['HTTP_HOST'] ?? 'localhost');
        return 'http://' . explode(':', $host)[0] . ':5273';
    }
}
