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
            $snapshot = SnapshotService::buildForDate($date, isset($aiPlan['id']) ? (int) $aiPlan['id'] : null);
            $snapshot['diary_streak'] = SnapshotService::getDiaryStreak($date);
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

        $events = [];
        try {
            $events = CalendarService::loadCachedForDay($date, $timezone);
        } catch (\Throwable) {
        }

        $eveningPlan = null;
        try {
            $aiRepo = AiPlanRepository::make();
            $eveningPlan = $this->resolveEveningPlan($date, $db, $timezone, $workStart, $workEnd, $events, $aiRepo);
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
            $date = date('Y-m-d');
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return null;
        }

        return $date;
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
    ): ?array {
        $existing = $aiRepo->findForDate($date, 'evening');
        if ($existing !== null) {
            return $existing;
        }

        $tzObj = $this->safeTimezone($timezone);
        $localNow = new \DateTime('now', $tzObj);
        $localHour = (int) $localNow->format('H');
        $localMin = (int) $localNow->format('i');
        $isAfter2230 = ($localHour > 22) || ($localHour === 22 && $localMin >= 30);

        $settingStmt = $db->prepare(
            "SELECT value FROM settings WHERE key = 'ai_evening_plan_enabled' LIMIT 1",
        );
        $settingStmt->execute();
        $eveningEnabled = trim((string) ($settingStmt->fetchColumn() ?: '1')) === '1';

        if (!$isAfter2230 || !$eveningEnabled) {
            return null;
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

        $dayStart = (int) strtotime($date . ' 00:00:00');
        $dayEnd = (int) strtotime($date . ' 23:59:59');

        $doneStmt = $db->prepare(
            'SELECT title, estimated_mins, actual_mins FROM tasks
             WHERE completed_at >= ? AND completed_at <= ? AND deleted_at IS NULL
             LIMIT 20',
        );
        $doneStmt->execute([$dayStart, $dayEnd]);
        /** @var list<array<string, mixed>> $doneTasks */
        $doneTasks = $doneStmt->fetchAll(PDO::FETCH_ASSOC);

        $logStmt = $db->prepare(
            'SELECT log_type, body, mood_score FROM diary_logs
             WHERE logged_at >= ? AND logged_at <= ? AND deleted_at IS NULL
             ORDER BY logged_at ASC LIMIT 15',
        );
        $logStmt->execute([$dayStart, $dayEnd]);
        /** @var list<array<string, mixed>> $logs */
        $logs = $logStmt->fetchAll(PDO::FETCH_ASSOC);

        $systemPrompt = implode("\n", [
            'You are a personal productivity coach delivering an end-of-day reflection.',
            'Today is ' . $date . '. Timezone: ' . $timezone . '.',
            'The user workday was configured as ' . $workStart . ':00-' . $workEnd . ':00.',
            'Be warm, specific, and brief. Max 3 sentences for reflection.',
            'Respond ONLY with valid JSON - no markdown, no preamble.',
        ]);

        $taskLines = array_map(
            static fn(array $t): string => '- ' . (string) ($t['title'] ?? 'Untitled')
                . (!empty($t['actual_mins']) ? ' (' . (int) $t['actual_mins'] . 'min)' : ''),
            $doneTasks,
        );
        $logLines = array_map(
            static fn(array $l): string => '- [' . (string) ($l['log_type'] ?? 'activity') . '] ' . (string) ($l['body'] ?? ''),
            $logs,
        );

        $userPrompt = implode("\n", [
            'Tasks completed today:',
            $taskLines !== [] ? implode("\n", $taskLines) : '- None',
            '',
            'Diary logs:',
            $logLines !== [] ? implode("\n", $logLines) : '- None',
            '',
            'Respond with:',
            '{',
            '  "reflection": "2-3 warm sentences summarising the day and one positive observation",',
            '  "close_prompt": "One encouraging sentence urging the user to wrap up for the night",',
            '  "score": 1-100',
            '}',
        ]);

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
}
