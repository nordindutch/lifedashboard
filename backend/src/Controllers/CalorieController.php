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

        $local = $this->searchLocalOff($q);
        // null = no local DB / read error. [] = no FTS hits — still fall back to the API in both cases.
        if ($local !== null && $local !== []) {
            $results = $local;
        } else {
            $results = $this->searchOffApi($q) ?? [];
        }
        Response::success($results);
    }

    /**
     * @return list<array<string, mixed>>|null  null = local DB not available, caller should fall back
     */
    private function searchLocalOff(string $q): ?array
    {
        $dbPath = dirname(__DIR__, 2) . '/data/openfoodfacts.sqlite';
        if (!is_readable($dbPath)) {
            return null;
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
            return null;
        }
    }

    /** @return list<array<string, mixed>>|null  null = request failed */
    private function searchOffApi(string $q): ?array
    {
        // API v2 `q` + `lc` on world.openfoodfacts.org often returns the same off-topic
        // "popular" list for every query. Legacy search.pl with search_terms is reliable.
        $url = 'https://world.openfoodfacts.org/cgi/search.pl?' . http_build_query([
            'action'         => 'process',
            'search_terms'   => $q,
            'search_simple'  => '1',
            'json'           => '1',
            'page_size'      => '24',
            'sort_by'        => 'unique_scans_n',
        ]);

        $ctx = stream_context_create(['http' => [
            'method'        => 'GET',
            'timeout'       => 12,
            'ignore_errors' => true,
            'header'        => implode("\r\n", [
                'User-Agent: LifeDashboard/1.0 (self-hosted; Open Food Facts import)',
                'Accept: application/json',
            ]),
        ]]);

        $raw = $this->httpGet($url, $ctx);
        if (!is_string($raw) || !str_starts_with(ltrim($raw), '{')) {
            return null;
        }

        $json = json_decode($raw, true);
        if (!is_array($json) || !isset($json['products'])) {
            return null;
        }

        $out = [];
        foreach ((array) $json['products'] as $p) {
            if (!is_array($p)) continue;
            $name = trim((string) ($p['product_name'] ?? ''));
            if ($name === '') continue;
            $n    = is_array($p['nutriments'] ?? null) ? $p['nutriments'] : [];
            $kcal = (float) ($n['energy-kcal_100g'] ?? $n['energy-kcal'] ?? 0);
            if ($kcal <= 0) {
                $kj = (float) ($n['energy_100g'] ?? $n['energy'] ?? 0);
                if ($kj > 0) {
                    $kcal = $kj / 4.184;
                }
            }
            if ($kcal <= 0) {
                $kj100 = (float) ($n['energy-kj_100g'] ?? $n['energy-kj'] ?? 0);
                if ($kj100 > 0) {
                    $kcal = $kj100 / 4.184;
                }
            }
            if ($kcal <= 0) continue;
            $out[] = [
                'product_name'  => $name,
                'brands'        => trim((string) ($p['brands'] ?? '')),
                'kcal_per_100g' => (int) round($kcal),
            ];
        }

        return $out;
    }

    private function httpGet(string $url, $streamContext): ?string
    {
        $raw = @file_get_contents($url, false, $streamContext);
        if (is_string($raw) && $raw !== '') {
            return $raw;
        }
        if (!function_exists('curl_init')) {
            return null;
        }
        $ch = curl_init($url);
        if ($ch === false) {
            return null;
        }
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_HTTPHEADER     => [
                'User-Agent: LifeDashboard/1.0 (self-hosted; Open Food Facts import)',
                'Accept: application/json',
            ],
        ]);
        $out = curl_exec($ch);
        curl_close($ch);
        return is_string($out) && $out !== '' ? $out : null;
    }
}
