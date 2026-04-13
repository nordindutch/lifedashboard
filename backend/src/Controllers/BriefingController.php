<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;

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

        $payload = [
            'date' => $date,
            'weather' => null,
            'events' => [],
            'emails' => [],
            'tasks_today' => [],
            'tasks_overdue' => [],
            'recent_logs' => [],
            'ai_plan' => null,
            'snapshot' => null,
        ];
        Response::success($payload);
    }
}
