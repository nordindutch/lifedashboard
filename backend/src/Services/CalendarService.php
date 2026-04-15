<?php

declare(strict_types=1);

namespace Codex\Services;

use Codex\Core\Database;
use PDO;

final class CalendarService
{
    public function __construct(private readonly string $accessToken)
    {
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    public function fetchUpcoming(int $days = 7): ?array
    {
        try {
            $timeMin = gmdate('c');
            $timeMax = gmdate('c', time() + ($days * 86400));
            $url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?' . http_build_query([
                'singleEvents' => 'true',
                'orderBy' => 'startTime',
                'timeMin' => $timeMin,
                'timeMax' => $timeMax,
                'maxResults' => 50,
            ]);

            $ctx = stream_context_create([
                'http' => [
                    'method' => 'GET',
                    'timeout' => 8,
                    'ignore_errors' => true,
                    'header' => "Authorization: Bearer {$this->accessToken}\r\n",
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
            $items = isset($json['items']) && is_array($json['items']) ? $json['items'] : [];
            $out = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $normalized = $this->normalizeEvent($item);
                if ($normalized !== null) {
                    $out[] = $normalized;
                }
            }

            return $out;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Creates an event in the user's primary Google Calendar.
     * Returns the normalised event array on success, null on failure.
     *
     * @return array<string, mixed>|null
     */
    public function createEvent(
        string $title,
        int $startAt,
        int $endAt,
        bool $isAllDay = false,
        ?string $description = null,
        ?string $location = null,
    ): ?array {
        $url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

        if ($isAllDay) {
            $body = [
                'summary' => $title,
                'start' => ['date' => gmdate('Y-m-d', $startAt)],
                'end' => ['date' => gmdate('Y-m-d', $endAt)],
            ];
        } else {
            $body = [
                'summary' => $title,
                'start' => ['dateTime' => gmdate('c', $startAt), 'timeZone' => 'UTC'],
                'end' => ['dateTime' => gmdate('c', $endAt), 'timeZone' => 'UTC'],
            ];
        }
        if ($description !== null && $description !== '') {
            $body['description'] = $description;
        }
        if ($location !== null && $location !== '') {
            $body['location'] = $location;
        }

        $payload = json_encode($body, JSON_UNESCAPED_UNICODE);

        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'timeout' => 8,
                'ignore_errors' => true,
                'header' => implode("\r\n", [
                    "Authorization: Bearer {$this->accessToken}",
                    'Content-Type: application/json',
                    'Content-Length: ' . strlen($payload ?: ''),
                ]),
                'content' => $payload,
            ],
        ]);

        $raw = @file_get_contents($url, false, $ctx);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        $json = json_decode($raw, true);
        if (!is_array($json) || isset($json['error'])) {
            return null;
        }

        return $this->normalizeEvent($json);
    }

    /**
     * Deletes an event from Google Calendar by its Google event ID.
     * Returns true on success (204 No Content), false on any failure.
     */
    public function deleteEvent(string $googleEventId): bool
    {
        $url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events/'
            . rawurlencode($googleEventId);

        $ctx = stream_context_create([
            'http' => [
                'method' => 'DELETE',
                'timeout' => 8,
                'ignore_errors' => true,
                'header' => "Authorization: Bearer {$this->accessToken}\r\n",
            ],
        ]);

        @file_get_contents($url, false, $ctx);

        $headers = $http_response_header ?? [];
        foreach ($headers as $h) {
            if (str_starts_with($h, 'HTTP/') && str_contains($h, '204')) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param list<array<string, mixed>> $events
     */
    public static function upsertCachedEvents(array $events): int
    {
        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM cached_calendar_events')->execute();
            $stmt = $db->prepare(
                'INSERT INTO cached_calendar_events
                 (external_id, title, description, location, start_at, end_at, is_all_day, calendar_name, color, meet_link, raw_data, fetched_at)
                 VALUES
                 (:external_id, :title, :description, :location, :start_at, :end_at, :is_all_day, :calendar_name, :color, :meet_link, :raw_data, :fetched_at)
                 ON CONFLICT(external_id) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    location = excluded.location,
                    start_at = excluded.start_at,
                    end_at = excluded.end_at,
                    is_all_day = excluded.is_all_day,
                    calendar_name = excluded.calendar_name,
                    color = excluded.color,
                    meet_link = excluded.meet_link,
                    raw_data = excluded.raw_data,
                    fetched_at = excluded.fetched_at',
            );
            foreach ($events as $event) {
                $stmt->execute([
                    'external_id' => (string) $event['external_id'],
                    'title' => (string) $event['title'],
                    'description' => $event['description'],
                    'location' => $event['location'],
                    'start_at' => (int) $event['start_at'],
                    'end_at' => (int) $event['end_at'],
                    'is_all_day' => (int) ($event['is_all_day'] ? 1 : 0),
                    'calendar_name' => $event['calendar_name'],
                    'color' => $event['color'],
                    'meet_link' => $event['meet_link'],
                    'raw_data' => isset($event['raw_data']) ? (string) $event['raw_data'] : '{}',
                    'fetched_at' => (int) $event['fetched_at'],
                ]);
            }
            $db->commit();
            return count($events);
        } catch (\Throwable) {
            $db->rollBack();
            return 0;
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function loadCachedForDay(string $date, ?string $timezone = null): array
    {
        $tz = self::resolveTimezone($timezone);
        $startDt = \DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $date . ' 00:00:00', $tz);
        $endDt = \DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $date . ' 23:59:59', $tz);
        if (!$startDt instanceof \DateTimeImmutable || !$endDt instanceof \DateTimeImmutable) {
            return [];
        }
        $start = $startDt->getTimestamp();
        $end = $endDt->getTimestamp();
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'SELECT * FROM cached_calendar_events
             WHERE start_at <= :end_at AND end_at >= :start_at
             ORDER BY start_at ASC',
        );
        $stmt->execute([
            'start_at' => $start,
            'end_at' => $end,
        ]);
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[] = [
                'id' => (int) $row['id'],
                'external_id' => (string) $row['external_id'],
                'title' => (string) $row['title'],
                'description' => $row['description'] !== null ? (string) $row['description'] : null,
                'location' => $row['location'] !== null ? (string) $row['location'] : null,
                'start_at' => (int) $row['start_at'],
                'end_at' => (int) $row['end_at'],
                'is_all_day' => ((int) $row['is_all_day']) === 1,
                'calendar_name' => $row['calendar_name'] !== null ? (string) $row['calendar_name'] : null,
                'color' => $row['color'] !== null ? (string) $row['color'] : null,
                'meet_link' => $row['meet_link'] !== null ? (string) $row['meet_link'] : null,
                'fetched_at' => (int) $row['fetched_at'],
            ];
        }

