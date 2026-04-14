<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\AiPlanRepository;
use Codex\Services\AnthropicService;
use Codex\Services\CalendarService;
use PDO;

final class AiController
{
    public function __construct(private readonly AiPlanRepository $plans)
    {
    }

    public function getPlan(Request $request): void
    {
        $date = (string) ($request->getQueryString('date') ?? date('Y-m-d'));
        $type = (string) ($request->getQueryString('type') ?? 'adhoc');
        $plan = $this->plans->findForDate($date, $type);
        Response::success($plan);
    }

    public function generate(Request $request): void
    {
        $body = $request->getBody();
        $planType = (string) ($body['plan_type'] ?? 'adhoc');
        $planDate = (string) ($body['plan_date'] ?? date('Y-m-d'));
        $forceRegen = !empty($body['force_regenerate']);

        if (!$forceRegen) {
            $existing = $this->plans->findForDate($planDate, $planType);
            if ($existing !== null) {
                Response::success($existing);
                return;
            }
        }

        $db = Database::getInstance();
        $tasks = $db->query(
            "SELECT id, title, description, status, priority, estimated_mins, due_date
             FROM tasks
             WHERE status NOT IN ('done','cancelled') AND deleted_at IS NULL
             ORDER BY priority DESC, due_date ASC
             LIMIT 30",
        )->fetchAll(PDO::FETCH_ASSOC);

        $settingsStmt = $db->query(
            "SELECT key, value FROM settings WHERE key IN
             ('work_start_hour','work_end_hour','timezone','app_name')",
        );
        /** @var array<string, string> $settings */
        $settings = $settingsStmt->fetchAll(PDO::FETCH_KEY_PAIR);
        $workStart = (int) ($settings['work_start_hour'] ?? 9);
        $workEnd = (int) ($settings['work_end_hour'] ?? 18);
        $timezone = (string) ($settings['timezone'] ?? 'UTC');
        $events = CalendarService::loadCachedForDay($planDate, $timezone);

        $anthropic = AnthropicService::makeFromSettings();
        if ($anthropic === null) {
            Response::error('not_configured', 'Anthropic API key not set (configure ANTHROPIC_API_KEY in .env or anthropic_api_key in settings)', 422);
            return;
        }

        $systemPrompt = $this->buildSystemPrompt($planDate, $workStart, $workEnd, $timezone);
        $userPrompt = $this->buildUserPrompt($tasks, $events, $workStart, $workEnd, $timezone);

        $result = $anthropic->generate($systemPrompt, $userPrompt, 2000);
        if ($result === null) {
            Response::error('EXTERNAL_API_ERROR', 'Claude API call failed', 502);
            return;
        }

        $parsed = $anthropic->parseJsonResponse((string) ($result['text'] ?? ''));
        $schedule = is_array($parsed) && isset($parsed['schedule']) && is_array($parsed['schedule']) ? $parsed['schedule'] : [];
        $suggested = is_array($parsed) && isset($parsed['suggested_tasks']) && is_array($parsed['suggested_tasks']) ? $parsed['suggested_tasks'] : [];
        $reflection = is_array($parsed) && isset($parsed['reflection']) && is_string($parsed['reflection']) ? $parsed['reflection'] : null;
        $score = is_array($parsed) && isset($parsed['score']) ? (int) $parsed['score'] : null;
        $schedule = $this->normalizeScheduleForNow($schedule, $planDate, $timezone);
        $schedule = $this->finalizeScheduleWithCalendarAndBreaks($schedule, $events, $planDate, $timezone);

        $plan = $this->plans->save([
            'plan_date' => $planDate,
            'plan_type' => $planType,
            'tasks_snapshot' => array_values(array_map(static fn (array $task): int => (int) ($task['id'] ?? 0), $tasks)),
            'logs_snapshot' => [],
            'calendar_context' => $events,
            'prompt_tokens' => isset($result['prompt_tokens']) ? (int) $result['prompt_tokens'] : null,
            'completion_tokens' => isset($result['completion_tokens']) ? (int) $result['completion_tokens'] : null,
            'model_used' => (string) ($result['model'] ?? 'claude-sonnet-4-20250514'),
            'raw_response' => (string) ($result['text'] ?? ''),
            'parsed_schedule' => $schedule,
            'reflection' => $reflection,
            'suggested_tasks' => $suggested,
            'score' => $score,
        ]);
        Response::success($plan, 201);
    }

