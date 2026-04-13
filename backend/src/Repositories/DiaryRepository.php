<?php

declare(strict_types=1);

namespace Codex\Repositories;

use Codex\Core\Database;
use PDO;

final class DiaryRepository
{
    private const ALLOWED_LOG_TYPES = ['activity', 'reflection', 'win', 'blocker', 'idea', 'mood'];

    public function __construct(private readonly PDO $db)
    {
    }

    public static function make(): self
    {
        return new self(Database::getInstance());
    }

    /**
     * @param array{date?: string, project_id?: int, task_id?: int, log_type?: string} $filters
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function findPage(array $filters, int $page, int $perPage): array
    {
        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage));
        $offset = ($page - 1) * $perPage;

        $where = ['deleted_at IS NULL'];
        $bind = [];

        if (!empty($filters['date']) && is_string($filters['date'])) {
            $d = $filters['date'];
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) {
                $start = strtotime($d . ' 00:00:00');
                $end = strtotime($d . ' 23:59:59');
                if ($start !== false && $end !== false) {
                    $where[] = 'logged_at >= ? AND logged_at <= ?';
                    $bind[] = $start;
                    $bind[] = $end;
                }
            }
        }
        if (isset($filters['project_id'])) {
            $where[] = 'project_id = ?';
            $bind[] = (int) $filters['project_id'];
        }
        if (isset($filters['task_id'])) {
            $where[] = 'task_id = ?';
            $bind[] = (int) $filters['task_id'];
        }
        if (!empty($filters['log_type']) && is_string($filters['log_type'])) {
            $lt = $filters['log_type'];
            if (in_array($lt, self::ALLOWED_LOG_TYPES, true)) {
                $where[] = 'log_type = ?';
                $bind[] = $lt;
            }
        }

        $whereSql = implode(' AND ', $where);

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM diary_logs WHERE {$whereSql}");
        $countStmt->execute($bind);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT * FROM diary_logs WHERE {$whereSql} ORDER BY logged_at DESC, id DESC LIMIT ? OFFSET ?";
        $listBind = $bind;
        $listBind[] = $perPage;
        $listBind[] = $offset;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($listBind);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = [];
        foreach ($rows as $row) {
            $items[] = $this->mapRow($row);
        }

        return ['items' => $items, 'total' => $total];
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM diary_logs WHERE id = ? AND deleted_at IS NULL');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }

        return $this->mapRow($row);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): array
    {
        $now = time();
        $loggedAt = isset($data['logged_at']) ? (int) $data['logged_at'] : $now;
        $stmt = $this->db->prepare(
            'INSERT INTO diary_logs (goal_id, project_id, task_id, log_type, body, mood_score, energy_score, duration_mins, logged_at, created_at, updated_at)
             VALUES (:goal_id, :project_id, :task_id, :log_type, :body, :mood_score, :energy_score, :duration_mins, :logged_at, :created_at, :updated_at)',
        );
        $stmt->execute([
            'goal_id' => $data['goal_id'] ?? null,
            'project_id' => $data['project_id'] ?? null,
            'task_id' => $data['task_id'] ?? null,
            'log_type' => $data['log_type'] ?? 'activity',
            'body' => $data['body'],
            'mood_score' => $data['mood_score'] ?? null,
            'energy_score' => $data['energy_score'] ?? null,
            'duration_mins' => $data['duration_mins'] ?? null,
            'logged_at' => $loggedAt,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $id = (int) $this->db->lastInsertId();
        $created = $this->findById($id);
        if ($created === null) {
            throw new \RuntimeException('Failed to load diary log after insert');
        }

        return $created;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(int $id, array $data): ?array
    {
        $existing = $this->findById($id);
        if ($existing === null) {
            return null;
        }
        $allowed = ['goal_id', 'project_id', 'task_id', 'log_type', 'body', 'mood_score', 'energy_score', 'duration_mins', 'logged_at'];
        $sets = [];
        $params = ['id' => $id];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $sets[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }
        if ($sets === []) {
            return $existing;
        }
        $sets[] = 'updated_at = :updated_at';
        $params['updated_at'] = time();
        $sql = 'UPDATE diary_logs SET ' . implode(', ', $sets) . ' WHERE id = :id AND deleted_at IS NULL';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        if ($stmt->rowCount() < 1) {
            return null;
        }

        return $this->findById($id);
    }

    public function softDelete(int $id): bool
    {
        $stmt = $this->db->prepare(
            'UPDATE diary_logs SET deleted_at = unixepoch(), updated_at = unixepoch() WHERE id = ? AND deleted_at IS NULL',
        );
        $stmt->execute([$id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'goal_id' => $row['goal_id'] !== null ? (int) $row['goal_id'] : null,
            'project_id' => $row['project_id'] !== null ? (int) $row['project_id'] : null,
            'task_id' => $row['task_id'] !== null ? (int) $row['task_id'] : null,
            'log_type' => (string) $row['log_type'],
            'body' => (string) $row['body'],
            'mood_score' => $row['mood_score'] !== null ? (int) $row['mood_score'] : null,
            'energy_score' => $row['energy_score'] !== null ? (int) $row['energy_score'] : null,
            'duration_mins' => $row['duration_mins'] !== null ? (int) $row['duration_mins'] : null,
            'logged_at' => (int) $row['logged_at'],
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
            'deleted_at' => $row['deleted_at'] !== null ? (int) $row['deleted_at'] : null,
        ];
    }

    public static function allowedLogTypes(): array
    {
        return self::ALLOWED_LOG_TYPES;
    }
}
