<?php

declare(strict_types=1);

namespace Codex\Repositories;

use Codex\Core\Database;
use PDO;

final class ProjectRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public static function make(): self
    {
        return new self(Database::getInstance());
    }

    /**
     * @param array<string, mixed> $filters
     * @return list<array<string, mixed>>
     */
    public function findAll(array $filters = []): array
    {
        $where = ['deleted_at IS NULL'];
        $params = [];

        if (array_key_exists('goal_id', $filters) && $filters['goal_id'] !== null) {
            $where[] = 'goal_id = :goal_id';
            $params['goal_id'] = (int) $filters['goal_id'];
        }
        if (array_key_exists('status', $filters) && $filters['status'] !== null && $filters['status'] !== '') {
            $where[] = 'status = :status';
            $params['status'] = (string) $filters['status'];
        }

        $whereSql = implode(' AND ', $where);
        $stmt = $this->db->prepare("SELECT * FROM projects WHERE {$whereSql} ORDER BY priority ASC, updated_at DESC");
        $stmt->execute($params);
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->mapProjectRow($row);
        }

        return $out;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM projects WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }

        return $this->mapProjectRow($row);
    }

    /**
     * @return array{project: array<string, mixed>, tasks: list<array<string, mixed>>, task_counts: array{total: int, completed: int, in_progress: int}}|null
     */
    public function findWithRelations(int $id): ?array
    {
        $project = $this->findById($id);
        if ($project === null) {
            return null;
        }

        $tasksStmt = $this->db->prepare(
            'SELECT * FROM tasks WHERE project_id = :project_id AND deleted_at IS NULL ORDER BY status ASC, display_order ASC, id ASC',
        );
        $tasksStmt->execute(['project_id' => $id]);
        /** @var list<array<string, mixed>> $taskRows */
        $taskRows = $tasksStmt->fetchAll(PDO::FETCH_ASSOC);

        $tasks = [];
        $completed = 0;
        $inProgress = 0;
        foreach ($taskRows as $row) {
            $tasks[] = $this->mapTaskRow($row, $project);
            $status = (string) $row['status'];
            if ($status === 'done') {
                $completed++;
            }
            if ($status === 'in_progress') {
                $inProgress++;
            }
        }

        return [
            'project' => $project,
            'tasks' => $tasks,
            'task_counts' => [
                'total' => count($tasks),
                'completed' => $completed,
                'in_progress' => $inProgress,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO projects
                 (goal_id, title, description, color, icon, status, priority, target_date, completed_at)
                 VALUES
                 (:goal_id, :title, :description, :color, :icon, :status, :priority, :target_date, :completed_at)',
            );
            $stmt->execute([
                'goal_id' => $data['goal_id'] ?? null,
                'title' => (string) $data['title'],
                'description' => $data['description'] ?? null,
                'color' => $data['color'] ?? '#8b5cf6',
                'icon' => $data['icon'] ?? null,
                'status' => $data['status'] ?? 'active',
                'priority' => isset($data['priority']) ? (int) $data['priority'] : 2,
                'target_date' => $data['target_date'] ?? null,
                'completed_at' => $data['completed_at'] ?? null,
            ]);
            $id = (int) $this->db->lastInsertId();
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        $created = $this->findById($id);
        if ($created === null) {
            throw new \RuntimeException('Failed to load project after insert');
        }

        return $created;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function update(int $id, array $data): ?array
    {
        if ($this->findById($id) === null) {
            return null;
        }

        if (array_key_exists('status', $data)) {
            $status = (string) $data['status'];
            if ($status === 'completed' && !array_key_exists('completed_at', $data)) {
                $data['completed_at'] = time();
            }
        }

        $allowed = [
            'goal_id',
            'title',
            'description',
            'color',
            'icon',
            'status',
            'priority',
            'target_date',
            'completed_at',
        ];

        $setParts = [];
        $params = ['id' => $id];
        foreach ($allowed as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $setParts[] = "{$field} = :{$field}";
            $params[$field] = $data[$field];
        }

        if ($setParts === []) {
            return $this->findById($id);
        }

        $setParts[] = 'updated_at = unixepoch()';
        $sql = 'UPDATE projects SET ' . implode(', ', $setParts) . ' WHERE id = :id AND deleted_at IS NULL';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $this->findById($id);
    }

    public function softDelete(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE projects SET deleted_at = unixepoch(), updated_at = unixepoch() WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute(['id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapProjectRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'goal_id' => $row['goal_id'] !== null ? (int) $row['goal_id'] : null,
            'title' => (string) $row['title'],
            'description' => $row['description'] !== null ? (string) $row['description'] : null,
            'color' => (string) ($row['color'] ?? '#8b5cf6'),
            'icon' => $row['icon'] !== null ? (string) $row['icon'] : null,
            'status' => (string) $row['status'],
            'priority' => (int) $row['priority'],
            'target_date' => $row['target_date'] !== null ? (int) $row['target_date'] : null,
            'completed_at' => $row['completed_at'] !== null ? (int) $row['completed_at'] : null,
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
            'deleted_at' => $row['deleted_at'] !== null ? (int) $row['deleted_at'] : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed> $project
     * @return array<string, mixed>
     */
    private function mapTaskRow(array $row, array $project): array
    {
        return [
            'id' => (int) $row['id'],
            'project_id' => $row['project_id'] !== null ? (int) $row['project_id'] : null,
            'goal_id' => $row['goal_id'] !== null ? (int) $row['goal_id'] : null,
            'parent_task_id' => $row['parent_task_id'] !== null ? (int) $row['parent_task_id'] : null,
            'title' => (string) $row['title'],
            'description' => $row['description'] !== null ? (string) $row['description'] : null,
            'status' => (string) $row['status'],
            'priority' => (int) $row['priority'],
            'display_order' => (float) $row['display_order'],
            'estimated_mins' => $row['estimated_mins'] !== null ? (int) $row['estimated_mins'] : null,
            'actual_mins' => $row['actual_mins'] !== null ? (int) $row['actual_mins'] : null,
            'due_date' => $row['due_date'] !== null ? (int) $row['due_date'] : null,
            'completed_at' => $row['completed_at'] !== null ? (int) $row['completed_at'] : null,
            'canvas_x' => $row['canvas_x'] !== null ? (float) $row['canvas_x'] : null,
            'canvas_y' => $row['canvas_y'] !== null ? (float) $row['canvas_y'] : null,
            'canvas_width' => $row['canvas_width'] !== null ? (float) $row['canvas_width'] : 240.0,
            'canvas_color' => (string) ($row['canvas_color'] ?? '#fef9c3'),
            'canvas_pinned' => ((int) ($row['canvas_pinned'] ?? 0)) === 1,
            'project_color' => (string) $project['color'],
            'project_title' => (string) $project['title'],
            'recurrence_rule' => $row['recurrence_rule'] !== null ? (string) $row['recurrence_rule'] : null,
            'recurrence_parent_id' => $row['recurrence_parent_id'] !== null ? (int) $row['recurrence_parent_id'] : null,
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
            'deleted_at' => $row['deleted_at'] !== null ? (int) $row['deleted_at'] : null,
        ];
    }
}