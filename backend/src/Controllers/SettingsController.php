<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Services\CalendarService;
use Codex\Services\GmailService;
use Codex\Services\GoogleAuthService;
use Codex\Services\WeatherService;
use PDO;

final class SettingsController
{
    public function index(Request $request): void
    {
        unset($request);
        $settings = $this->fetchSettingsMap();
        Response::success($settings);
    }

    public function update(Request $request): void
    {
        $body = $request->getBody();
        if ($body === []) {
            Response::success($this->fetchSettingsMap());
            return;
        }

        $db = Database::getInstance();
        $existingStmt = $db->query('SELECT key, value_type FROM settings');
        /** @var array<int, array{key: string, value_type: string}> $rows */
        $rows = $existingStmt->fetchAll(PDO::FETCH_ASSOC);
        $typesByKey = [];
        foreach ($rows as $row) {
            $typesByKey[$row['key']] = $row['value_type'];
        }

        $allowedPatch = [];
        foreach ($body as $key => $value) {
            if (!is_string($key)) {
                continue;
            }
            if (!array_key_exists($key, $typesByKey)) {
                continue;
            }
            if ($key === 'weather_cache') {
                continue;
            }
            $allowedPatch[$key] = $value;
        }

        if ($allowedPatch === []) {
            Response::success($this->fetchSettingsMap());
            return;
        }

        $weatherConfigUpdated = false;
        foreach (['openweather_api_key', 'openweather_lat', 'openweather_lon'] as $k) {
            if (array_key_exists($k, $allowedPatch)) {
                $weatherConfigUpdated = true;
                break;
            }
        }

        $db->beginTransaction();
        try {
            $upsert = $db->prepare(
                'INSERT INTO settings (key, value, value_type, updated_at)
                 VALUES (:key, :value, :value_type, unixepoch())
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = unixepoch()',
            );

            foreach ($allowedPatch as $key => $value) {
                $valueType = $typesByKey[$key] ?? 'string';
                $serialized = $this->serializeSettingValue($value, $valueType);
                $upsert->execute([
                    'key' => $key,
                    'value' => $serialized,
                    'value_type' => $valueType,
                ]);
            }

            if ($weatherConfigUpdated) {
                $deleteCache = $db->prepare("DELETE FROM settings WHERE key = 'weather_cache'");
                $deleteCache->execute();
            }

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            Response::error('DB_ERROR', 'Failed to update settings', 500);
            return;
        }

        Response::success($this->fetchSettingsMap());
    }

    public function weatherTest(Request $request): void
    {
        unset($request);
        $db = Database::getInstance();
        $db->prepare("DELETE FROM settings WHERE key = 'weather_cache'")->execute();

        $service = WeatherService::makeFromSettings();
        if ($service === null) {
            Response::error('not_configured', 'OpenWeather settings are missing or invalid', 422);
            return;
        }
        $weather = $service->getCurrent();
        if ($weather === null) {
            Response::error('EXTERNAL_API_ERROR', 'Failed to fetch weather from OpenWeather', 502);
            return;
        }

        Response::success($weather);
    }

