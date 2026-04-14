<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\TaskRepository;
use Codex\Services\CalendarService;
use Codex\Services\GmailService;
use Codex\Services\WeatherService;

/**
 * Home Hub aggregate — stub until weather/calendar/email/tasks are wired to repositories.
 */
final class BriefingController
{
    public function index(Request $request): void
    {
        $date = $request->getQueryString('date');
        if ($date === null || $date === '') {
            $date = date('Y-m-d');
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            Response::error('validation_error', 'Invalid date; use YYYY-MM-DD', 422, 'date');

            return;
        }

        $weather = null;
        try {
            $service = WeatherService::makeFromSettings();
            if ($service !== null) {
                $weather = $service->getCurrent();
            }
        } catch (\Throwable) {
            // non-fatal — briefing still returns without weather
        }

        $events = [];
        try {
            $events = CalendarService::loadCachedForDay($date);
        } catch (\Throwable) {
            // non-fatal — briefing still returns without events
        }

        $emails = [];
        try {
            GmailService::maybeAutoSync(GmailService::AUTO_SYNC_INTERVAL_SEC, 20);
            $emails = GmailService::loadCachedUnread(5);
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

        $payload = [
            'date' => $date,
            'weather' => $weather,
            'events' => $events,
            'emails' => $emails,
            'tasks_today' => $tasksToday,
            'tasks_overdue' => $tasksOverdue,
            'tasks_active' => $tasksActive,
            'recent_logs' => [],
            'ai_plan' => null,
            'snapshot' => null,
        ];
        Response::success($payload);
    }
}
