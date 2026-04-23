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

        $results = $this->searchOpenFoodFacts($q);
        if ($results === null || $results === []) {
            $results = $this->searchUsda($q);
        }
        Response::success($results ?? []);
    }

    /**
     * @return list<array<string, mixed>>|null  null means the request itself failed (caller should fall back)
     */
    private function searchOpenFoodFacts(string $q): ?array
    {
        $url = 'https://world.openfoodfacts.org/api/v2/search?' . http_build_query([
            'q'          => $q,
            'fields'     => 'product_name,brands,nutriments',
            'page_size'  => 15,
            'sort_by'    => 'unique_scans_n',
            'lc'         => 'nl',
        ]);

        $ctx = stream_context_create([
            'http' => [
                'method'        => 'GET',
                'timeout'       => 6,
                'ignore_errors' => true,
                'header'        => implode("\r\n", [
                    'User-Agent: LifeDashboard/1.0 (personal; +https://github.com/openfoodfacts/openfoodfacts-server)',
                    'Accept: application/json',
                ]),
            ],
        ]);

        $raw = @file_get_contents($url, false, $ctx);
        // Detect Cloudflare / maintenance page (non-JSON response)
        if (!is_string($raw) || trim($raw) === '' || !str_starts_with(trim($raw), '{')) {
            return null;
        }

        $json = json_decode($raw, true);
        if (!is_array($json) || !isset($json['products'])) {
            return null;
        }

        $out = [];
        foreach ((array) $json['products'] as $p) {
            if (!is_array($p)) {
                continue;
            }
            $name = trim((string) ($p['product_name'] ?? ''));
            if ($name === '') {
                continue;
            }
            $n = is_array($p['nutriments'] ?? null) ? $p['nutriments'] : [];
            $kcal = (float) ($n['energy-kcal_100g'] ?? $n['energy-kcal'] ?? 0);
            if ($kcal <= 0) {
                // Fall back to kJ field and convert (1 kcal = 4.184 kJ)
                $kj = (float) ($n['energy_100g'] ?? $n['energy'] ?? 0);
                if ($kj > 0) {
                    $kcal = $kj / 4.184;
                }
            }
            if ($kcal <= 0) {
                continue;
            }
            $out[] = [
                'product_name'  => $name,
                'brands'        => trim((string) ($p['brands'] ?? '')),
                'kcal_per_100g' => (int) round($kcal),
            ];
        }

        return $out;
    }

    /**
     * @return list<array<string, mixed>>|null
     */
    private function searchUsda(string $q): ?array
    {
        $url = 'https://api.nal.usda.gov/fdc/v1/foods/search?' . http_build_query([
            'query'    => $q,
            'pageSize' => 10,
            'api_key'  => 'DEMO_KEY',
            'dataType' => 'Foundation,SR Legacy,Branded',
        ]);

        $ctx = stream_context_create([
            'http' => [
                'method'        => 'GET',
                'timeout'       => 8,
                'ignore_errors' => true,
                'header'        => "Accept: application/json\r\n",
            ],
        ]);

        $raw = @file_get_contents($url, false, $ctx);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        $json = json_decode($raw, true);
        if (!is_array($json)) {
            return null;
        }

        $out = [];
        foreach ((array) ($json['foods'] ?? []) as $f) {
            if (!is_array($f)) {
                continue;
            }
            $name = trim((string) ($f['description'] ?? ''));
            if ($name === '') {
                continue;
            }
            $kcalPerServing = null;
            foreach ((array) ($f['foodNutrients'] ?? []) as $n) {
                if (is_array($n) && (int) ($n['nutrientId'] ?? 0) === 1008) {
                    $kcalPerServing = (float) ($n['value'] ?? 0);
                    break;
                }
            }
            if ($kcalPerServing === null || $kcalPerServing <= 0) {
                continue;
            }
            $servingG = isset($f['servingSize']) && strtolower((string) ($f['servingSizeUnit'] ?? '')) === 'g'
                ? (float) $f['servingSize'] : null;
            $kcal = ($servingG !== null && $servingG > 0)
                ? $kcalPerServing / $servingG * 100
                : $kcalPerServing;

            $out[] = [
                'product_name'  => $name,
                'brands'        => trim((string) ($f['brandOwner'] ?? $f['brandName'] ?? '')),
                'kcal_per_100g' => (int) round($kcal),
            ];
        }

        return $out;
    }
}
