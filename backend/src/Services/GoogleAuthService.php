<?php

declare(strict_types=1);

namespace Codex\Services;

use Codex\Core\Database;
use PDO;

final class GoogleAuthService
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

    public function __construct(
        private readonly string $clientId,
        private readonly string $clientSecret,
    ) {
    }

    public static function makeFromSettings(): ?self
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            "SELECT key, value FROM settings WHERE key IN ('google_client_id', 'google_client_secret')",
        );
        $stmt->execute();
        /** @var array<int, array{key: string, value: string|null}> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $map = [];
        foreach ($rows as $row) {
            $map[$row['key']] = trim((string) ($row['value'] ?? ''));
        }
        $id = $map['google_client_id'] ?? '';
        $secret = $map['google_client_secret'] ?? '';
        if ($id === '' || $secret === '') {
            return null;
        }

        return new self($id, $secret);
    }

    public function buildAuthUrl(string $redirectUri, string $state): string
    {
        $query = http_build_query([
            'client_id' => $this->clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => implode(' ', [
                'openid',
                'email',
                'profile',
                'https://www.googleapis.com/auth/calendar.readonly',
                // Also add this scope in Google Cloud Console OAuth consent/scope config.
                'https://www.googleapis.com/auth/gmail.readonly',
            ]),
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state,
        ]);

        return 'https://accounts.google.com/o/oauth2/v2/auth?' . $query;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function exchangeCodeForTokens(string $code, string $redirectUri): ?array
    {
        $payload = http_build_query([
            'code' => $code,
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'redirect_uri' => $redirectUri,
            'grant_type' => 'authorization_code',
        ]);

        return $this->postForm(self::TOKEN_URL, $payload);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function refreshAccessToken(string $refreshToken): ?array
    {
        $payload = http_build_query([
            'refresh_token' => $refreshToken,
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'grant_type' => 'refresh_token',
        ]);

        return $this->postForm(self::TOKEN_URL, $payload);
    }

    public function storeTokens(array $tokenResponse): bool
    {
        $accessToken = isset($tokenResponse['access_token']) ? (string) $tokenResponse['access_token'] : '';
        if ($accessToken === '') {
            return false;
        }
        $refreshToken = isset($tokenResponse['refresh_token']) ? (string) $tokenResponse['refresh_token'] : null;
        $expiresIn = isset($tokenResponse['expires_in']) ? (int) $tokenResponse['expires_in'] : 3600;
        $expiry = time() + max(60, $expiresIn - 60);
        $tokenType = isset($tokenResponse['token_type']) ? (string) $tokenResponse['token_type'] : 'Bearer';
        $scope = isset($tokenResponse['scope']) ? (string) $tokenResponse['scope'] : null;
        $metadata = json_encode([
            'token_type' => $tokenType,
            'scope' => $scope,
            'updated_at' => time(),
        ], JSON_UNESCAPED_UNICODE);

        try {
            $db = Database::getInstance();
            $stmt = $db->prepare(
                "INSERT INTO integration_tokens (service, access_token, refresh_token, token_expiry, scope, metadata, created_at, updated_at)
                 VALUES ('google', :access_token, :refresh_token, :token_expiry, :scope, :metadata, unixepoch(), unixepoch())
                 ON CONFLICT(service) DO UPDATE SET
                    access_token = excluded.access_token,
                    refresh_token = COALESCE(excluded.refresh_token, integration_tokens.refresh_token),
                    token_expiry = excluded.token_expiry,
                    scope = excluded.scope,
                    metadata = excluded.metadata,
                    updated_at = unixepoch()",
            );
            $stmt->execute([
                'access_token' => $accessToken,
                'refresh_token' => $refreshToken,
                'token_expiry' => $expiry,
                'scope' => $scope,
                'metadata' => $metadata ?: '{}',
            ]);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function getStoredTokenRow(): ?array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT * FROM integration_tokens WHERE service = 'google' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return $row;
    }

    public function getValidAccessToken(): ?string
    {
        $row = $this->getStoredTokenRow();
        if ($row === null) {
            return null;
        }
        $accessToken = isset($row['access_token']) ? (string) $row['access_token'] : '';
        $expiry = isset($row['token_expiry']) ? (int) $row['token_expiry'] : 0;
        if ($accessToken !== '' && $expiry > (time() + 60)) {
            return $accessToken;
        }
        $refreshToken = isset($row['refresh_token']) ? (string) $row['refresh_token'] : '';
        if ($refreshToken === '') {
            return null;
        }

        $refreshed = $this->refreshAccessToken($refreshToken);
        if ($refreshed === null) {
            return null;
        }
        if (!isset($refreshed['refresh_token'])) {
            $refreshed['refresh_token'] = $refreshToken;
        }
        if (!$this->storeTokens($refreshed)) {
            return null;
        }

        return isset($refreshed['access_token']) ? (string) $refreshed['access_token'] : null;
    }

    public function revokeAndClear(): bool
    {
        $row = $this->getStoredTokenRow();
        if ($row === null) {
            return true;
        }
        $token = (string) ($row['access_token'] ?? '');
        if ($token !== '') {
            $payload = http_build_query(['token' => $token]);
            $this->postForm(self::REVOKE_URL, $payload);
        }

        try {
            $db = Database::getInstance();
            $db->prepare("DELETE FROM integration_tokens WHERE service = 'google'")->execute();
            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function postForm(string $url, string $payload): ?array
    {
        try {
            $ctx = stream_context_create([
                'http' => [
                    'method' => 'POST',
                    'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                    'content' => $payload,
                    'timeout' => 8,
                    'ignore_errors' => true,
                ],
            ]);
            $raw = @file_get_contents($url, false, $ctx);
            if (!is_string($raw) || trim($raw) === '') {
                return null;
            }
            $json = json_decode($raw, true);
            if (!is_array($json)) {
                return null;
            }
            if (isset($json['error'])) {
                return null;
            }

            return $json;
        } catch (\Throwable) {
            return null;
        }
    }
}