    public function history(Request $request): void
    {
        $page = max(1, (int) ($request->getQueryString('page') ?? '1'));
        $perPage = min(50, max(1, (int) ($request->getQueryString('per_page') ?? '20')));
        $result = $this->plans->listRecent($page, $perPage);
        Response::paginated($result['items'], ['total' => $result['total'], 'page' => $page, 'per_page' => $perPage]);
    }

    private function buildSystemPrompt(string $date, int $workStart, int $workEnd, string $timezone): string
    {
        $tz = $this->safeTimezone($timezone);
        $nowLabel = (new \DateTimeImmutable('now', $tz))->format('Y-m-d H:i');
        return implode("\n", [
            'You are a personal productivity assistant for a single user\'s Life OS.',
            'Your job is to create a realistic block schedule for the day that:',
            '- Respects fixed calendar commitments (meetings, appointments)',
            '- Identifies travel time: if a calendar event title contains words like',
            '  "trein", "train", "intercity", "NS", "Thalys", "Eurostar", "flight",',
            '  "vlucht", "bus", "metro", "ferry", "reisadvies" — treat it as a transit block where',
            '  the user can do focused reading or lightweight tasks (no deep work)',
            '- Estimates task duration intelligently: if estimated_mins is set use it;',
            '  otherwise estimate based on task title and description (typical ranges:',
            '  quick admin 15min, email/review 20-30min, focused work 45-90min, deep',
            '  work 90-120min)',
            '- Groups shallow tasks together into batches where sensible',
            '- Adds short breaks (10-15 min) every 90 minutes of focused work',
            '- Breaks must never overlap tasks, calendar commitments, or transit blocks — only place breaks in true gaps',
            '- Does not schedule work outside ' . $workStart . ':00–' . $workEnd . ':00',
            '- Responds ONLY with valid JSON — no markdown, no explanation, just JSON',
            '',
            'Today\'s date: ' . $date,
            'Timezone: ' . $timezone,
            'Current local time: ' . $nowLabel,
            'User work hours: ' . $workStart . ':00 – ' . $workEnd . ':00',
        ]);
    }

