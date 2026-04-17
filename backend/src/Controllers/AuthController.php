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

    /**
     * Tauri desktop login: the app polls this endpoint after opening the system browser.
     * The backend stores a short-lived pending token during the OAuth callback; this
     * endpoint claims it (one-time, expires in 5 minutes) and returns it as JSON so the
     * Tauri webview can store it in localStorage and use it as X-Codex-Session.
     */
    public function tauriClaim(Request $request): void
    {
        unset($request);
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'tauri_pending_token' LIMIT 1");
        $stmt->execute();
        $raw = $stmt->fetchColumn();

        if (!is_string($raw) || $raw === '') {
            Response::error('not_found', 'No pending token', 404);
            return;
        }

        $parts = explode('|', $raw, 2);
        $token = $parts[0];
        $expiry = isset($parts[1]) ? (int) $parts[1] : 0;

        // Always delete it — one-time use
        $db->prepare("DELETE FROM settings WHERE key = 'tauri_pending_token'")->execute();

        if ($expiry > 0 && time() > $expiry) {
            Response::error('expired', 'Pending token has expired', 410);
            return;
        }

        Response::success(['token' => $token]);
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
