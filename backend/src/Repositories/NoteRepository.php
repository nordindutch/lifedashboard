<?php

declare(strict_types=1);

namespace Codex\Repositories;

use Codex\Core\Database;
use PDO;

final class NoteRepository
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
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function findPage(array $filters, int $page, int $perPage): array
    {
        $where = ['n.deleted_at IS NULL'];
        $params = [];

        if (array_key_exists('project_id', $filters) && $filters['project_id'] !== null) {
            $where[] = 'n.project_id = :project_id';
            $params['project_id'] = (int) $filters['project_id'];
        }
        if (array_key_exists('task_id', $filters) && $filters['task_id'] !== null) {
            $where[] = 'n.task_id = :task_id';
            $params['task_id'] = (int) $filters['task_id'];
        }
        if (array_key_exists('goal_id', $filters) && $filters['goal_id'] !== null) {
            $where[] = 'n.goal_id = :goal_id';
            $params['goal_id'] = (int) $filters['goal_id'];
        }
        if (array_key_exists('is_pinned', $filters) && $filters['is_pinned'] !== null) {
            $where[] = 'n.is_pinned = :is_pinned';
            $params['is_pinned'] = ((bool) $filters['is_pinned']) ? 1 : 0;
        }
        if (array_key_exists('search', $filters) && is_string($filters['search']) && trim($filters['search']) !== '') {
            $where[] = '(n.title LIKE :search OR n.body LIKE :search)';
            $params['search'] = '%' . trim((string) $filters['search']) . '%';
        }
        if (array_key_exists('label_id', $filters) && $filters['label_id'] !== null) {
            $where[] = 'EXISTS (
                SELECT 1
                FROM note_labels nl
                WHERE nl.note_id = n.id
                  AND nl.label_id = :label_id
            )';
            $params['label_id'] = (int) $filters['label_id'];
        }

        $whereSql = implode(' AND ', $where);
        $offset = ($page - 1) * $perPage;

        $countStmt = $this->db->prepare("SELECT COUNT(*) FROM notes n WHERE {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT n.*
                FROM notes n
                WHERE {$whereSql}
                ORDER BY n.is_pinned DESC, n.updated_at DESC
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
            $items[] = $this->mapNoteRow($row);
        }
        $this->attachLabels($items);

        return ['items' => $items, 'total' => $total];
    }

    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM notes WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }

        $note = $this->mapNoteRow($row);
        $items = [$note];
        $this->attachLabels($items);
        return $items[0] ?? null;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $stmt = $this->db->prepare(
            'INSERT INTO notes (project_id, task_id, goal_id, title, body, body_format, is_pinned)
             VALUES (:project_id, :task_id, :goal_id, :title, :body, :body_format, :is_pinned)',
        );
        $stmt->execute([
            'project_id' => $data['project_id'] ?? null,
            'task_id' => $data['task_id'] ?? null,
            'goal_id' => $data['goal_id'] ?? null,
            'title' => $data['title'] ?? null,
            'body' => isset($data['body']) ? (string) $data['body'] : '',
            'body_format' => isset($data['body_format']) ? (string) $data['body_format'] : 'html',
            'is_pinned' => !empty($data['is_pinned']) ? 1 : 0,
        ]);
        $id = (int) $this->db->lastInsertId();
        $created = $this->findById($id);
        if ($created === null) {
            throw new \RuntimeException('Failed to load note after create');
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

        $allowed = ['project_id', 'task_id', 'goal_id', 'title', 'body', 'body_format', 'is_pinned'];
        $set = [];
        $params = ['id' => $id];
        foreach ($allowed as $field) {
            if (!array_key_exists($field, $data)) {
                continue;
            }
            $set[] = "{$field} = :{$field}";
            if ($field === 'is_pinned') {
                $params[$field] = !empty($data[$field]) ? 1 : 0;
            } else {
                $params[$field] = $data[$field];
            }
        }
        if ($set === []) {
            return $this->findById($id);
        }

        $set[] = 'updated_at = unixepoch()';
        $sql = 'UPDATE notes SET ' . implode(', ', $set) . ' WHERE id = :id AND deleted_at IS NULL';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $this->findById($id);
    }

    /**
     * @param list<int> $labelIds
     */
    public function syncLabels(int $noteId, array $labelIds): void
    {
        $normalized = array_values(array_unique(array_map(static fn ($id): int => (int) $id, $labelIds)));

        $this->db->beginTransaction();
        try {
            $deleteStmt = $this->db->prepare('DELETE FROM note_labels WHERE note_id = ?');
            $deleteStmt->execute([$noteId]);

            if ($normalized !== []) {
                $insertStmt = $this->db->prepare('INSERT INTO note_labels (note_id, label_id) VALUES (?, ?)');
                foreach ($normalized as $labelId) {
                    if ($labelId < 1) {
                        continue;
                    }
                    $insertStmt->execute([$noteId, $labelId]);
                }
            }
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * @param list<string> $names
     * @return list<int>
     */
    public function upsertLabelsByName(array $names): array
    {
        $cleanNames = [];
        foreach ($names as $name) {
            $trimmed = trim($name);
            if ($trimmed !== '') {
                $cleanNames[] = $trimmed;
            }
        }
        $cleanNames = array_values(array_unique($cleanNames));
        if ($cleanNames === []) {
            return [];
        }

        $insertStmt = $this->db->prepare('INSERT OR IGNORE INTO labels (name, color) VALUES (:name, :color)');
        $selectStmt = $this->db->prepare('SELECT id FROM labels WHERE name = :name LIMIT 1');

        $ids = [];
        foreach ($cleanNames as $name) {
            $insertStmt->execute([
                'name' => $name,
                'color' => '#94a3b8',
            ]);
            $selectStmt->execute(['name' => $name]);
            $id = (int) $selectStmt->fetchColumn();
            if ($id > 0) {
                $ids[] = $id;
            }
        }
        return array_values(array_unique($ids));
    }

    public function softDelete(int $id): bool
    {
        $stmt = $this->db->prepare('UPDATE notes SET deleted_at = unixepoch(), updated_at = unixepoch() WHERE id = :id AND deleted_at IS NULL');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
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
            'title' => $row['title'] !== null ? (string) $row['title'] : null,
            'body' => (string) $row['body'],
            'body_format' => (string) $row['body_format'],
            'is_pinned' => ((int) $row['is_pinned']) === 1,
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
            'deleted_at' => $row['deleted_at'] !== null ? (int) $row['deleted_at'] : null,
            'labels' => [],
        ];
    }

    /**
     * @param list<array<string, mixed>> $items
     */
    private function attachLabels(array &$items): void
    {
        $noteIds = array_map(static fn (array $item): int => (int) $item['id'], $items);
        if ($noteIds === []) {
            return;
        }

        $placeholders = implode(',', array_fill(0, count($noteIds), '?'));
        $labelStmt = $this->db->prepare(
            "SELECT nl.note_id, l.id, l.name, l.color
             FROM note_labels nl
             JOIN labels l ON l.id = nl.label_id
             WHERE nl.note_id IN ({$placeholders})",
        );
        $labelStmt->execute($noteIds);
        /** @var list<array{note_id: int|string, id: int|string, name: string, color: string}> $labelRows */
        $labelRows = $labelStmt->fetchAll(PDO::FETCH_ASSOC);

        /** @var array<int, list<array<string, mixed>>> $labelsByNoteId */
        $labelsByNoteId = [];
        foreach ($labelRows as $row) {
            $noteId = (int) $row['note_id'];
            $labelsByNoteId[$noteId] ??= [];
            $labelsByNoteId[$noteId][] = [
                'id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'color' => (string) $row['color'],
            ];
        }

        foreach ($items as &$item) {
            $item['labels'] = $labelsByNoteId[(int) $item['id']] ?? [];
        }
        unset($item);
    }
}
