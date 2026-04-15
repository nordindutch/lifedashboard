<?php

declare(strict_types=1);

namespace Codex\Repositories;

use Codex\Core\Database;
use PDO;

final class TaskRepository
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
     * @return array{items: list<array<string, mixed>>, total: int, page: int, per_page: int}
     */
    public function findAll(array $filters = []): array
    {
        $page = isset($filters['page']) ? max(1, (int) $filters['page']) : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 50;
        $perPage = max(1, min(200, $perPage));
        unset($filters['page'], $filters['per_page']);

        $where = ['t.deleted_at IS NULL'];
        $params = [];

        if (array_key_exists('project_id', $filters) && $filters['project_id'] !== null) {
            $where[] = 't.project_id = :project_id';
            $params['project_id'] = (int) $filters['project_id'];
        }
        if (array_key_exists('goal_id', $filters) && $filters['goal_id'] !== null) {
            $where[] = 't.goal_id = :goal_id';
            $params['goal_id'] = (int) $filters['goal_id'];
        }
        if (array_key_exists('status', $filters) && $filters['status'] !== null && $filters['status'] !== '') {
            $where[] = 't.status = :status';
            $params['status'] = (string) $filters['status'];
        }
        if (array_key_exists('due_before', $filters) && $filters['due_before'] !== null) {
            $where[] = 't.due_date IS NOT NULL AND t.due_date < :due_before';
            $params['due_before'] = (int) $filters['due_before'];
        }
        if (array_key_exists('due_after', $filters) && $filters['due_after'] !== null) {
            $where[] = 't.due_date IS NOT NULL AND t.due_date > :due_after';
            $params['due_after'] = (int) $filters['due_after'];
        }

        $whereSql = implode(' AND ', $where);
        $offset = ($page - 1) * $perPage;

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM tasks t WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT t.*, p.color AS project_color, p.title AS project_title
                FROM tasks t
                LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
                WHERE {$whereSql}
                ORDER BY t.status ASC, t.display_order ASC
                LIMIT :limit OFFSET :offset";
        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue(':' . $key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $items = [];
        foreach ($rows as $row) {
            $items[] = $this->mapTaskRow($row);
        }

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ];
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT t.*, p.color AS project_color, p.title AS project_title
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
             WHERE t.id = :id AND t.deleted_at IS NULL',
        );
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }

        return $this->mapTaskRow($row);
    }

    /**
     * @return array{task: array<string, mixed>, subtasks: list<array<string, mixed>>, labels: list<array<string, mixed>>, notes: list<array<string, mixed>>}|null
     */
    public function findWithRelations(int $id): ?array
    {
        $task = $this->findById($id);
        if ($task === null) {
            return null;
        }

        $subtasksStmt = $this->db->prepare(
            'SELECT t.*, p.color AS project_color, p.title AS project_title
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
             WHERE t.parent_task_id = :id AND t.deleted_at IS NULL
             ORDER BY t.display_order ASC',
        );
        $subtasksStmt->execute(['id' => $id]);
        /** @var list<array<string, mixed>> $subtaskRows */
        $subtaskRows = $subtasksStmt->fetchAll(PDO::FETCH_ASSOC);
        $subtasks = [];
        foreach ($subtaskRows as $row) {
            $subtasks[] = $this->mapTaskRow($row);
        }

        $labelsStmt = $this->db->prepare(
            'SELECT l.* FROM labels l
             JOIN task_labels tl ON tl.label_id = l.id
             WHERE tl.task_id = :id
             ORDER BY l.name ASC',
        );
        $labelsStmt->execute(['id' => $id]);
        /** @var list<array<string, mixed>> $labelRows */
        $labelRows = $labelsStmt->fetchAll(PDO::FETCH_ASSOC);
        $labels = [];
        foreach ($labelRows as $row) {
            $labels[] = [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'color' => (string) $row['color'],
            ];
        }

        $notesStmt = $this->db->prepare(
            'SELECT * FROM notes WHERE task_id = :id AND deleted_at IS NULL ORDER BY updated_at DESC',
        );
        $notesStmt->execute(['id' => $id]);
        /** @var list<array<string, mixed>> $noteRows */
        $noteRows = $notesStmt->fetchAll(PDO::FETCH_ASSOC);
        $notes = [];
        foreach ($noteRows as $row) {
            $notes[] = $this->mapNoteRow($row);
        }

        return [
            'task' => $task,
            'subtasks' => $subtasks,
            'labels' => $labels,
            'notes' => $notes,
        ];
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $status = isset($data['status']) ? (string) $data['status'] : 'backlog';
        $displayOrder = isset($data['display_order']) ? (float) $data['display_order'] : $this->nextDisplayOrderForStatus($status);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO tasks
                 (project_id, goal_id, parent_task_id, title, description, status, priority, display_order, estimated_mins, due_date)
                 VALUES
                 (:project_id, :goal_id, :parent_task_id, :title, :description, :status, :priority, :display_order, :estimated_mins, :due_date)',
            );
            $stmt->execute([
                'project_id' => $data['project_id'] ?? null,
                'goal_id' => $data['goal_id'] ?? null,
                'parent_task_id' => $data['parent_task_id'] ?? null,
                'title' => (string) $data['title'],
                'description' => $data['description'] ?? null,
                'status' => $status,
                'priority' => isset($data['priority']) ? (int) $data['priority'] : 2,
                'display_order' => $displayOrder,
                'estimated_mins' => $data['estimated_mins'] ?? null,
                'due_date' => $data['due_date'] ?? null,
            ]);
            $id = (int) $this->db->lastInsertId();
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }

        $created = $this->findById($id);
        if ($created === null) {
            throw new \RuntimeException('Failed to load task after insert');
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
        if ($data === []) {
            return $this->findById($id);
        }

        if (array_key_exists('status', $data)) {
            $status = (string) $data['status'];
            if ($status === 'done' && !array_key_exists('completed_at', $data)) {
                $data['completed_at'] = time();
            } elseif ($status !== 'done') {
                $data['completed_at'] = null;
            }
        }

        $allowed = [
            'title', 'description', 'status', 'priority', 'display_order',
            'estimated_mins', 'actual_mins', 'due_date', 'completed_at',
            'project_id', 'goal_id', 'parent_task_id', 'recurrence_rule',
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
        $sql = 'UPDATE tasks SET ' . implode(', ', $setParts) . ' WHERE id = :id AND deleted_at IS NULL';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $this->findById($id);
    }

    /**
     * @param list<array{task_id: int, new_status: string, new_display_order: float|int}> $moves
     */
    public function reorder(array $moves): bool
    {
        if ($moves === []) {
            return true;
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'UPDATE tasks
                 SET status = :status, display_order = :display_order, updated_at = unixepoch()
                 WHERE id = :id AND deleted_at IS NULL',
            );
            foreach ($moves as $move) {
                $stmt->execute([
                    'status' => (string) $move['new_status'],
                    'display_order' => (float) $move['new_display_order'],
                    'id' => (int) $move['task_id'],
                ]);
            }
            $this->db->commit();
            return true;
        } catch (\Throwable) {
            $this->db->rollBack();
            return false;
        }
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>|null
     */
    public function updateCanvas(int $id, array $data): ?array
    {
        if ($this->findById($id) === null) {
            return null;
        }
        $allowed = ['canvas_x', 'canvas_y', 'canvas_width', 'canvas_color', 'canvas_pinned'];
        $setParts = [];
        $params = ['id' => $id];
        foreach ($allowed as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $setParts[] = "{$field} = :{$field}";
            $params[$field] = $field === 'canvas_pinned' ? (!empty($data[$field]) ? 1 : 0) : $data[$field];
        }
        if ($setParts === []) {
            return $this->findById($id);
        }
        $setParts[] = 'updated_at = unixepoch()';
        $sql = 'UPDATE tasks SET ' . implode(', ', $setParts) . ' WHERE id = :id AND deleted_at IS NULL';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $this->findById($id);
    }

    public function softDelete(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE tasks SET deleted_at = unixepoch(), updated_at = unixepoch() WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute(['id' => $id]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Tasks due on the given calendar day (YYYY-MM-DD), excluding completed / cancelled.
     *
     * @return list<array<string, mixed>>
     */
    public function findDueOnDate(string $ymd, int $limit = 40): array
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ymd)) {
            return [];
        }
        $limit = max(1, min(100, $limit));
        $stmt = $this->db->prepare(
            'SELECT t.*, p.color AS project_color, p.title AS project_title
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
             WHERE t.deleted_at IS NULL
             AND t.completed_at IS NULL
             AND t.status NOT IN (\'done\', \'cancelled\')
             AND t.due_date IS NOT NULL
             AND date(t.due_date, \'unixepoch\') = ?
             ORDER BY t.priority DESC, t.due_date ASC, t.display_order ASC, t.id ASC
             LIMIT ?',
        );
        $stmt->execute([$ymd, $limit]);
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->mapTaskRow($row);
        }

        return $out;
    }

    /**
     * Tasks overdue by calendar day semantics: due date strictly before $ymd.
     * A task due on $ymd is not overdue until that day has fully ended.
     *
     * @return list<array<string, mixed>>
     */
    public function findOverdueBeforeDate(string $ymd, int $limit = 40): array
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $ymd)) {
            return [];
        }
        $limit = max(1, min(100, $limit));
        $stmt = $this->db->prepare(
            'SELECT t.*, p.color AS project_color, p.title AS project_title
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
             WHERE t.deleted_at IS NULL
             AND t.completed_at IS NULL
             AND t.status NOT IN (\'done\', \'cancelled\')
             AND t.due_date IS NOT NULL
             AND date(t.due_date, \'unixepoch\') < ?
             ORDER BY t.due_date ASC, t.priority DESC, t.display_order ASC, t.id ASC
             LIMIT ?',
        );
        $stmt->execute([$ymd, $limit]);
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->mapTaskRow($row);
        }

        return $out;
    }

    /**
     * Open tasks for overview / briefing: not done or cancelled, ordered for quick scanning.
     *
     * @return list<array<string, mixed>>
     */
    public function findOpenTasksForBriefing(int $limit = 40): array
    {
        $limit = max(1, min(100, $limit));
        $stmt = $this->db->prepare(
            'SELECT t.*, p.color AS project_color, p.title AS project_title
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id AND p.deleted_at IS NULL
             WHERE t.deleted_at IS NULL
             AND t.completed_at IS NULL
             AND t.status NOT IN (\'done\', \'cancelled\')
             ORDER BY
               CASE t.status
                 WHEN \'in_progress\' THEN 1
                 WHEN \'in_review\' THEN 2
                 WHEN \'todo\' THEN 3
                 WHEN \'backlog\' THEN 4
                 ELSE 5
               END,
               t.display_order ASC,
               t.id ASC
             LIMIT ?',
        );
        $stmt->execute([$limit]);
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $out = [];
        foreach ($rows as $row) {
            $out[] = $this->mapTaskRow($row);
        }

        return $out;
    }

    private function nextDisplayOrderForStatus(string $status): float
    {
        $stmt = $this->db->prepare('SELECT COALESCE(MAX(display_order), 0) + 1 FROM tasks WHERE status = :status AND deleted_at IS NULL');
        $stmt->execute(['status' => $status]);

        return (float) $stmt->fetchColumn();
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapTaskRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'project_id' => $row['project_id'] !== null ? (int) $row['project_id'] : null,
            'project_color' => isset($row['project_color']) && $row['project_color'] !== null ? (string) $row['project_color'] : null,
            'project_title' => isset($row['project_title']) && $row['project_title'] !== null ? (string) $row['project_title'] : null,
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
            'recurrence_rule' => $row['recurrence_rule'] !== null ? (string) $row['recurrence_rule'] : null,
            'recurrence_parent_id' => $row['recurrence_parent_id'] !== null ? (int) $row['recurrence_parent_id'] : null,
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
            'canvas_x' => $row['canvas_x'] !== null ? (float) $row['canvas_x'] : null,
            'canvas_y' => $row['canvas_y'] !== null ? (float) $row['canvas_y'] : null,
            'canvas_width' => $row['canvas_width'] !== null ? (float) $row['canvas_width'] : 240.0,
            'canvas_color' => (string) ($row['canvas_color'] ?? '#fef9c3'),
            'canvas_pinned' => ((int) ($row['canvas_pinned'] ?? 0)) === 1,
            'canvas_z_index' => (int) ($row['canvas_z_index'] ?? 0),
            'title' => $row['title'] !== null ? (string) $row['title'] : null,
            'body' => (string) $row['body'],
            'body_format' => (string) $row['body_format'],
            'is_pinned' => ((int) $row['is_pinned']) === 1,
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
            'deleted_at' => $row['deleted_at'] !== null ? (int) $row['deleted_at'] : null,
        ];
    }
}
