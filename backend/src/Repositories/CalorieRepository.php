<?php

declare(strict_types=1);

namespace Codex\Repositories;

use Codex\Core\Database;
use PDO;

final class CalorieRepository
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
    public function listForDate(string $date): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM calorie_logs WHERE log_date = :date ORDER BY created_at ASC',
        );
        $stmt->execute(['date' => $date]);
        /** @var list<array<string, mixed>> $rows */
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        return array_map($this->mapRow(...), $rows);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function add(array $data): array
    {
        $stmt = $this->db->prepare(
            'INSERT INTO calorie_logs (log_date, food_name, food_brand, amount_g, kcal_per_100g, kcal_total)
             VALUES (:log_date, :food_name, :food_brand, :amount_g, :kcal_per_100g, :kcal_total)',
        );
        $stmt->execute([
            'log_date'      => (string) ($data['log_date'] ?? date('Y-m-d')),
            'food_name'     => (string) ($data['food_name'] ?? ''),
            'food_brand'    => isset($data['food_brand']) && $data['food_brand'] !== '' ? (string) $data['food_brand'] : null,
            'amount_g'      => (float) ($data['amount_g'] ?? 100),
            'kcal_per_100g' => (float) ($data['kcal_per_100g'] ?? 0),
            'kcal_total'    => (float) ($data['kcal_total'] ?? 0),
        ]);
        $id = (int) $this->db->lastInsertId();
        $stmt2 = $this->db->prepare('SELECT * FROM calorie_logs WHERE id = :id LIMIT 1');
        $stmt2->execute(['id' => $id]);
        /** @var array<string, mixed> $row */
        $row = $stmt2->fetch(PDO::FETCH_ASSOC);
        return $this->mapRow($row);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare('DELETE FROM calorie_logs WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->rowCount() > 0;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        return [
            'id'            => (int) $row['id'],
            'log_date'      => (string) $row['log_date'],
            'food_name'     => (string) $row['food_name'],
            'food_brand'    => $row['food_brand'] !== null ? (string) $row['food_brand'] : null,
            'amount_g'      => (float) $row['amount_g'],
            'kcal_per_100g' => (float) $row['kcal_per_100g'],
            'kcal_total'    => (float) $row['kcal_total'],
            'created_at'    => (int) $row['created_at'],
        ];
    }
}
