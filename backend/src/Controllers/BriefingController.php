<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\AiPlanRepository;
use Codex\Repositories\DiaryRepository;
use Codex\Repositories\TaskRepository;
use Codex\Services\AnthropicService;
use Codex\Services\CalendarService;
use Codex\Services\GmailService;
use Codex\Services\SnapshotService;
use Codex\Services\WeatherService;
use PDO;

/**
 * Home Hub aggregate ? stub until weather/calendar/email/tasks are wired to repositories.
 */
final class BriefingController
{
    public function index(Request $request): void
    {
        $date = $this->normalizeBriefingDate($request);
        if ($date === null) {
            Response::error('validation_error', 'Invalid date; use YYYY-MM-DD', 422, 'date');

            return;
        }

        $db = Database::getInstance();
        $hub = $this->loadWorkdaySettings($db);
        $timezone = $hub['timezone'];
        $workStart = $hub['work_start'];
        $workEnd = $hub['work_end'];

        $weather = null;
        try {
            $service = WeatherService::makeFromSettings();
            if ($service !== null) {
                $weather = $service->getCurrent();
            }
        } catch (\Throwable) {
            // non-fatal ? briefing still returns without weather
        }

        $events = [];
        try {
            $events = CalendarService::loadCachedForDay($date, $timezone);
        } catch (\Throwable) {
            // non-fatal ? briefing still returns without events
        }

        $emails = [];
        try {
            GmailService::maybeAutoSync(GmailService::AUTO_SYNC_INTERVAL_SEC, 20);
            $emails = GmailService::loadCachedUnread(5);
        } catch (\Throwable) {
            // non-fatal
        }

        $aiRepo = null;
        $aiPlan = null;
        try {
            $aiRepo = AiPlanRepository::make();
            $aiPlan = $aiRepo->findForDate($date, 'adhoc');
        } catch (\Throwable) {
            // non-fatal
        }

        $eveningPlan = null;
        try {
            if ($aiRepo !== null) {
                $eveningPlan = $this->resolveEveningPlan($date, $db, $timezone, $workStart, $workEnd, $events, $aiRepo);
            }
        } catch (\Throwable) {
            // non-fatal
        }

        $tasksToday = [];
        $tasksOverdue = [];
        $tasksActive = [];
        try {
            $tasks = TaskRepository::make();
            $tasksToday = $tasks->findDueOnDate($date, 40);
            $tasksOverdue = $tasks->findOverdueBeforeDate($date, 40);
            $seenIds = [];
            foreach ($tasksToday as $row) {
                $seenIds[(int) $row['id']] = true;
            }
            foreach ($tasksOverdue as $row) {
                $seenIds[(int) $row['id']] = true;
            }
            $candidates = $tasks->findOpenTasksForBriefing(48);
            foreach ($candidates as $row) {
                $id = (int) $row['id'];
                if (isset($seenIds[$id])) {
                    continue;
                }
                $tasksActive[] = $row;
                if (count($tasksActive) >= 12) {
                    break;
                }
            }
        } catch (\Throwable) {
            // non-fatal
        }

        $recentLogs = [];
        try {
            $diaryRepo = DiaryRepository::make();
            $todayLogs = $diaryRepo->findPage([
                'date' => $date,
            ], 1, 10);
            $recentLogs = $todayLogs['items'] ?? [];
        } catch (\Throwable) {
            // non-fatal
        }

        $snapshot = null;
        try {
            $snapshot = SnapshotService::buildForDate($date, isset($aiPlan['id']) ? (int) $aiPlan['id'] : null, $timezone);
            $snapshot['diary_streak'] = SnapshotService::getDiaryStreak($date, $timezone);
        } catch (\Throwable) {
            // non-fatal
        }

        $payload = [
            'date' => $date,
            'weather' => $weather,
            'events' => $events,
            'emails' => $emails,
            'tasks_today' => $tasksToday,
            'tasks_overdue' => $tasksOverdue,
            'tasks_active' => $tasksActive,
            'recent_logs' => $recentLogs,
            'ai_plan' => $aiPlan,
            'snapshot' => $snapshot,
            'evening_plan' => $eveningPlan,
        ];
        Response::success($payload);
    }

