<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\CalorieRepository;

final class CalorieController
{
    public function __construct(private readonly CalorieRepository $repo)
    {
    }

    public function list(Request $request): void
    {
        $date = (string) ($request->getQueryString('date') ?? date('Y-m-d'));
        $logs = $this->repo->listForDate($date);
        $total = array_sum(array_column($logs, 'kcal_total'));
        Response::success(['logs' => $logs, 'total_kcal' => round($total, 1)]);
    }

    public function add(Request $request): void
    {
        $body = $request->getBody();
        $foodName = trim((string) ($body['food_name'] ?? ''));
        if ($foodName === '') {
            Response::error('validation_error', 'food_name is required', 422);
            return;
        }
        $amountG = (float) ($body['amount_g'] ?? 100);
        $kcalPer100g = (float) ($body['kcal_per_100g'] ?? 0);
        $kcalTotal = round($kcalPer100g * $amountG / 100, 1);

        $log = $this->repo->add([
            'log_date'      => (string) ($body['log_date'] ?? date('Y-m-d')),
            'food_name'     => $foodName,
            'food_brand'    => isset($body['food_brand']) ? (string) $body['food_brand'] : null,
            'amount_g'      => $amountG,
            'kcal_per_100g' => $kcalPer100g,
            'kcal_total'    => $kcalTotal,
        ]);
        Response::success($log, 201);
    }

    public function delete(Request $request): void
    {
        $id = (int) ($request->routeParams['id'] ?? 0);
        if ($id <= 0) {
            Response::error('not_found', 'Log entry not found', 404);
            return;
        }
        $deleted = $this->repo->delete($id);
        if (!$deleted) {
            Response::error('not_found', 'Log entry not found', 404);
            return;
        }
        Response::success(null);
    }

    public function search(Request $request): void
    {
        $q = trim((string) ($request->getQueryString('q') ?? ''));
        if (strlen($q) < 2) {
            Response::success([]);
            return;
        }

        Response::success($this->searchLocalOff($q));
    }

    /** @return list<array<string, mixed>> */
    private function searchLocalOff(string $q): array
    {
        $dbPath = dirname(__DIR__, 2) . '/data/openfoodfacts.sqlite';
        if (!is_readable($dbPath)) {
            return [];
        }

        try {
            $pdo = new \PDO('sqlite:' . $dbPath, null, null, [
                \PDO::ATTR_ERRMODE            => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            ]);
            $pdo->exec('PRAGMA query_only = ON');

            // Build an FTS5 match expression: each word gets a prefix wildcard
            $words = preg_split('/\s+/', $q, -1, PREG_SPLIT_NO_EMPTY);
            if ($words === false || $words === []) {
                return [];
            }
            $matchExpr = implode(' ', array_map(
                static fn (string $w): string => '"' . str_replace('"', '', $w) . '"*',
                $words,
            ));

            $stmt = $pdo->prepare(
                'SELECT p.product_name, p.brands, p.kcal_per_100g
                 FROM products_fts f
                 JOIN products p ON p.id = f.rowid
                 WHERE products_fts MATCH ?
                 ORDER BY rank
                 LIMIT 20',
            );
            $stmt->execute([$matchExpr]);
            $rows = $stmt->fetchAll();

            $out = [];
            foreach ($rows as $row) {
                $out[] = [
                    'product_name'  => (string) $row['product_name'],
                    'brands'        => (string) $row['brands'],
                    'kcal_per_100g' => (int) $row['kcal_per_100g'],
                ];
            }

            return $out;
        } catch (\Throwable) {
            return [];
        }
    }
}
