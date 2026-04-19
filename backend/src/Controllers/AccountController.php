<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use PDO;

final class AccountController
{
    private const VALID_KINDS = ['checking', 'savings', 'cash', 'investment', 'other'];

    public function index(Request $request): void
    {
        unset($request);
        try {
            $db = Database::getInstance();
            $rows = $db->query(
                'SELECT id, name, kind, balance, sort_order, created_at, updated_at
                 FROM budget_accounts ORDER BY sort_order ASC, id ASC',
            )->fetchAll(PDO::FETCH_ASSOC);

            $items = array_map([$this, 'mapRow'], $rows);
            $total = 0.0;
            foreach ($items as $row) {
                $total += (float) $row['balance'];
            }

            Response::success([
                'items' => $items,
                'total' => round($total, 2),
            ]);
        } catch (\Throwable) {
            Response::error(
                'server_error',
                'Could not load accounts. If this is a new install, run database migrations (budget_accounts table).',
                500,
            );
        }
    }

    public function upsert(Request $request): void
    {
        $body = $request->getBody();
        $id = isset($body['id']) ? (int) $body['id'] : 0;
        $name = trim((string) ($body['name'] ?? ''));
        $kind = (string) ($body['kind'] ?? 'checking');
        $balance = (float) ($body['balance'] ?? 0);
        $sortOrder = (int) ($body['sort_order'] ?? 0);

        if ($name === '') {
            Response::error('validation_error', 'Name is required', 422, 'name');

            return;
        }
        if (!in_array($kind, self::VALID_KINDS, true)) {
            Response::error('validation_error', 'Invalid kind', 422, 'kind');

            return;
        }

        try {
            $db = Database::getInstance();
            if ($id > 0) {
                $db->prepare(
                    'UPDATE budget_accounts SET name = ?, kind = ?, balance = ?, sort_order = ?
                     WHERE id = ?',
                )->execute([$name, $kind, $balance, $sortOrder, $id]);
                if ($kind !== 'checking') {
                    $db->prepare(
                        'UPDATE budget_months SET current_balance_account_id = NULL WHERE current_balance_account_id = ?',
                    )->execute([$id]);
                }
            } else {
                $db->prepare(
                    'INSERT INTO budget_accounts (name, kind, balance, sort_order)
                     VALUES (?, ?, ?, ?)',
                )->execute([$name, $kind, $balance, $sortOrder]);
            }

            $this->index($request);
        } catch (\Throwable) {
            Response::error(
                'server_error',
                'Could not save account. Run database migrations if budget_accounts is missing.',
                500,
            );
        }
    }

    public function destroy(Request $request): void
    {
        $id = (int) ($request->routeParams['id'] ?? 0);
        if ($id < 1) {
            Response::error('validation_error', 'Invalid id', 422);

            return;
        }
        try {
            $db = Database::getInstance();
            $db->prepare('UPDATE budget_months SET current_balance_account_id = NULL WHERE current_balance_account_id = ?')->execute([$id]);
            $db->prepare('DELETE FROM budget_accounts WHERE id = ?')->execute([$id]);
            $this->index($request);
        } catch (\Throwable) {
            Response::error('server_error', 'Could not delete account', 500);
        }
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'kind' => (string) $row['kind'],
            'balance' => round((float) $row['balance'], 2),
            'sort_order' => (int) $row['sort_order'],
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
        ];
    }
}