    public function integrationStatus(Request $request): void
    {
        unset($request);
        $db = Database::getInstance();
        $stmt = $db->query("SELECT service FROM integration_tokens");
        /** @var list<array{service: string}> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $services = [];
        foreach ($rows as $row) {
            $services[] = $row['service'];
        }
        $openWeatherConfigured = false;
        $wx = $db->prepare(
            "SELECT key, value FROM settings WHERE key IN ('openweather_api_key', 'openweather_lat', 'openweather_lon')",
        );
        $wx->execute();
        $wxRows = $wx->fetchAll(PDO::FETCH_ASSOC);
        $wxMap = [];
        foreach ($wxRows as $row) {
            $wxMap[(string) $row['key']] = trim((string) ($row['value'] ?? ''));
        }
        if (($wxMap['openweather_api_key'] ?? '') !== '' && ($wxMap['openweather_lat'] ?? '') !== '' && ($wxMap['openweather_lon'] ?? '') !== '') {
            $openWeatherConfigured = true;
        }

        Response::success([
            'google' => in_array('google', $services, true),
            'openweather' => $openWeatherConfigured,
        ]);
    }

    public function googleAuth(Request $request): void
    {
        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            Response::error('not_configured', 'Google client ID/secret are missing (set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in .env or in settings)', 422);
            return;
        }
        $state = bin2hex(random_bytes(16));
        $db = Database::getInstance();
        $redirectUri = $this->buildGoogleRedirectUri($request);
        $db->prepare(
            "INSERT INTO settings (key, value, value_type, description, updated_at)
             VALUES ('google_oauth_state', :value, 'string', 'Temporary OAuth state', unixepoch())
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        )->execute(['value' => $state]);
        $db->prepare(
            "INSERT INTO settings (key, value, value_type, description, updated_at)
             VALUES ('google_oauth_redirect_uri', :value, 'string', 'Temporary OAuth redirect URI', unixepoch())
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        )->execute(['value' => $redirectUri]);
        $url = $service->buildAuthUrl($redirectUri, $state);
        header('Location: ' . $url, true, 302);
        exit;
    }

    public function googleCallback(Request $request): void
    {
        $error = $request->getQueryString('error');
        $frontend = $this->hasSessionCookie() ? $this->frontendSettingsUrl($request) : $this->frontendLoginUrl($request);
        if ($error !== null && $error !== '') {
            header('Location: ' . $frontend . '?google=error&reason=' . rawurlencode($error), true, 302);
            exit;
        }
        $code = $request->getQueryString('code');
        $state = $request->getQueryString('state');
        if ($code === null || $code === '' || $state === null || $state === '') {
            header('Location: ' . $frontend . '?google=error&reason=missing_code_or_state', true, 302);
            exit;
        }
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'google_oauth_state' LIMIT 1");
        $stmt->execute();
        $expectedState = (string) ($stmt->fetchColumn() ?: '');
        $db->prepare("DELETE FROM settings WHERE key = 'google_oauth_state'")->execute();

        $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'google_oauth_redirect_uri' LIMIT 1");
        $stmt->execute();
        $redirectUri = (string) ($stmt->fetchColumn() ?: '');
        $db->prepare("DELETE FROM settings WHERE key = 'google_oauth_redirect_uri'")->execute();

        if ($expectedState === '' || !hash_equals($expectedState, $state)) {
            header('Location: ' . $frontend . '?google=error&reason=invalid_state', true, 302);
            exit;
        }
        if ($redirectUri === '') {
            header('Location: ' . $frontend . '?google=error&reason=missing_redirect_uri', true, 302);
            exit;
        }

        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            header('Location: ' . $frontend . '?google=error&reason=not_configured', true, 302);
            exit;
        }
        $token = $service->exchangeCodeForTokens($code, $redirectUri);
        if ($token === null || !$service->storeTokens($token)) {
            header('Location: ' . $frontend . '?google=error&reason=token_exchange_failed', true, 302);
            exit;
        }

        $sessionIssued = false;
        $accessToken = (string) ($token['access_token'] ?? '');
        $profile = $this->fetchGoogleProfile($accessToken);
        if ($profile !== null) {
            $googleId = (string) ($profile['sub'] ?? '');
            $email = (string) ($profile['email'] ?? '');
            $name = (string) ($profile['name'] ?? '');
            $avatarUrl = isset($profile['picture']) ? (string) $profile['picture'] : null;

            if ($googleId !== '' && $email !== '' && $name !== '') {
                $ownerStmt = $db->query('SELECT google_id FROM users ORDER BY id ASC LIMIT 1');
                $ownerGoogleId = $ownerStmt === false ? false : $ownerStmt->fetchColumn();
                if ($ownerGoogleId === false || (string) $ownerGoogleId === $googleId) {
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
                    if ($userId > 0) {
                        $sessionToken = bin2hex(random_bytes(32));
                        $expiresAt = time() + (30 * 86400);
                        $db->prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
                            ->execute([$userId, $sessionToken, $expiresAt]);

                        $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
                        $sameSite = $secure ? 'None' : 'Lax';
                        setcookie('codex_session', $sessionToken, [
                            'expires' => $expiresAt,
                            'path' => '/',
                            'httponly' => true,
                            'secure' => $secure,
                            'samesite' => $sameSite,
                        ]);
                        $sessionIssued = true;
                    }
                }
            }
        }

        // Attempt initial sync (non-fatal). User can manually sync from settings page as well.
        $access = $service->getValidAccessToken();
        if ($access !== null) {
            $calendarService = new CalendarService($access);
            $events = $calendarService->fetchUpcoming();
            if (is_array($events)) {
                CalendarService::upsertCachedEvents($events);
            }
        }

        $destination = $sessionIssued ? $this->frontendHomeUrl($request) : ($frontend . '?google=connected');
        header('Location: ' . $destination, true, 302);
        exit;
    }

    public function revokeGoogle(Request $request): void
    {
        unset($request);
        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            Response::success(['revoked' => true]);
            return;
        }
        $ok = $service->revokeAndClear();
        $db = Database::getInstance();
        $db->prepare('DELETE FROM cached_calendar_events')->execute();
        if (!$ok) {
            Response::error('EXTERNAL_API_ERROR', 'Failed to revoke Google token', 502);
            return;
        }
        Response::success(['revoked' => true]);
    }

    public function syncCalendar(Request $request): void
    {
        unset($request);
        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            Response::error('not_configured', 'Google client ID/secret are missing (set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in .env or in settings)', 422);
            return;
        }
        $accessToken = $service->getValidAccessToken();
        if ($accessToken === null) {
            Response::error('unauthorized', 'Google is not connected. Connect account first.', 401);
            return;
        }
        $calendarService = new CalendarService($accessToken);
        $events = $calendarService->fetchUpcoming();
        if ($events === null) {
            Response::error('EXTERNAL_API_ERROR', 'Failed to fetch Google Calendar events', 502);
            return;
        }
        $count = CalendarService::upsertCachedEvents($events);
        Response::success(['synced' => true, 'events' => $count]);
    }

    public function syncGmail(Request $request): void
    {
        unset($request);
        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            Response::error('not_configured', 'Google client ID/secret are missing (set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in .env or in settings)', 422);
            return;
        }
        $accessToken = $service->getValidAccessToken();
        if ($accessToken === null) {
            Response::error('unauthorized', 'Google is not connected. Connect account first.', 401);
            return;
        }
        $count = GmailService::fetchAndStore(20, $accessToken);
        if ($count === null) {
            Response::error('EXTERNAL_API_ERROR', 'Failed to fetch Gmail messages', 502);
            return;
        }
        Response::success(['synced' => true, 'emails' => $count]);
    }

    public function createCalendarEvent(Request $request): void
    {
        $body = $request->getBody();
        $title = trim((string) ($body['title'] ?? ''));
        if ($title === '') {
            Response::error('validation_error', 'title is required', 422, 'title');
            return;
        }

        $startAt = isset($body['start_at']) ? (int) $body['start_at'] : null;
        $endAt = isset($body['end_at']) ? (int) $body['end_at'] : null;
        $isAllDay = !empty($body['is_all_day']);

        if ($startAt === null || $endAt === null) {
            Response::error('validation_error', 'start_at and end_at are required', 422);
            return;
        }
        if ($endAt <= $startAt) {
            Response::error('validation_error', 'end_at must be after start_at', 422, 'end_at');
            return;
        }

        $description = isset($body['description']) ? (string) $body['description'] : null;
        $location = isset($body['location']) ? (string) $body['location'] : null;

        $googleEvent = null;
        $externalId = 'local_' . bin2hex(random_bytes(8));
        $calendarName = 'Local';

        $authService = GoogleAuthService::makeFromSettings();
        if ($authService !== null) {
            $accessToken = $authService->getValidAccessToken();
            if ($accessToken !== null) {
                $calendarService = new CalendarService($accessToken);
                $googleEvent = $calendarService->createEvent(
                    $title,
                    $startAt,
                    $endAt,
                    $isAllDay,
                    $description,
                    $location,
                );
                if ($googleEvent !== null) {
                    $externalId = (string) $googleEvent['external_id'];
                    $calendarName = 'Google Calendar';
                }
            }
        }

        $db = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO cached_calendar_events
             (external_id, title, description, location, start_at, end_at, is_all_day,
              calendar_name, color, fetched_at)
             VALUES
             (:external_id, :title, :description, :location, :start_at, :end_at, :is_all_day,
              :calendar_name, :color, unixepoch())
             ON CONFLICT(external_id) DO UPDATE SET
                title         = excluded.title,
                description   = excluded.description,
                location      = excluded.location,
                start_at      = excluded.start_at,
                end_at        = excluded.end_at,
                is_all_day    = excluded.is_all_day,
                calendar_name = excluded.calendar_name,
                fetched_at    = unixepoch()',
        );
        $stmt->execute([
            'external_id' => $externalId,
            'title' => $title,
            'description' => $description,
            'location' => $location,
            'start_at' => $startAt,
            'end_at' => $endAt,
            'is_all_day' => $isAllDay ? 1 : 0,
            'calendar_name' => $calendarName,
            'color' => null,
        ]);

        $row = $db->prepare('SELECT * FROM cached_calendar_events WHERE external_id = ? LIMIT 1');
        $row->execute([$externalId]);
        /** @var array<string, mixed>|false $event */
        $event = $row->fetch(\PDO::FETCH_ASSOC);
        if (!is_array($event)) {
            Response::error('internal_error', 'Failed to load created event', 500);
            return;
        }

        $pushedToGoogle = $googleEvent !== null;

        Response::success([
            'id' => (int) $event['id'],
            'external_id' => (string) $event['external_id'],
            'title' => (string) $event['title'],
            'description' => $event['description'] ? (string) $event['description'] : null,
            'location' => $event['location'] ? (string) $event['location'] : null,
            'start_at' => (int) $event['start_at'],
            'end_at' => (int) $event['end_at'],
            'is_all_day' => ((int) $event['is_all_day']) === 1,
            'calendar_name' => (string) $event['calendar_name'],
            'color' => null,
            'meet_link' => null,
            'fetched_at' => (int) $event['fetched_at'],
            'pushed_to_google' => $pushedToGoogle,
        ], 201);
    }