    /**
     * Cached evening (end-of-day) plan for a calendar date, optionally generating after 22:30 local.
     */
    public function eveningPlan(Request $request): void
    {
        $requestedDate = $this->normalizeBriefingDate($request);
        if ($requestedDate === null) {
            Response::error('validation_error', 'Invalid date; use YYYY-MM-DD', 422, 'date');

            return;
        }

        $db = Database::getInstance();
        $hub = $this->loadWorkdaySettings($db);
        $timezone = $hub['timezone'];
        $workStart = $hub['work_start'];
        $workEnd = $hub['work_end'];
        $date = $requestedDate;

        $events = [];
        try {
            $events = CalendarService::loadCachedForDay($date, $timezone);
        } catch (\Throwable) {
        }

        $force = $request->getQueryString('force') === '1';

        $eveningPlan = null;
        try {
            $aiRepo = AiPlanRepository::make();
            $eveningPlan = $this->resolveEveningPlan($date, $db, $timezone, $workStart, $workEnd, $events, $aiRepo, $force);
        } catch (\Throwable) {
        }

        Response::success([
            'date' => $date,
            'evening_plan' => $eveningPlan,
        ]);
    }

    private function normalizeBriefingDate(Request $request): ?string
    {
        $date = $request->getQueryString('date');
        if ($date === null || $date === '') {
            // Must match settings timezone — plain date() uses the PHP default (often UTC) and
            // yields the wrong calendar day around local midnight vs UTC.
            $date = $this->todayYmdInAppTimezone();
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return null;
        }

        return $date;
    }

    /** Calendar "today" (YYYY-MM-DD) in `settings.timezone`, not the server clock zone. */
    private function todayYmdInAppTimezone(): string
    {
        $tzName = 'UTC';
        try {
            $stmt = Database::getInstance()->prepare("SELECT value FROM settings WHERE key = 'timezone' LIMIT 1");
            $stmt->execute();
            $tzName = trim((string) ($stmt->fetchColumn() ?: ''));
        } catch (\Throwable) {
            $tzName = 'UTC';
        }
        if ($tzName === '') {
            $tzName = 'UTC';
        }
        $tz = $this->safeTimezone($tzName);

        return (new \DateTimeImmutable('now', $tz))->format('Y-m-d');
    }

    /**
     * @return array{timezone: string, work_start: int, work_end: int}
     */
    private function loadWorkdaySettings(PDO $db): array
    {
        $timezone = 'UTC';
        $workStart = 9;
        $workEnd = 18;
        try {
            $stmt = $db->prepare(
                "SELECT key, value FROM settings WHERE key IN ('timezone','work_start_hour','work_end_hour')",
            );
            $stmt->execute();
            /** @var array<string, string> $settings */
            $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
            $timezone = trim((string) ($settings['timezone'] ?? 'UTC'));
            if ($timezone === '') {
                $timezone = 'UTC';
            }
            $workStart = (int) ($settings['work_start_hour'] ?? 9);
            $workEnd = (int) ($settings['work_end_hour'] ?? 18);
        } catch (\Throwable) {
            $timezone = 'UTC';
            $workStart = 9;
            $workEnd = 18;
        }

        return [
            'timezone' => $timezone,
            'work_start' => $workStart,
            'work_end' => $workEnd,
        ];
    }

    /**
     * @param list<array<string, mixed>> $events
     * @return array<string, mixed>|null
     */
    private function resolveEveningPlan(
        string $date,
        PDO $db,
        string $timezone,
        int $workStart,
        int $workEnd,
        array $events,
        AiPlanRepository $aiRepo,
        bool $force = false,
    ): ?array {
        $existing = $aiRepo->findForDate($date, 'evening');
        if ($existing !== null && !$force) {
            return $existing;
        }

        $settingStmt = $db->prepare(
            "SELECT value FROM settings WHERE key = 'ai_evening_plan_enabled' LIMIT 1",
        );
        $settingStmt->execute();
        $eveningEnabled = trim((string) ($settingStmt->fetchColumn() ?: '1')) === '1';
        if (!$eveningEnabled) {
            return $existing;
        }

        if (!$force) {
            $tzObj = $this->safeTimezone($timezone);
            $localNow = new \DateTime('now', $tzObj);
            $todayStr = $localNow->format('Y-m-d');
            $isPastDay = $date < $todayStr;

            if (!$isPastDay) {
                $localHour = (int) $localNow->format('H');
                $localMin = (int) $localNow->format('i');
                $isAfter2230 = ($localHour > 22) || ($localHour === 22 && $localMin >= 30);
                if (!$isAfter2230) {
                    return $existing;
                }
            }
        }

        $anthropic = AnthropicService::makeFromSettings();
        if ($anthropic === null) {
            return null;
        }

        return $this->generateEveningPlan(
            $date,
            $timezone,
            $workStart,
            $workEnd,
            $events,
            $anthropic,
            $aiRepo,
        );
    }

