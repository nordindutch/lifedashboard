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

}
