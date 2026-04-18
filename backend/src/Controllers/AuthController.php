<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Middleware;
use Codex\Core\Request;
use Codex\Core\Response;
use PDO;

final class AuthController
{
    public function bootstrap(Request $request): void
    {
        unset($request);
        try {
            $db = Database::getInstance();
            $count = (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn();
            Response::success(['needs_setup' => $count === 0]);
        } catch (\Throwable) {
            Response::error('not_available', 'Database not ready', 503);
        }
    }

    public function setup(Request $request): void
    {
        $db = Database::getInstance();
        $count = (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn();
        if ($count > 0) {
            Response::error('forbidden', 'An account already exists', 403);
            return;
        }

        $body = $request->getBody();
        $email = trim((string) ($body['email'] ?? ''));
        $name = trim((string) ($body['name'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('validation_error', 'Valid email is required', 422, 'email');
            return;
        }
        if ($name === '') {
            Response::error('validation_error', 'Name is required', 422, 'name');
            return;
        }
        if (strlen($password) < 10) {
            Response::error('validation_error', 'Password must be at least 10 characters', 422, 'password');
            return;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        try {
            $db->prepare(
                'INSERT INTO users (google_id, email, name, avatar_url, password_hash, last_login_at)
                 VALUES (\'local\', :email, :name, NULL, :password_hash, unixepoch())',
            )->execute([
                'email' => $email,
                'name' => $name,
                'password_hash' => $hash,
            ]);
        } catch (\Throwable) {
            Response::error('validation_error', 'Could not create account', 422);
            return;
        }

        $userId = (int) $db->lastInsertId();
        if ($userId < 1) {
            Response::error('internal_error', 'Failed to create user', 500);
            return;
        }

        $session = $this->issueSession($userId);
        $user = $this->fetchUserRow($userId);
        if ($user === null) {
            Response::error('internal_error', 'Failed to load user', 500);
            return;
        }

        Response::success([
            'user' => $user,
            'token' => $session['token'],
            'expires_at' => $session['expires_at'],
        ], 201);
    }

    public function login(Request $request): void
    {
        $body = $request->getBody();
        $email = trim((string) ($body['email'] ?? ''));
        $password = (string) ($body['password'] ?? '');

        if ($email === '' || $password === '') {
            Response::error('validation_error', 'Email and password are required', 422);
            return;
        }

        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT id, email, name, avatar_url, password_hash FROM users WHERE email = ? COLLATE NOCASE LIMIT 1',
        );
        $stmt->execute([$email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!is_array($row)) {
            Response::error('unauthorized', 'Invalid email or password', 401);
            return;
        }

        $hash = $row['password_hash'] ?? null;
        if (!is_string($hash) || $hash === '' || !password_verify($password, $hash)) {
            Response::error('unauthorized', 'Invalid email or password', 401);
            return;
        }

        $userId = (int) $row['id'];
        $session = $this->issueSession($userId);
        $user = $this->fetchUserRow($userId);
        if ($user === null) {
            Response::error('internal_error', 'Failed to load user', 500);
            return;
        }

        Response::success([
            'user' => $user,
            'token' => $session['token'],
            'expires_at' => $session['expires_at'],
        ]);
    }

    public function me(Request $request): void
    {
        $userId = Middleware::sessionAuth($request);
        if ($userId === null) {
            return;
        }

        $user = $this->fetchUserRow($userId);
        if ($user === null) {
            Response::error('not_found', 'User not found', 404);
            return;
        }

        Response::success($user);
    }

    public function logout(Request $request): void
    {
        $token = $_COOKIE['codex_session'] ?? '';
        if ($token === '') {
            $headerToken = $request->getHeader('x-codex-session');
            $token = $headerToken !== null && $headerToken !== '' ? $headerToken : '';
        }

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
     * @return array{token: string, expires_at: int}
     */
    private function issueSession(int $userId): array
    {
        $db = Database::getInstance();
        $token = bin2hex(random_bytes(32));
        $expiresAt = time() + (30 * 86400);
        $db->prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
            ->execute([$userId, $token, $expiresAt]);
        $db->prepare('UPDATE users SET last_login_at = unixepoch() WHERE id = ?')->execute([$userId]);

        $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $sameSite = $secure ? 'None' : 'Lax';
        setcookie('codex_session', $token, [
            'expires' => $expiresAt,
            'path' => '/',
            'httponly' => true,
            'secure' => $secure,
            'samesite' => $sameSite,
        ]);

        return ['token' => $token, 'expires_at' => $expiresAt];
    }

    /**
     * @return array{id: int, email: string, name: string, avatar_url: string|null}|null
     */
    private function fetchUserRow(int $userId): ?array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, email, name, avatar_url FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!is_array($user)) {
            return null;
        }

        return [
            'id' => (int) $user['id'],
            'email' => (string) $user['email'],
            'name' => (string) $user['name'],
            'avatar_url' => $user['avatar_url'] ? (string) $user['avatar_url'] : null,
        ];
    }
}
