<?php

declare(strict_types=1);

namespace Codex\Services;

use Codex\Core\Database;
use PDO;

final class WeatherService
{
    public function __construct(
        private readonly string $apiKey,
        private readonly float $lat,
        private readonly float $lon,
    ) {
    }

    public static function makeFromSettings(): ?self
    {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare(
                "SELECT key, value FROM settings
                 WHERE key IN ('openweather_api_key', 'openweather_lat', 'openweather_lon')",
            );
            $stmt->execute();
            /** @var array<int, array{key: string, value: string|null}> $rows */
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $map = [];
            foreach ($rows as $row) {
                $map[$row['key']] = trim((string) ($row['value'] ?? ''));
            }

            $apiKey = $map['openweather_api_key'] ?? '';
            $latRaw = $map['openweather_lat'] ?? '';
            $lonRaw = $map['openweather_lon'] ?? '';

            if ($apiKey === '' || $latRaw === '' || $lonRaw === '') {
                return null;
            }
            if (!is_numeric($latRaw) || !is_numeric($lonRaw)) {
                return null;
            }

            return new self($apiKey, (float) $latRaw, (float) $lonRaw);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getCurrent(): ?array
    {
        try {
            $cached = $this->readCache();
            if ($cached !== null) {
                return $cached;
            }

            $url = 'https://api.openweathermap.org/data/2.5/weather'
                . '?lat=' . rawurlencode((string) $this->lat)
                . '&lon=' . rawurlencode((string) $this->lon)
                . '&appid=' . rawurlencode($this->apiKey)
                . '&units=metric';

            $ctx = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 5,
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
            $cod = $json['cod'] ?? null;
            if ((string) $cod !== '200') {
                return null;
            }

            $normalized = $this->normalizeWeatherResponse($json);
            if ($normalized === null) {
                return null;
            }

            $this->writeCache($normalized);
            return $normalized;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function readCache(): ?array
    {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'weather_cache' LIMIT 1");
            $stmt->execute();
            $raw = $stmt->fetchColumn();
            if (!is_string($raw) || trim($raw) === '') {
                return null;
            }
            $parsed = json_decode($raw, true);
            if (!is_array($parsed)) {
                return null;
            }
            $fetchedAt = isset($parsed['fetched_at']) ? (int) $parsed['fetched_at'] : 0;
            if ($fetchedAt < 1) {
                return null;
            }
            if ((time() - $fetchedAt) >= 1800) {
                return null;
            }

            return $parsed;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function writeCache(array $payload): void
    {
        try {
            $db = Database::getInstance();
            $stmt = $db->prepare(
                "INSERT INTO settings (key, value, value_type, description, updated_at)
                 VALUES ('weather_cache', :value, 'json', 'OpenWeather cached payload', unixepoch())
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    value_type = excluded.value_type,
                    description = excluded.description,
                    updated_at = unixepoch()",
            );
            $stmt->execute(['value' => json_encode($payload, JSON_UNESCAPED_UNICODE)]);
        } catch (\Throwable) {
            // non-fatal cache miss/write failure
        }
    }

    /**
     * @param array<string, mixed> $json
     * @return array<string, mixed>|null
     */
    private function normalizeWeatherResponse(array $json): ?array
    {
        $main = isset($json['main']) && is_array($json['main']) ? $json['main'] : null;
        $sys = isset($json['sys']) && is_array($json['sys']) ? $json['sys'] : null;
        if ($main === null || $sys === null) {
            return null;
        }

        $conditionsRaw = isset($json['weather']) && is_array($json['weather']) ? $json['weather'] : [];
        $conditions = [];
        foreach ($conditionsRaw as $item) {
            if (!is_array($item)) {
                continue;
            }
            $conditions[] = [
                'id' => isset($item['id']) ? (int) $item['id'] : 0,
                'main' => isset($item['main']) ? (string) $item['main'] : '',
                'description' => isset($item['description']) ? (string) $item['description'] : '',
                'icon' => isset($item['icon']) ? (string) $item['icon'] : '',
            ];
        }

        $wind = isset($json['wind']) && is_array($json['wind']) ? $json['wind'] : [];

        return [
            'city' => isset($json['name']) ? (string) $json['name'] : '',
            'country' => isset($sys['country']) ? (string) $sys['country'] : '',
            'temp_c' => isset($main['temp']) ? (float) $main['temp'] : 0.0,
            'feels_like_c' => isset($main['feels_like']) ? (float) $main['feels_like'] : 0.0,
            'humidity' => isset($main['humidity']) ? (int) $main['humidity'] : 0,
            'wind_speed_ms' => isset($wind['speed']) ? (float) $wind['speed'] : 0.0,
            'conditions' => $conditions,
            'sunrise' => isset($sys['sunrise']) ? (int) $sys['sunrise'] : 0,
            'sunset' => isset($sys['sunset']) ? (int) $sys['sunset'] : 0,
            'fetched_at' => time(),
        ];
    }
}
