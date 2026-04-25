<?php

declare(strict_types=1);

namespace Codex\Services;

use Codex\Core\Database;
use PDO;

final class SnapshotService
{
    /**
     * @return array<string, mixed>
     */
    public static function buildForDate(string $date, ?int $aiPlanId = null, string $timezone = 'UTC'): array
    {
        $db = Database::getInstance();

        $tzObj = self::safeTimezone($timezone);
        $dayStart = (new \DateTimeImmutable($date . ' 00:00:00', $tzObj))->getTimestamp();
        $dayEnd = (new \DateTimeImmutable($date . ' 23:59:59', $tzObj))->getTimestamp();

        $tasksPlanned = self::countWhere(
            $db,
            'tasks',
            'due_date >= ? AND due_date <= ? AND deleted_at IS NULL',
            [$dayStart, $dayEnd],
        );

        $completedStmt = $db->prepare(
            "SELECT COUNT(*) FROM tasks
             WHERE status = 'done' AND deleted_at IS NULL
               AND (
                 (completed_at >= ? AND completed_at <= ?)
                 OR (completed_at IS NULL AND due_date >= ? AND due_date <= ?)
               )",
        );
        $completedStmt->execute([$dayStart, $dayEnd, $dayStart, $dayEnd]);
        $tasksCompleted = (int) $completedStmt->fetchColumn();

        $tasksAdded = self::countWhere(
            $db,
            'tasks',
            'created_at >= ? AND created_at <= ? AND deleted_at IS NULL',
            [$dayStart, $dayEnd],
        );

        $logCount = self::countWhere(
            $db,
            'diary_logs',
            'logged_at >= ? AND logged_at <= ? AND deleted_at IS NULL',
            [$dayStart, $dayEnd],
        );

        $moodStmt = $db->prepare(
            'SELECT AVG(mood_score) FROM diary_logs
             WHERE logged_at >= ? AND logged_at <= ? AND mood_score IS NOT NULL AND deleted_at IS NULL',
        );
        $moodStmt->execute([$dayStart, $dayEnd]);
        $avgMoodRaw = $moodStmt->fetchColumn();
        $avgMood = $avgMoodRaw !== false && $avgMoodRaw !== null ? round((float) $avgMoodRaw, 1) : null;

        $timeStmt = $db->prepare(
            'SELECT COALESCE(SUM(estimated_mins), 0), COALESCE(SUM(actual_mins), 0)
             FROM tasks
             WHERE completed_at >= ? AND completed_at <= ? AND deleted_at IS NULL',
        );
        $timeStmt->execute([$dayStart, $dayEnd]);
        /** @var array<int, mixed>|false $timeRow */
        $timeRow = $timeStmt->fetch(PDO::FETCH_NUM);
        $totalEstimated = isset($timeRow[0]) ? (int) $timeRow[0] : 0;
        $totalActual = isset($timeRow[1]) ? (int) $timeRow[1] : 0;

        $upsert = $db->prepare(
            'INSERT INTO daily_snapshots
             (snapshot_date, tasks_planned, tasks_completed, tasks_added, tasks_deferred,
              total_estimated_mins, total_actual_mins, log_count, avg_mood_score, ai_plan_id,
              created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
             ON CONFLICT(snapshot_date) DO UPDATE SET
               tasks_planned        = excluded.tasks_planned,
               tasks_completed      = excluded.tasks_completed,
               tasks_added          = excluded.tasks_added,
               tasks_deferred       = excluded.tasks_deferred,
               total_estimated_mins = excluded.total_estimated_mins,
               total_actual_mins    = excluded.total_actual_mins,
               log_count            = excluded.log_count,
               avg_mood_score       = excluded.avg_mood_score,
               ai_plan_id           = COALESCE(excluded.ai_plan_id, daily_snapshots.ai_plan_id),
               updated_at           = unixepoch()',
        );
        $upsert->execute([
            $date,
            $tasksPlanned,
            $tasksCompleted,
            $tasksAdded,
            0,
            $totalEstimated,
            $totalActual,
            $logCount,
            $avgMood,
            $aiPlanId,
        ]);

        $rowStmt = $db->prepare('SELECT * FROM daily_snapshots WHERE snapshot_date = ? LIMIT 1');
        $rowStmt->execute([$date]);
        /** @var array<string, mixed>|false $row */
        $row = $rowStmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            throw new \RuntimeException('Failed to load daily snapshot after upsert');
        }

        return self::mapSnapshotRow($row);
    }

    public static function getDiaryStreak(string $today, string $timezone = 'UTC'): int
    {
        $db = Database::getInstance();
        $tzObj = self::safeTimezone($timezone);
        $streak = 0;
        $current = $today;

        for ($i = 0; $i < 365; $i++) {
            $start = (new \DateTimeImmutable($current . ' 00:00:00', $tzObj))->getTimestamp();
            $end = (new \DateTimeImmutable($current . ' 23:59:59', $tzObj))->getTimestamp();

            $stmt = $db->prepare(
                'SELECT COUNT(*) FROM diary_logs
                 WHERE logged_at >= ? AND logged_at <= ? AND deleted_at IS NULL',
            );
            $stmt->execute([$start, $end]);
            $count = (int) $stmt->fetchColumn();
            if ($count === 0) {
                break;
            }

            $streak++;
            $current = (new \DateTimeImmutable($current . ' 00:00:00', $tzObj))
                ->modify('-1 day')
                ->format('Y-m-d');
        }

        return $streak;
    }

    private static function safeTimezone(string $name): \DateTimeZone
    {
        try {
            return new \DateTimeZone($name);
        } catch (\Throwable) {
            return new \DateTimeZone('UTC');
        }
    }

    /**
     * @param list<mixed> $bind
     */
    private static function countWhere(PDO $db, string $table, string $where, array $bind): int
    {
        $stmt = $db->prepare("SELECT COUNT(*) FROM {$table} WHERE {$where}");
        $stmt->execute($bind);

        return (int) $stmt->fetchColumn();
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private static function mapSnapshotRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'snapshot_date' => (string) $row['snapshot_date'],
            'tasks_planned' => (int) $row['tasks_planned'],
            'tasks_completed' => (int) $row['tasks_completed'],
            'tasks_added' => (int) $row['tasks_added'],
            'tasks_deferred' => (int) $row['tasks_deferred'],
            'total_estimated_mins' => (int) $row['total_estimated_mins'],
            'total_actual_mins' => (int) $row['total_actual_mins'],
            'log_count' => (int) $row['log_count'],
            'avg_mood_score' => $row['avg_mood_score'] !== null ? (float) $row['avg_mood_score'] : null,
            'avg_energy_score' => $row['avg_energy_score'] !== null ? (float) $row['avg_energy_score'] : null,
            'unread_emails' => $row['unread_emails'] !== null ? (int) $row['unread_emails'] : null,
            'calendar_events' => $row['calendar_events'] !== null ? (int) $row['calendar_events'] : null,
            'ai_plan_id' => $row['ai_plan_id'] !== null ? (int) $row['ai_plan_id'] : null,
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
        ];
    }
}