    /**
     * @param list<array<string, mixed>> $events
     * @return array<string, mixed>|null
     */
    private function generateEveningPlan(
        string $date,
        string $timezone,
        int $workStart,
        int $workEnd,
        array $events,
        AnthropicService $anthropic,
        AiPlanRepository $aiRepo,
    ): ?array {
        $db = Database::getInstance();
        $tzObj = $this->safeTimezone($timezone);
        $dayStartDt = new \DateTimeImmutable($date . ' 00:00:00', $tzObj);
        $dayEndDt = new \DateTimeImmutable($date . ' 23:59:59', $tzObj);
        $dayStart = $dayStartDt->getTimestamp();
        $dayEnd = $dayEndDt->getTimestamp();

        $doneStmt = $db->prepare(
            "SELECT title, estimated_mins, actual_mins FROM tasks
             WHERE status = 'done' AND deleted_at IS NULL
               AND (
                 (completed_at >= ? AND completed_at <= ?)
                 OR (completed_at IS NULL AND due_date >= ? AND due_date <= ?)
               )
             ORDER BY COALESCE(completed_at, due_date) ASC LIMIT 20",
        );
        $doneStmt->execute([$dayStart, $dayEnd, $dayStart, $dayEnd]);
        /** @var list<array<string, mixed>> $doneTasks */
        $doneTasks = $doneStmt->fetchAll(PDO::FETCH_ASSOC);

        $addedStmt = $db->prepare(
            "SELECT title, status FROM tasks
             WHERE created_at >= ? AND created_at <= ?
               AND status NOT IN ('done','cancelled') AND deleted_at IS NULL
             LIMIT 10",
        );
        $addedStmt->execute([$dayStart, $dayEnd]);
        /** @var list<array<string, mixed>> $addedTasks */
        $addedTasks = $addedStmt->fetchAll(PDO::FETCH_ASSOC);

        $openStmt = $db->prepare(
            "SELECT title, status, priority FROM tasks
             WHERE status IN ('todo','in_progress','in_review')
               AND deleted_at IS NULL
             ORDER BY priority DESC LIMIT 10",
        );
        $openStmt->execute();
        /** @var list<array<string, mixed>> $openTasks */
        $openTasks = $openStmt->fetchAll(PDO::FETCH_ASSOC);

        $logStmt = $db->prepare(
            'SELECT log_type, body, mood_score, logged_at FROM diary_logs
             WHERE logged_at >= ? AND logged_at <= ? AND deleted_at IS NULL
             ORDER BY logged_at ASC LIMIT 20',
        );
        $logStmt->execute([$dayStart, $dayEnd]);
        /** @var list<array<string, mixed>> $logs */
        $logs = $logStmt->fetchAll(PDO::FETCH_ASSOC);

        $moodScores = array_filter(
            array_column($logs, 'mood_score'),
            static fn($s): bool => $s !== null,
        );
        $avgMood = count($moodScores) > 0
            ? round((float) array_sum($moodScores) / count($moodScores), 1)
            : null;

        $systemPrompt = implode("\n", [
            'You are a personal productivity coach delivering a warm, honest end-of-day reflection.',
            'Today is ' . $date . '. Timezone: ' . $timezone . '.',
            'Be specific - reference actual tasks and logs by name. Max 3 sentences for reflection.',
            'Respond ONLY with valid JSON - no markdown, no preamble.',
        ]);

        $doneLines = array_map(
            static fn(array $t): string => '- [done] ' . (string) ($t['title'] ?? '')
                . (!empty($t['actual_mins']) ? ' (' . (int) $t['actual_mins'] . 'min)' : ''),
            $doneTasks,
        );
        $addedLines = array_map(
            static fn(array $t): string => '- [added today, ' . (string) ($t['status'] ?? 'todo') . '] '
                . (string) ($t['title'] ?? ''),
            $addedTasks,
        );
        $openLines = array_map(
            static fn(array $t): string => '- [still open, P' . (int) ($t['priority'] ?? 2) . '] '
                . (string) ($t['title'] ?? ''),
            $openTasks,
        );
        $logLines = array_map(
            static fn(array $l): string => '- [' . (string) ($l['log_type'] ?? 'activity') . '] '
                . (string) ($l['body'] ?? '')
                . ($l['mood_score'] !== null ? ' (mood: ' . $l['mood_score'] . '/10)' : ''),
            $logs,
        );
        $calendarLines = array_map(
            fn(array $e): string => '- '
                . (new \DateTimeImmutable('@' . (int) ($e['start_at'] ?? 0)))
                    ->setTimezone($tzObj)
                    ->format('H:i')
                . '-'
                . (new \DateTimeImmutable('@' . (int) ($e['end_at'] ?? 0)))
                    ->setTimezone($tzObj)
                    ->format('H:i')
                . ': ' . (string) ($e['title'] ?? ''),
            $events,
        );

        $userPrompt = implode("\n", array_filter([
            'COMPLETED today:',
            $doneLines !== [] ? implode("\n", $doneLines) : '- Nothing completed',
            '',
            'ADDED today (not yet done):',
            $addedLines !== [] ? implode("\n", $addedLines) : '- None',
            '',
            'STILL OPEN (carried over):',
            $openLines !== [] ? implode("\n", $openLines) : '- None',
            '',
            'CALENDAR today:',
            $calendarLines !== [] ? implode("\n", $calendarLines) : '- No events',
            '',
            'DIARY & MOOD logs:',
            $logLines !== [] ? implode("\n", $logLines) : '- None',
            $avgMood !== null ? 'Average mood today: ' . $avgMood . '/10' : '',
            '',
            'Write a day summary. Respond with:',
            '{',
            '  "reflection": "2-3 warm sentences. Be specific - name actual tasks. Acknowledge what was left open without guilt.",',
            '  "close_prompt": "One short encouraging sentence to wind down for the night.",',
            '  "score": <integer 1-100 reflecting how productive and balanced the day looks>',
            '}',
        ]));

        $result = $anthropic->generate($systemPrompt, $userPrompt, 400);
        if ($result === null) {
            return null;
        }

        $parsed = $anthropic->parseJsonResponse((string) ($result['text'] ?? ''));
        $reflection = is_array($parsed) && isset($parsed['reflection']) ? (string) $parsed['reflection'] : '';
        $closePrompt = is_array($parsed) && isset($parsed['close_prompt']) ? (string) $parsed['close_prompt'] : '';
        $reflectionPayload = json_encode([
            'reflection' => $reflection,
            'close_prompt' => $closePrompt,
        ], JSON_UNESCAPED_UNICODE);

        return $aiRepo->save([
            'plan_date' => $date,
            'plan_type' => 'evening',
            'tasks_snapshot' => array_values(array_map(static fn(array $t): string => (string) ($t['title'] ?? ''), $doneTasks)),
            'logs_snapshot' => [],
            'calendar_context' => $events,
            'prompt_tokens' => isset($result['prompt_tokens']) ? (int) $result['prompt_tokens'] : null,
            'completion_tokens' => isset($result['completion_tokens']) ? (int) $result['completion_tokens'] : null,
            'model_used' => (string) ($result['model'] ?? 'claude-sonnet-4-20250514'),
            'raw_response' => (string) ($result['text'] ?? ''),
            'parsed_schedule' => [],
            'reflection' => is_string($reflectionPayload) ? $reflectionPayload : null,
            'suggested_tasks' => [],
            'score' => is_array($parsed) && isset($parsed['score']) ? (int) $parsed['score'] : null,
            'close_prompt' => $closePrompt,
        ]);
    }

    private function safeTimezone(string $timezone): \DateTimeZone
    {
        try {
            return new \DateTimeZone(trim($timezone) !== '' ? $timezone : 'UTC');
        } catch (\Throwable) {
            return new \DateTimeZone('UTC');
        }
    }

    private function isBefore2230(string $timezone): bool
    {
        $now = new \DateTime('now', $this->safeTimezone($timezone));
        $hour = (int) $now->format('H');
        $minute = (int) $now->format('i');

        return $hour < 22 || ($hour === 22 && $minute < 30);
    }
}