        return $out;
    }

    private static function resolveTimezone(?string $timezone): \DateTimeZone
    {
        $candidate = trim((string) $timezone);
        if ($candidate === '') {
            try {
                $db = Database::getInstance();
                $stmt = $db->prepare("SELECT value FROM settings WHERE key = 'timezone' LIMIT 1");
                $stmt->execute();
                $candidate = trim((string) ($stmt->fetchColumn() ?: ''));
            } catch (\Throwable) {
                $candidate = '';
            }
        }
        try {
            return new \DateTimeZone($candidate !== '' ? $candidate : 'UTC');
        } catch (\Throwable) {
            return new \DateTimeZone('UTC');
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function normalizeEvent(array $item): ?array
    {
        $externalId = isset($item['id']) ? (string) $item['id'] : '';
        if ($externalId === '') {
            return null;
        }
        $startMeta = isset($item['start']) && is_array($item['start']) ? $item['start'] : [];
        $endMeta = isset($item['end']) && is_array($item['end']) ? $item['end'] : [];
        $isAllDay = isset($startMeta['date']) || isset($endMeta['date']);
        $startAt = $this->parseGoogleDateToUnix(
            isset($startMeta['dateTime']) ? (string) $startMeta['dateTime'] : (isset($startMeta['date']) ? (string) $startMeta['date'] : ''),
            $isAllDay,
            true,
        );
        $endAt = $this->parseGoogleDateToUnix(
            isset($endMeta['dateTime']) ? (string) $endMeta['dateTime'] : (isset($endMeta['date']) ? (string) $endMeta['date'] : ''),
            $isAllDay,
            false,
        );
        if ($startAt === null || $endAt === null) {
            return null;
        }

        return [
            'external_id' => $externalId,
            'title' => isset($item['summary']) ? (string) $item['summary'] : '(untitled event)',
            'description' => isset($item['description']) ? (string) $item['description'] : null,
            'location' => isset($item['location']) ? (string) $item['location'] : null,
            'start_at' => $startAt,
            'end_at' => $endAt,
            'is_all_day' => $isAllDay,
            'calendar_name' => 'Google Calendar',
            'color' => null,
            'meet_link' => isset($item['hangoutLink']) ? (string) $item['hangoutLink'] : null,
            'raw_data' => json_encode($item, JSON_UNESCAPED_UNICODE) ?: '{}',
            'fetched_at' => time(),
        ];
    }

    private function parseGoogleDateToUnix(string $raw, bool $allDay, bool $isStart): ?int
    {
        if ($raw === '') {
            return null;
        }
        if ($allDay && preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            $dt = $raw . ($isStart ? ' 00:00:00' : ' 23:59:59');
            $ts = strtotime($dt);
            return $ts === false ? null : $ts;
        }
        $ts = strtotime($raw);
        if ($ts === false) {
            return null;
        }
        return $ts;
    }
}
