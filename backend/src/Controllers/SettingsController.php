<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Services\CalendarService;
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
            Response::error('not_configured', 'Google client ID/secret are missing in settings', 422);
            return;
        }
        $state = bin2hex(random_bytes(16));
        $db = Database::getInstance();
        $db->prepare(
            "INSERT INTO settings (key, value, value_type, description, updated_at)
             VALUES ('google_oauth_state', :value, 'string', 'Temporary OAuth state', unixepoch())
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        )->execute(['value' => $state]);

        $redirectUri = $this->buildGoogleRedirectUri($request);
        $url = $service->buildAuthUrl($redirectUri, $state);
        header('Location: ' . $url, true, 302);
        exit;
    }

    public function googleCallback(Request $request): void
    {
        $error = $request->getQueryString('error');
        $frontend = $this->frontendSettingsUrl($request);
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
        if ($expectedState === '' || !hash_equals($expectedState, $state)) {
            header('Location: ' . $frontend . '?google=error&reason=invalid_state', true, 302);
            exit;
        }

        $service = GoogleAuthService::makeFromSettings();
        if ($service === null) {
            header('Location: ' . $frontend . '?google=error&reason=not_configured', true, 302);
            exit;
        }
        $token = $service->exchangeCodeForTokens($code, $this->buildGoogleRedirectUri($request));
        if ($token === null || !$service->storeTokens($token)) {
            header('Location: ' . $frontend . '?google=error&reason=token_exchange_failed', true, 302);
            exit;
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

        header('Location: ' . $frontend . '?google=connected', true, 302);
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
            Response::error('not_configured', 'Google client ID/secret are missing in settings', 422);
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
        $host = $request->getHeader('host') ?? ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $hostOnly = $host;
        if (str_contains($hostOnly, ':')) {
            [$name] = explode(':', $hostOnly, 2);
            $hostOnly = $name;
        }
        // Dev default uses Vite on 5273; in other environments user can still navigate manually.
        return 'http://' . $hostOnly . ':5273/settings';
    }
}