    public function deleteCalendarEvent(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid event id', 422, 'id');
            return;
        }

        $db = Database::getInstance();

        $stmt = $db->prepare('SELECT * FROM cached_calendar_events WHERE id = ?');
        $stmt->execute([$id]);
        /** @var array<string, mixed>|false $event */
        $event = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!is_array($event)) {
            Response::error('not_found', 'Calendar event not found', 404);
            return;
        }

        $externalId = (string) $event['external_id'];

        $googleDeleted = false;
        if (!str_starts_with($externalId, 'local_')) {
            $authService = GoogleAuthService::makeFromSettings();
            if ($authService !== null) {
                $accessToken = $authService->getValidAccessToken();
                if ($accessToken !== null) {
                    $googleDeleted = (new CalendarService($accessToken))->deleteEvent($externalId);
                }
            }
        }

        $db->prepare('DELETE FROM cached_calendar_events WHERE id = ?')->execute([$id]);

        Response::success([
            'deleted' => true,
            'google_deleted' => $googleDeleted,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchSettingsMap(): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare("SELECT key, value, value_type FROM settings WHERE key != 'weather_cache' ORDER BY key ASC");
        $stmt->execute();
        /** @var array<int, array{key: string, value: string|null, value_type: string}> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[$row['key']] = $this->castSettingValue($row['value'], $row['value_type']);
        }

        return $out;
    }

    private function castSettingValue(?string $value, string $valueType): mixed
    {
        $raw = $value ?? '';
        return match ($valueType) {
            'integer' => (int) $raw,
            'float' => (float) $raw,
            'boolean' => $raw === '1' || strtolower($raw) === 'true',
            'json' => $this->decodeJsonOrNull($raw) ?? [],
            default => $raw,
        };
    }

    private function serializeSettingValue(mixed $value, string $valueType): string
    {
        return match ($valueType) {
            'integer' => (string) (int) $value,
            'float' => (string) (float) $value,
            'boolean' => (bool) $value ? '1' : '0',
            'json' => json_encode($value, JSON_UNESCAPED_UNICODE) ?: '[]',
            default => (string) $value,
        };
    }

    /**
     * @return array<mixed>|null
     */
    private function decodeJsonOrNull(string $raw): ?array
    {
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }

        return $decoded;
    }

    private function buildGoogleRedirectUri(Request $request): string
    {
        $explicit = $request->getQueryString('redirect_uri');
        if ($explicit !== null && $explicit !== '' && filter_var($explicit, FILTER_VALIDATE_URL)) {
            return $explicit;
        }

        $host = $request->getHeader('host') ?? ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $scheme = 'http';
        $proto = $request->getHeader('x-forwarded-proto');
        if ($proto !== null && $proto !== '') {
            $scheme = $proto;
        } elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            $scheme = 'https';
        }

        return $scheme . '://' . $host . '/api/auth/google/callback';
    }

    private function frontendSettingsUrl(Request $request): string
    {
        $envUrl = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');
        if (is_string($envUrl) && $envUrl !== '') {
            return rtrim($envUrl, '/') . '/settings';
        }

        $origin = $request->getHeader('origin') ?? $request->getHeader('referer') ?? '';
        if ($origin !== '') {
            $parsed = parse_url($origin);
            if (is_array($parsed) && isset($parsed['scheme'], $parsed['host'])) {
                $base = $parsed['scheme'] . '://' . $parsed['host'];
                if (isset($parsed['port'])) {
                    $base .= ':' . $parsed['port'];
                }
                return $base . '/settings';
            }
        }

        $host = $request->getHeader('host') ?? ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $hostOnly = $host;
        if (str_contains($hostOnly, ':')) {
            [$name] = explode(':', $hostOnly, 2);
            $hostOnly = $name;
        }
        // Dev default uses Vite on 5273; in other environments user can still navigate manually.
        return 'http://' . $hostOnly . ':5273/settings';
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

    private function frontendHomeUrl(Request $request): string
    {
        $envUrl = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');
        if (is_string($envUrl) && $envUrl !== '') {
            return rtrim($envUrl, '/') . '/';
        }

        $origin = $request->getHeader('origin') ?? $request->getHeader('referer') ?? '';
        if ($origin !== '') {
            $parsed = parse_url($origin);
            if (is_array($parsed) && isset($parsed['scheme'], $parsed['host'])) {
                $base = $parsed['scheme'] . '://' . $parsed['host'];
                if (isset($parsed['port'])) {
                    $base .= ':' . $parsed['port'];
                }
                return $base . '/';
            }
        }

        return 'http://localhost:5273/';
    }

    private function frontendLoginUrl(Request $request): string
    {
        $envUrl = getenv('FRONTEND_URL') ?: ($_ENV['FRONTEND_URL'] ?? '');
        if (is_string($envUrl) && $envUrl !== '') {
            return rtrim($envUrl, '/') . '/login';
        }

        $origin = $request->getHeader('origin') ?? $request->getHeader('referer') ?? '';
        if ($origin !== '') {
            $parsed = parse_url($origin);
            if (is_array($parsed) && isset($parsed['scheme'], $parsed['host'])) {
                $base = $parsed['scheme'] . '://' . $parsed['host'];
                if (isset($parsed['port'])) {
                    $base .= ':' . $parsed['port'];
                }
                return $base . '/login';
            }
        }

        return 'http://localhost:5273/login';
    }

    private function hasSessionCookie(): bool
    {
        $token = $_COOKIE['codex_session'] ?? '';
        return is_string($token) && $token !== '';
    }
}