    /**
     * @param list<array<string, mixed>> $tasks
     * @param list<array<string, mixed>> $events
     */
    private function buildUserPrompt(array $tasks, array $events, int $workStart, int $workEnd, string $timezone): string
    {
        $tz = $this->safeTimezone($timezone);
        $nowLocal = new \DateTimeImmutable('now', $tz);
        $nowDate = $nowLocal->format('Y-m-d');
        $nowTime = $nowLocal->format('H:i');
        $taskLines = [];
        foreach ($tasks as $task) {
            $priority = (int) ($task['priority'] ?? 1);
            $title = trim((string) ($task['title'] ?? 'Untitled task'));
            $desc = trim((string) ($task['description'] ?? ''));
            $descPart = $desc !== '' ? ': ' . substr($desc, 0, 80) : '';
            $est = isset($task['estimated_mins']) && $task['estimated_mins'] !== null
                ? ((int) $task['estimated_mins']) . 'min'
                : 'unknown';
            $duePart = '';
            if (isset($task['due_date']) && $task['due_date'] !== null) {
                $dueTs = (int) $task['due_date'];
                if ($dueTs > 0) {
                    $duePart = ', due ' . $this->formatInTimezone($dueTs, $tz, 'D d M');
                }
            }
            $taskLines[] = '- [P' . $priority . '] ' . $title . $descPart . ' (est: ' . $est . ')' . $duePart . ' [task_id=' . (int) ($task['id'] ?? 0) . ']';
        }

        $eventLines = [];
        foreach ($events as $event) {
            $start = isset($event['start_at']) ? (int) $event['start_at'] : 0;
            $end = isset($event['end_at']) ? (int) $event['end_at'] : 0;
            $title = trim((string) ($event['title'] ?? '(untitled event)'));
            $location = isset($event['location']) && is_string($event['location']) && trim($event['location']) !== ''
                ? ' @ ' . trim($event['location'])
                : '';
            if ($start > 0 && $end > 0) {
                $eventLines[] = '- ' . $this->formatInTimezone($start, $tz, 'H:i') . '–' . $this->formatInTimezone($end, $tz, 'H:i') . ': ' . $title . $location;
            }
        }
        if ($eventLines === []) {
            $eventLines[] = '- No calendar events today';
        }

        return implode("\n", [
            'Here are my open tasks (priority 4=urgent, 1=low):',
            implode("\n", $taskLines === [] ? ['- No open tasks'] : $taskLines),
            '',
            'Today\'s calendar events:',
            implode("\n", $eventLines),
            '',
            'Respond with this exact JSON structure:',
            '{',
            '  "schedule": [',
            '    {',
            '      "start_time": "09:00",',
            '      "end_time": "10:30",',
            '      "task_id": 12,',
            '      "task_title": "Write project proposal",',
            '      "notes": "Deep work block — disable notifications",',
            '      "is_break": false,',
            '      "is_transit": false,',
            '      "is_calendar": false,',
            '      "estimated_mins": 90',
            '    }',
            '  ],',
            '  "reflection": "You have 3 high priority items and a 2-hour train ride at 14:00 which is good for the lighter review tasks.",',
            '  "suggested_tasks": [',
            '    {',
            '      "task_id": 5,',
            '      "action": "defer",',
            '      "reason": "Low priority and insufficient time today given your 14:00 train"',
            '    }',
            '  ],',
            '  "score": 72',
            '}',
            '',
            'Rules:',
            '- You MUST include one schedule block for EVERY calendar event listed above with the EXACT same local start_time and end_time, task_id null, is_break false, is_calendar true, task_title = event title',
            '- Do not duplicate calendar events as separate task blocks',
            '- task_id must be a real id from the task list above, or null for breaks/calendar/admin blocks',
            '- is_transit: true if this block is during a calendar event that appears to be travel',
            '- Do not schedule tasks during calendar events unless is_transit is true (transit = can do light tasks)',
            '- Break blocks: task_id null, is_break true — never overlap any other block (tasks, calendar, transit)',
            '- If planning for today (' . $nowDate . '), do not schedule any block starting before ' . $nowTime . ' local time',
            '- If there is not enough remaining time today, do not plan that task into schedule; put it in suggested_tasks with action "defer" or "reschedule"',
            '- Cover the full work day from ' . $workStart . ':00 to ' . $workEnd . ':00 (' . $timezone . ')',
            '- If a task has no estimated_mins, choose a realistic duration and set estimated_mins in your response',
            '- Respond only with valid JSON',
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

    private function formatInTimezone(int $timestamp, \DateTimeZone $timezone, string $format): string
    {
        $dt = (new \DateTimeImmutable('@' . $timestamp))->setTimezone($timezone);
        return $dt->format($format);
    }

    /**
     * @param list<array<string, mixed>> $schedule
     * @return list<array<string, mixed>>
     */
    private function normalizeScheduleForNow(array $schedule, string $planDate, string $timezone): array
    {
        $tz = $this->safeTimezone($timezone);
        $now = new \DateTimeImmutable('now', $tz);
        if ($now->format('Y-m-d') !== $planDate) {
            return $schedule;
        }

        $out = [];
        foreach ($schedule as $block) {
            if (!is_array($block)) {
                continue;
            }
            $startRaw = isset($block['start_time']) ? trim((string) $block['start_time']) : '';
            $endRaw = isset($block['end_time']) ? trim((string) $block['end_time']) : '';
            if ($startRaw === '' || $endRaw === '') {
                continue;
            }
            $start = $this->timeOnPlanDate($planDate, $startRaw, $tz);
            $end = $this->timeOnPlanDate($planDate, $endRaw, $tz);
            if ($start === null || $end === null || $end <= $start) {
                continue;
            }
            // Drop any block that fully ended in the past.
            if ($end <= $now) {
                continue;
            }
            // If block started already, trim to "now" so new plan never starts in past.
            if ($start < $now) {
                $start = $now;
                $block['start_time'] = $start->format('H:i');
                $mins = (int) floor(($end->getTimestamp() - $start->getTimestamp()) / 60);
                if ($mins <= 0) {
                    continue;
                }
                if (array_key_exists('estimated_mins', $block) && $block['estimated_mins'] !== null) {
                    $block['estimated_mins'] = $mins;
                }
            }
            $out[] = $block;
        }

        return $out;
    }

    private function timeOnPlanDate(string $planDate, string $time, \DateTimeZone $tz): ?\DateTimeImmutable
    {
        if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
            return null;
        }
        $dt = \DateTimeImmutable::createFromFormat('Y-m-d H:i', $planDate . ' ' . $time, $tz);
        if (!$dt instanceof \DateTimeImmutable) {
            return null;
        }

        return $dt;
    }

    private function eventLooksLikeTransit(string $title): bool
    {
        $t = strtolower($title);
        $needles = [
            'trein', 'train', 'intercity', 'ns ', ' ns', 'thalys', 'eurostar', 'flight', 'vlucht',
            'bus', 'metro', 'ferry', 'reisadvies',
        ];
        foreach ($needles as $n) {
            if (str_contains($t, $n)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param list<array<string, mixed>> $schedule
     * @param list<array<string, mixed>> $events
     * @return list<array<string, mixed>>
     */
    private function finalizeScheduleWithCalendarAndBreaks(array $schedule, array $events, string $planDate, string $timezone): array
    {
        $tz = $this->safeTimezone($timezone);
        $now = new \DateTimeImmutable('now', $tz);
        $clipNow = $now->format('Y-m-d') === $planDate ? $now : null;

        $calendarBlocks = $this->buildCalendarBlocksFromEvents($events, $planDate, $tz, $clipNow);
        $calIntervals = $this->blocksToIntervals($calendarBlocks, $planDate, $tz);

        $aiNonBreak = [];
        $aiBreaks = [];
        foreach ($schedule as $block) {
            if (!is_array($block)) {
                continue;
            }
            $isBreak = !empty($block['is_break']);
            if ($isBreak) {
                $aiBreaks[] = $block;
            } else {
                if (!empty($block['is_calendar'])) {
                    continue;
                }
                $aiNonBreak[] = $block;
            }
        }

        $breakIntervalsFromAi = $this->blocksToIntervals($aiBreaks, $planDate, $tz);
        $forbiddenForTasks = $this->mergeIntervals(array_merge($calIntervals, $breakIntervalsFromAi));

        $tasksFiltered = [];
        foreach ($aiNonBreak as $block) {
            $iv = $this->blockToInterval($block, $planDate, $tz);
            if ($iv === null) {
                continue;
            }
            $segments = $this->subtractFromBusy($iv['start'], $iv['end'], $forbiddenForTasks);
            foreach ($segments as [$segStart, $segEnd]) {
                $mins = (int) floor(($segEnd->getTimestamp() - $segStart->getTimestamp()) / 60);
                if ($mins < 3) {
                    continue;
                }
                $piece = $block;
                $piece['start_time'] = $segStart->format('H:i');
                $piece['end_time'] = $segEnd->format('H:i');
                $piece['estimated_mins'] = $mins;
                $tasksFiltered[] = $piece;
            }
        }

        $tasksResolved = $this->resolveTaskOverlaps($tasksFiltered, $planDate, $tz);
        $taskIntervals = $this->blocksToIntervals($tasksResolved, $planDate, $tz);
        $busyMerged = $this->mergeIntervals(array_merge($calIntervals, $taskIntervals));

        $newBreaks = [];
        foreach ($aiBreaks as $breakBlock) {
            $iv = $this->blockToInterval($breakBlock, $planDate, $tz);
            if ($iv === null) {
                continue;
            }
            $segments = $this->subtractFromBusy($iv['start'], $iv['end'], $busyMerged);
            foreach ($segments as [$segStart, $segEnd]) {
                $mins = (int) floor(($segEnd->getTimestamp() - $segStart->getTimestamp()) / 60);
                if ($mins < 3) {
                    continue;
                }
                $piece = $breakBlock;
                $piece['start_time'] = $segStart->format('H:i');
                $piece['end_time'] = $segEnd->format('H:i');
                $piece['estimated_mins'] = $mins;
                $newBreaks[] = $piece;
            }
        }

        $all = array_merge($calendarBlocks, $tasksResolved, $newBreaks);
        usort($all, static function (array $a, array $b) use ($planDate, $tz): int {
            $as = isset($a['start_time']) ? trim((string) $a['start_time']) : '';
            $bs = isset($b['start_time']) ? trim((string) $b['start_time']) : '';
            $ta = \DateTimeImmutable::createFromFormat('Y-m-d H:i', $planDate . ' ' . $as, $tz);
            $tb = \DateTimeImmutable::createFromFormat('Y-m-d H:i', $planDate . ' ' . $bs, $tz);
            $sa = $ta instanceof \DateTimeImmutable ? $ta->getTimestamp() : 0;
            $sb = $tb instanceof \DateTimeImmutable ? $tb->getTimestamp() : 0;

            return $sa <=> $sb;
        });

        return $all;
    }

    /**
     * @param list<array<string, mixed>> $events
     * @return list<array<string, mixed>>
     */
    private function buildCalendarBlocksFromEvents(array $events, string $planDate, \DateTimeZone $tz, ?\DateTimeImmutable $clipNow): array
    {
        $dayStart = \DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $planDate . ' 00:00:00', $tz);
        $dayEndEx = $dayStart instanceof \DateTimeImmutable ? $dayStart->modify('+1 day') : null;
        if (!$dayStart instanceof \DateTimeImmutable || !$dayEndEx instanceof \DateTimeImmutable) {
            return [];
        }

        $out = [];
        foreach ($events as $ev) {
            if (!is_array($ev)) {
                continue;
            }
            $startTs = isset($ev['start_at']) ? (int) $ev['start_at'] : 0;
            $endTs = isset($ev['end_at']) ? (int) $ev['end_at'] : 0;
            if ($startTs <= 0 || $endTs <= 0) {
                continue;
            }
            $start = (new \DateTimeImmutable('@' . $startTs))->setTimezone($tz);
            $end = (new \DateTimeImmutable('@' . $endTs))->setTimezone($tz);
            if ($end <= $dayStart || $start >= $dayEndEx) {
                continue;
            }
            if ($start < $dayStart) {
                $start = $dayStart;
            }
            if ($end > $dayEndEx) {
                $end = $dayEndEx;
            }
            if ($end <= $start) {
                continue;
            }
            if ($clipNow !== null) {
                if ($end <= $clipNow) {
                    continue;
                }
                if ($start < $clipNow) {
                    $start = $clipNow;
                }
            }
            if ($end <= $start) {
                continue;
            }

            $title = trim((string) ($ev['title'] ?? 'Calendar'));
            $loc = isset($ev['location']) && is_string($ev['location']) ? trim($ev['location']) : '';
            $isTransit = $this->eventLooksLikeTransit($title);
            $mins = (int) floor(($end->getTimestamp() - $start->getTimestamp()) / 60);

            $out[] = [
                'start_time' => $start->format('H:i'),
                'end_time' => $end->format('H:i'),
                'task_id' => null,
                'task_title' => $title,
                'notes' => $loc !== '' ? '@ ' . $loc : 'Calendar',
                'is_break' => false,
                'is_transit' => $isTransit,
                'is_calendar' => true,
                'estimated_mins' => max(1, $mins),
            ];
        }

        return $out;
    }

    /**
     * @param array<string, mixed> $block
     * @return array{start: \DateTimeImmutable, end: \DateTimeImmutable}|null
     */
    private function blockToInterval(array $block, string $planDate, \DateTimeZone $tz): ?array
    {
        $startRaw = isset($block['start_time']) ? trim((string) $block['start_time']) : '';
        $endRaw = isset($block['end_time']) ? trim((string) $block['end_time']) : '';
        $start = $this->timeOnPlanDate($planDate, $startRaw, $tz);
        $end = $this->timeOnPlanDate($planDate, $endRaw, $tz);
        if ($start === null || $end === null || $end <= $start) {
            return null;
        }

        return ['start' => $start, 'end' => $end];
    }

    /**
     * @param list<array<string, mixed>> $blocks
     * @return list<array{start: \DateTimeImmutable, end: \DateTimeImmutable}>
     */
    private function blocksToIntervals(array $blocks, string $planDate, \DateTimeZone $tz): array
    {
        $out = [];
        foreach ($blocks as $b) {
            if (!is_array($b)) {
                continue;
            }
            $iv = $this->blockToInterval($b, $planDate, $tz);
            if ($iv !== null) {
                $out[] = $iv;
            }
        }

        return $out;
    }

    /**
     * @param list<array{start: \DateTimeImmutable, end: \DateTimeImmutable}> $intervals
     * @return list<array{start: \DateTimeImmutable, end: \DateTimeImmutable}>
     */
    private function mergeIntervals(array $intervals): array
    {
        if ($intervals === []) {
            return [];
        }
        usort($intervals, static function (array $a, array $b): int {
            return $a['start']->getTimestamp() <=> $b['start']->getTimestamp();
        });
        $out = [];
        $cur = $intervals[0];
        for ($i = 1, $n = count($intervals); $i < $n; $i++) {
            $nxt = $intervals[$i];
            if ($nxt['start'] <= $cur['end']) {
                if ($nxt['end'] > $cur['end']) {
                    $cur = ['start' => $cur['start'], 'end' => $nxt['end']];
                }
            } else {
                $out[] = $cur;
                $cur = $nxt;
            }
        }
        $out[] = $cur;

        return $out;
    }

    /**
     * @param list<array{start: \DateTimeImmutable, end: \DateTimeImmutable}> $busyMerged sorted merged
     * @return list<array{0: \DateTimeImmutable, 1: \DateTimeImmutable}>
     */
    private function subtractFromBusy(\DateTimeImmutable $s, \DateTimeImmutable $e, array $busyMerged): array
    {
        $segments = [[$s, $e]];
        foreach ($busyMerged as $b) {
            $next = [];
            foreach ($segments as [$ss, $ee]) {
                if ($b['end'] <= $ss || $b['start'] >= $ee) {
                    $next[] = [$ss, $ee];
                    continue;
                }
                if ($b['start'] > $ss) {
                    $next[] = [$ss, $b['start']];
                }
                if ($b['end'] < $ee) {
                    $next[] = [$b['end'], $ee];
                }
            }
            $segments = array_values(array_filter($next, static fn (array $x): bool => $x[1] > $x[0]));
            if ($segments === []) {
                return [];
            }
        }

        return $segments;
    }

    /**
     * @param list<array<string, mixed>> $tasks
     * @return list<array<string, mixed>>
     */
    private function resolveTaskOverlaps(array $tasks, string $planDate, \DateTimeZone $tz): array
    {
        $withIv = [];
        foreach ($tasks as $t) {
            if (!is_array($t)) {
                continue;
            }
            $iv = $this->blockToInterval($t, $planDate, $tz);
            if ($iv === null) {
                continue;
            }
            $withIv[] = ['block' => $t, 'iv' => $iv];
        }
        usort($withIv, static function (array $a, array $b): int {
            return $a['iv']['start']->getTimestamp() <=> $b['iv']['start']->getTimestamp();
        });

        $lastEnd = null;
        $out = [];
        foreach ($withIv as $row) {
            $b = $row['block'];
            $iv = $row['iv'];
            $start = $iv['start'];
            $end = $iv['end'];
            if ($lastEnd !== null && $start < $lastEnd) {
                $start = $lastEnd;
            }
            if ($end <= $start) {
                continue;
            }
            $b['start_time'] = $start->format('H:i');
            $b['end_time'] = $end->format('H:i');
            $b['estimated_mins'] = (int) floor(($end->getTimestamp() - $start->getTimestamp()) / 60);
            $out[] = $b;
            $lastEnd = $end;
        }

        return $out;
    }
}
