<?php

declare(strict_types=1);

namespace Codex\Repositories;

use Codex\Core\Database;
use PDO;

final class GoalRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public static function make(): self
    {
        return new self(Database::getInstance());
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function findAll(): array
    {
        $stmt = $this->db->query(
            'SELECT * FROM goals WHERE deleted_at IS NULL ORDER BY updated_at DESC',
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->mapGoalRow($row);
        }
        return $out;
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM goals WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }
        return $this->mapGoalRow($row);
    }

    /**
     * @return array{goal: array<string, mixed>, projects: list<array<string, mixed>>, notes: list<array<string, mixed>>}|null
     */
    public function findWithRelations(int $id): ?array
    {
        $goal = $this->findById($id);
        if ($goal === null) {
            return null;
        }
        $projects = $this->findProjectsForGoal($id);
        $notes = $this->findNotesForGoal($id);
        return [
            'goal' => $goal,
            'projects' => $projects,
            'notes' => $notes,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): array
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO goals (title, description, color, icon, status, target_date, completed_at)
                 VALUES (:title, :description, :color, :icon, :status, :target_date, :completed_at)',
            );
            $stmt->execute([
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'color' => $data['color'] ?? '#6366f1',
                'icon' => $data['icon'] ?? null,
                'status' => $data['status'] ?? 'active',
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
            throw new \RuntimeException('Failed to load goal after insert');
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
        $this->db->beginTransaction();
        try {
            $fields = [
                'title', 'description', 'color', 'icon', 'status',
                'target_date', 'completed_at',
            ];
            $sets = [];
            $params = ['id' => $id];
            foreach ($fields as $field) {
                if (array_key_exists($field, $data)) {
                    $sets[] = "{$field} = :{$field}";
                    $params[$field] = $data[$field];
                }
            }
            if ($sets === []) {
                $this->db->commit();
                return $existing;
            }
            $sql = 'UPDATE goals SET ' . implode(', ', $sets) . ' WHERE id = :id AND deleted_at IS NULL';
            $stmt = $this->db->prepare($sql);
            $stmt->execute($params);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
        return $this->findById($id);
    }

    public function softDelete(int $id): bool
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE goals SET deleted_at = unixepoch() WHERE id = :id AND deleted_at IS NULL',
            );
            $stmt->execute(['id' => $id]);
            $ok = $stmt->rowCount() > 0;
            $this->db->commit();
            return $ok;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapGoalRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => (string) $row['title'],
            'description' => $row['description'] !== null ? (string) $row['description'] : null,
            'color' => (string) $row['color'],
            'icon' => $row['icon'] !== null ? (string) $row['icon'] : null,
            'status' => (string) $row['status'],
            'target_date' => $row['target_date'] !== null ? (int) $row['target_date'] : null,
            'completed_at' => $row['completed_at'] !== null ? (int) $row['completed_at'] : null,
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
            'deleted_at' => $row['deleted_at'] !== null ? (int) $row['deleted_at'] : null,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function findProjectsForGoal(int $goalId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM projects WHERE goal_id = :gid AND deleted_at IS NULL ORDER BY priority ASC, updated_at DESC',
        );
        $stmt->execute(['gid' => $goalId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->mapProjectRow($row);
        }
        return $out;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function findNotesForGoal(int $goalId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM notes WHERE goal_id = :gid AND deleted_at IS NULL ORDER BY updated_at DESC',
        );
        $stmt->execute(['gid' => $goalId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->mapNoteRow($row);
        }
        return $out;
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
            'color' => (string) $row['color'],
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
     * @return array<string, mixed>
     */
    private function mapNoteRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'goal_id' => $row['goal_id'] !== null ? (int) $row['goal_id'] : null,
            'project_id' => $row['project_id'] !== null ? (int) $row['project_id'] : null,
            'task_id' => $row['task_id'] !== null ? (int) $row['task_id'] : null,
            'canvas_x' => isset($row['canvas_x']) && $row['canvas_x'] !== null ? (float) $row['canvas_x'] : null,
            'canvas_y' => isset($row['canvas_y']) && $row['canvas_y'] !== null ? (float) $row['canvas_y'] : null,
            'canvas_width' => isset($row['canvas_width']) && $row['canvas_width'] !== null ? (float) $row['canvas_width'] : 240.0,
            'canvas_color' => isset($row['canvas_color']) ? (string) $row['canvas_color'] : '#fef9c3',
            'canvas_pinned' => isset($row['canvas_pinned']) ? ((int) $row['canvas_pinned'] === 1) : false,
            'canvas_z_index' => isset($row['canvas_z_index']) ? (int) $row['canvas_z_index'] : 0,
            'title' => $row['title'] !== null ? (string) $row['title'] : null,
            'body' => (string) $row['body'],
            'body_format' => (string) $row['body_format'],
            'is_pinned' => ((int) $row['is_pinned']) === 1,
            'labels' => [],
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
            'deleted_at' => $row['deleted_at'] !== null ? (int) $row['deleted_at'] : null,
        ];
    }
}
