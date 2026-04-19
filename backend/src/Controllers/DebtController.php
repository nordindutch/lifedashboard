<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use PDO;

final class DebtController
{
    public function index(Request $request): void
    {
        unset($request);
        try {
            $db = Database::getInstance();
            $rows = $db->query(
                'SELECT id, name, amount, paid_amount, deadline, paid, notes, sort_order, created_at, updated_at
                 FROM budget_debts
                 ORDER BY paid ASC, sort_order ASC, (deadline IS NULL) ASC, deadline ASC, id ASC',
            )->fetchAll(PDO::FETCH_ASSOC);

            $items = array_map([$this, 'mapRow'], $rows);
            $outstanding = 0.0;
            foreach ($items as $row) {
                if (!$row['paid']) {
                    $outstanding += (float) $row['remaining'];
                }
            }

            Response::success([
                'items' => $items,
                'outstanding' => round($outstanding, 2),
            ]);
        } catch (\Throwable) {
            Response::error(
                'server_error',
                'Could not load debts. If this is a new install, run database migrations (budget_debts table).',
                500,
            );
        }
    }

    public function upsert(Request $request): void
    {
        $body = $request->getBody();
        $id = isset($body['id']) ? (int) $body['id'] : 0;
        $name = trim((string) ($body['name'] ?? ''));
        $amount = (float) ($body['amount'] ?? 0);
        $deadline = isset($body['deadline']) && $body['deadline'] !== null && $body['deadline'] !== ''
            ? (int) $body['deadline'] : null;
        $paidAmount = isset($body['paid_amount']) ? (float) $body['paid_amount'] : 0.0;
        if ($paidAmount < 0.0) {
            $paidAmount = 0.0;
        }
        if ($paidAmount > $amount) {
            $paidAmount = $amount;
        }
        $paid = !empty($body['paid']) ? 1 : 0;
        if ($paid === 1 && $paidAmount < $amount) {
            $paidAmount = $amount;
        }
        if ($paidAmount >= $amount && $amount > 0.0) {
            $paid = 1;
            $paidAmount = $amount;
        }
        $notes = isset($body['notes']) ? (string) $body['notes'] : null;
        $sortOrder = (int) ($body['sort_order'] ?? 0);

        if ($name === '') {
            Response::error('validation_error', 'Name is required', 422, 'name');

            return;
        }

        try {
            $db = Database::getInstance();
            if ($id > 0) {
                $db->prepare(
                    'UPDATE budget_debts SET name = ?, amount = ?, paid_amount = ?, deadline = ?, paid = ?,
                     notes = ?, sort_order = ? WHERE id = ?',
                )->execute([$name, $amount, $paidAmount, $deadline, $paid, $notes, $sortOrder, $id]);
            } else {
                $db->prepare(
                    'INSERT INTO budget_debts (name, amount, paid_amount, deadline, paid, notes, sort_order)
                     VALUES (?, ?, ?, ?, ?, ?, ?)',
                )->execute([$name, $amount, $paidAmount, $deadline, $paid, $notes, $sortOrder]);
            }

            $this->index($request);
        } catch (\Throwable) {
            Response::error(
                'server_error',
                'Could not save debt. Run database migrations if budget_debts is missing.',
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
            $db->prepare('DELETE FROM budget_debts WHERE id = ?')->execute([$id]);
            $this->index($request);
        } catch (\Throwable) {
            Response::error('server_error', 'Could not delete debt', 500);
        }
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        $amount = round((float) $row['amount'], 2);
        $paidFlag = ((int) ($row['paid'] ?? 0)) === 1;
        if (array_key_exists('paid_amount', $row) && $row['paid_amount'] !== null) {
            $paidAmount = round((float) $row['paid_amount'], 2);
        } else {
            $paidAmount = $paidFlag ? $amount : 0.0;
        }
        if ($paidAmount > $amount) {
            $paidAmount = $amount;
        }
        if ($paidAmount < 0.0) {
            $paidAmount = 0.0;
        }
        $remaining = max(0.0, round($amount - $paidAmount, 2));

        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'amount' => $amount,
            'paid_amount' => $paidAmount,
            'remaining' => $remaining,
            'deadline' => $row['deadline'] !== null ? (int) $row['deadline'] : null,
            'paid' => $paidFlag,
            'notes' => $row['notes'] !== null ? (string) $row['notes'] : null,
            'sort_order' => (int) $row['sort_order'],
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
        ];
    }
}
