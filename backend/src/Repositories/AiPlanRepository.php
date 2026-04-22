<?php

declare(strict_types=1);

namespace Codex\Repositories;

use Codex\Core\Database;
use PDO;

final class AiPlanRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public static function make(): self
    {
        return new self(Database::getInstance());
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function save(array $data): array
    {
        $stmt = $this->db->prepare(
            'INSERT INTO ai_plans
             (plan_date, plan_type, tasks_snapshot, logs_snapshot, weather_context, calendar_context,
              prompt_tokens, completion_tokens, model_used, raw_response, parsed_schedule,
              reflection, suggested_tasks, score, created_at)
             VALUES
             (:plan_date, :plan_type, :tasks_snapshot, :logs_snapshot, :weather_context, :calendar_context,
              :prompt_tokens, :completion_tokens, :model_used, :raw_response, :parsed_schedule,
              :reflection, :suggested_tasks, :score, unixepoch())',
        );

        $stmt->execute([
            'plan_date' => (string) ($data['plan_date'] ?? date('Y-m-d')),
            'plan_type' => (string) ($data['plan_type'] ?? 'adhoc'),
            'tasks_snapshot' => json_encode($data['tasks_snapshot'] ?? [], JSON_UNESCAPED_UNICODE) ?: '[]',
            'logs_snapshot' => json_encode($data['logs_snapshot'] ?? [], JSON_UNESCAPED_UNICODE) ?: '[]',
            'weather_context' => $this->encodeNullableJson($data['weather_context'] ?? null),
            'calendar_context' => $this->encodeNullableJson($data['calendar_context'] ?? null),
            'prompt_tokens' => isset($data['prompt_tokens']) ? (int) $data['prompt_tokens'] : null,
            'completion_tokens' => isset($data['completion_tokens']) ? (int) $data['completion_tokens'] : null,
            'model_used' => (string) ($data['model_used'] ?? 'claude-sonnet-4-6'),
            'raw_response' => isset($data['raw_response']) ? (string) $data['raw_response'] : null,
            'parsed_schedule' => $this->encodeNullableJson($data['parsed_schedule'] ?? null),
            'reflection' => isset($data['reflection']) ? (string) $data['reflection'] : null,
            'suggested_tasks' => $this->encodeNullableJson($data['suggested_tasks'] ?? null),
            'score' => isset($data['score']) && $data['score'] !== null ? (int) $data['score'] : null,
        ]);

        $id = (int) $this->db->lastInsertId();
        $row = $this->findById($id);
        if ($row === null) {
            throw new \RuntimeException('Failed to load ai_plan after insert');
        }

        return $row;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findForDate(string $date, string $type): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM ai_plans WHERE plan_date = :plan_date AND plan_type = :plan_type ORDER BY created_at DESC, id DESC LIMIT 1',
        );
        $stmt->execute([
            'plan_date' => $date,
            'plan_type' => $type,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return $this->mapRow($row);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $id): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM ai_plans WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return $this->mapRow($row);
    }

    /**
     * @return array{items: list<array<string, mixed>>, total: int}
     */
    public function listRecent(int $page = 1, int $perPage = 20): array
    {
        $page = max(1, $page);
        $perPage = max(1, $perPage);
        $offset = ($page - 1) * $perPage;

        $countStmt = $this->db->query('SELECT COUNT(*) FROM ai_plans');
        $total = (int) ($countStmt->fetchColumn() ?: 0);

        $stmt = $this->db->prepare('SELECT * FROM ai_plans ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset');
        $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = [];
        foreach ($rows as $row) {
            $items[] = $this->mapRow($row);
        }

        return [
            'items' => $items,
            'total' => $total,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        $weatherRaw = isset($row['weather_context']) && is_string($row['weather_context']) ? $row['weather_context'] : null;
        $calendarRaw = isset($row['calendar_context']) && is_string($row['calendar_context']) ? $row['calendar_context'] : null;
        $parsedRaw = isset($row['parsed_schedule']) && is_string($row['parsed_schedule']) ? $row['parsed_schedule'] : null;
        $suggestedRaw = isset($row['suggested_tasks']) && is_string($row['suggested_tasks']) ? $row['suggested_tasks'] : null;

        return [
            'id' => (int) $row['id'],
            'plan_date' => (string) $row['plan_date'],
            'plan_type' => (string) $row['plan_type'],
            'tasks_snapshot' => json_decode((string) ($row['tasks_snapshot'] ?? '[]'), true) ?? [],
            'logs_snapshot' => json_decode((string) ($row['logs_snapshot'] ?? '[]'), true) ?? [],
            'weather_context' => $weatherRaw ? (json_decode($weatherRaw, true) ?: null) : null,
            'calendar_context' => $calendarRaw ? (json_decode($calendarRaw, true) ?: null) : null,
            'prompt_tokens' => $row['prompt_tokens'] !== null ? (int) $row['prompt_tokens'] : null,
            'completion_tokens' => $row['completion_tokens'] !== null ? (int) $row['completion_tokens'] : null,
            'model_used' => (string) ($row['model_used'] ?? 'claude-sonnet-4-6'),
            'raw_response' => $row['raw_response'] !== null ? (string) $row['raw_response'] : null,
            'parsed_schedule' => $parsedRaw ? (json_decode($parsedRaw, true) ?: null) : null,
            'reflection' => $row['reflection'] !== null ? (string) $row['reflection'] : null,
            'suggested_tasks' => $suggestedRaw ? (json_decode($suggestedRaw, true) ?: null) : null,
            'score' => $row['score'] !== null ? (int) $row['score'] : null,
            'created_at' => (int) $row['created_at'],
        ];
    }

    private function encodeNullableJson(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE);
        if (!is_string($encoded)) {
            return null;
        }

        return $encoded;
    }
}
