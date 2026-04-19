<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use PDO;

final class BudgetController
{
    private const CATEGORIES = [
        'Vaste Last',
        'Abonnement',
        'Tijdelijke Last',
        'Persoonlijk',
        'Politiek/Vakbond',
        'Overig',
    ];

    public function getMonth(Request $request): void
    {
        $month = $this->monthFromRequest($request);
        if ($month === null) {
            return;
        }

        Response::success($this->buildPayload($month));
    }

    public function updateMonth(Request $request): void
    {
        $month = $this->monthFromRequest($request);
        if ($month === null) {
            return;
        }
        $body = $request->getBody();
        $db = Database::getInstance();
        $monthId = $this->ensureMonth($db, $month);

        $load = $db->prepare('SELECT * FROM budget_months WHERE id = ? LIMIT 1');
        $load->execute([$monthId]);
        /** @var array<string, mixed>|false $existing */
        $existing = $load->fetch(PDO::FETCH_ASSOC);
        if ($existing === false) {
            Response::error('server_error', 'Month row missing', 500);

            return;
        }

        $minimumBalance = array_key_exists('minimum_balance', $body)
            ? (float) $body['minimum_balance']
            : (float) ($existing['minimum_balance'] ?? -2400.0);
        $notes = array_key_exists('notes', $body)
            ? ($body['notes'] !== null ? (string) $body['notes'] : null)
            : (isset($existing['notes']) && $existing['notes'] !== null ? (string) $existing['notes'] : null);

        $balanceAccountId = null;
        $currentBalance = (float) ($existing['current_balance'] ?? 0.0);

        if (array_key_exists('current_balance_account_id', $body)) {
            $raw = $body['current_balance_account_id'];
            if ($raw === null || $raw === '') {
                $balanceAccountId = null;
            } else {
                $aid = (int) $raw;
                if ($aid < 1) {
                    Response::error('validation_error', 'Invalid current_balance_account_id', 422, 'current_balance_account_id');

                    return;
                }
                $accStmt = $db->prepare('SELECT id, kind, balance FROM budget_accounts WHERE id = ? LIMIT 1');
                $accStmt->execute([$aid]);
                /** @var array<string, mixed>|false $acc */
                $acc = $accStmt->fetch(PDO::FETCH_ASSOC);
                if ($acc === false) {
                    Response::error('validation_error', 'Account not found', 422, 'current_balance_account_id');

                    return;
                }
                if (($acc['kind'] ?? '') !== 'checking') {
                    Response::error('validation_error', 'Alleen een betaalrekening kan gekoppeld worden', 422, 'current_balance_account_id');

                    return;
                }
                $balanceAccountId = $aid;
            }
        } else {
            $eid = $existing['current_balance_account_id'] ?? null;
            $balanceAccountId = $eid !== null && $eid !== '' ? (int) $eid : null;
        }

        if ($balanceAccountId !== null) {
            $accStmt = $db->prepare('SELECT balance FROM budget_accounts WHERE id = ? AND kind = ? LIMIT 1');
            $accStmt->execute([$balanceAccountId, 'checking']);
            /** @var array<string, mixed>|false $accRow */
            $accRow = $accStmt->fetch(PDO::FETCH_ASSOC);
            if ($accRow === false) {
                Response::error('validation_error', 'Betaalrekening niet gevonden', 422, 'current_balance_account_id');

                return;
            }
            $currentBalance = round((float) ($accRow['balance'] ?? 0), 2);
        } else {
            $currentBalance = array_key_exists('current_balance', $body)
                ? (float) $body['current_balance']
                : (float) ($existing['current_balance'] ?? 0.0);
        }

        $stmt = $db->prepare(
            'UPDATE budget_months
             SET current_balance = :current_balance,
                 minimum_balance = :minimum_balance,
                 notes = :notes,
                 current_balance_account_id = :current_balance_account_id,
                 updated_at = unixepoch()
             WHERE id = :id',
        );
        $stmt->execute([
            'id' => $monthId,
            'current_balance' => $currentBalance,
            'minimum_balance' => $minimumBalance,
            'notes' => $notes,
            'current_balance_account_id' => $balanceAccountId,
        ]);

        Response::success($this->buildPayload($month));
    }

    public function upsertIncome(Request $request): void
    {
        $month = $this->monthFromRequest($request);
        if ($month === null) {
            return;
        }
        $body = $request->getBody();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            Response::error('validation_error', 'name is required', 422, 'name');
            return;
        }

        $db = Database::getInstance();
        $monthId = $this->ensureMonth($db, $month);
        $id = isset($body['id']) ? (int) $body['id'] : 0;

        if ($id > 0) {
            $stmt = $db->prepare(
                'UPDATE budget_income
                 SET name = :name, amount = :amount, received = :received, sort_order = :sort_order, updated_at = unixepoch()
                 WHERE id = :id AND month_id = :month_id',
            );
            $stmt->execute([
                'id' => $id,
                'month_id' => $monthId,
                'name' => $name,
                'amount' => (float) ($body['amount'] ?? 0),
                'received' => !empty($body['received']) ? 1 : 0,
                'sort_order' => isset($body['sort_order']) ? (int) $body['sort_order'] : 0,
            ]);
        } else {
            $stmt = $db->prepare(
                'INSERT INTO budget_income (month_id, name, amount, received, sort_order, created_at, updated_at)
                 VALUES (:month_id, :name, :amount, :received, :sort_order, unixepoch(), unixepoch())',
            );
            $stmt->execute([
                'month_id' => $monthId,
                'name' => $name,
                'amount' => (float) ($body['amount'] ?? 0),
                'received' => !empty($body['received']) ? 1 : 0,
                'sort_order' => isset($body['sort_order']) ? (int) $body['sort_order'] : 0,
            ]);
        }

        Response::success($this->buildPayload($month));
    }

    public function upsertExpense(Request $request): void
    {
        $month = $this->monthFromRequest($request);
        if ($month === null) {
            return;
        }
        $body = $request->getBody();
        $name = trim((string) ($body['name'] ?? ''));
        if ($name === '') {
            Response::error('validation_error', 'name is required', 422, 'name');
            return;
        }
        $category = (string) ($body['category'] ?? 'Vaste Last');
        if (!in_array($category, self::CATEGORIES, true)) {
            Response::error('validation_error', 'Invalid category', 422, 'category');
            return;
        }

        $db = Database::getInstance();
        $monthId = $this->ensureMonth($db, $month);
        $id = isset($body['id']) ? (int) $body['id'] : 0;

        if ($id > 0) {
            $stmt = $db->prepare(
                'UPDATE budget_expenses
                 SET name = :name, amount = :amount, category = :category, paid = :paid, sort_order = :sort_order, updated_at = unixepoch()
                 WHERE id = :id AND month_id = :month_id',
            );
            $stmt->execute([
                'id' => $id,
                'month_id' => $monthId,
                'name' => $name,
                'amount' => (float) ($body['amount'] ?? 0),
                'category' => $category,
                'paid' => !empty($body['paid']) ? 1 : 0,
                'sort_order' => isset($body['sort_order']) ? (int) $body['sort_order'] : 0,
            ]);
        } else {
            $stmt = $db->prepare(
                'INSERT INTO budget_expenses (month_id, name, amount, category, paid, sort_order, created_at, updated_at)
                 VALUES (:month_id, :name, :amount, :category, :paid, :sort_order, unixepoch(), unixepoch())',
            );
            $stmt->execute([
                'month_id' => $monthId,
                'name' => $name,
                'amount' => (float) ($body['amount'] ?? 0),
                'category' => $category,
                'paid' => !empty($body['paid']) ? 1 : 0,
                'sort_order' => isset($body['sort_order']) ? (int) $body['sort_order'] : 0,
            ]);
        }

        Response::success($this->buildPayload($month));
    }

    public function deleteIncome(Request $request): void
    {
        $month = $this->monthFromRequest($request);
        if ($month === null) {
            return;
        }
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid income id', 422, 'id');
            return;
        }

        $db = Database::getInstance();
        $monthId = $this->ensureMonth($db, $month);
        $stmt = $db->prepare('DELETE FROM budget_income WHERE id = :id AND month_id = :month_id');
        $stmt->execute(['id' => $id, 'month_id' => $monthId]);

        Response::success($this->buildPayload($month));
    }

    public function deleteExpense(Request $request): void
    {
        $month = $this->monthFromRequest($request);
        if ($month === null) {
            return;
        }
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid expense id', 422, 'id');
            return;
        }

        $db = Database::getInstance();
        $monthId = $this->ensureMonth($db, $month);
        $stmt = $db->prepare('DELETE FROM budget_expenses WHERE id = :id AND month_id = :month_id');
        $stmt->execute(['id' => $id, 'month_id' => $monthId]);

        Response::success($this->buildPayload($month));
    }

    public function copyFromPrevious(Request $request): void
    {
        $month = $this->monthFromRequest($request);
        if ($month === null) {
            return;
        }

        $db = Database::getInstance();
        $monthId = $this->ensureMonth($db, $month);
        $countStmt = $db->prepare('SELECT (SELECT COUNT(*) FROM budget_income WHERE month_id = ?) + (SELECT COUNT(*) FROM budget_expenses WHERE month_id = ?)');
        $countStmt->execute([$monthId, $monthId]);
        $hasRows = (int) $countStmt->fetchColumn() > 0;
        if (!$hasRows) {
            $prevMonth = $this->previousMonth($month);
            $prevMonthId = $this->findMonthId($db, $prevMonth);
            if ($prevMonthId !== null) {
                $copyIncome = $db->prepare(
                    'INSERT INTO budget_income (month_id, name, amount, received, sort_order, created_at, updated_at)
                     SELECT :month_id, name, amount, 0, sort_order, unixepoch(), unixepoch()
                     FROM budget_income WHERE month_id = :prev_month_id
                     ORDER BY sort_order ASC, id ASC',
                );
                $copyIncome->execute(['month_id' => $monthId, 'prev_month_id' => $prevMonthId]);

                $copyExpense = $db->prepare(
                    'INSERT INTO budget_expenses (month_id, name, amount, category, paid, sort_order, created_at, updated_at)
                     SELECT :month_id, name, amount, category, 0, sort_order, unixepoch(), unixepoch()
                     FROM budget_expenses WHERE month_id = :prev_month_id
                     ORDER BY sort_order ASC, id ASC',
                );
                $copyExpense->execute(['month_id' => $monthId, 'prev_month_id' => $prevMonthId]);
            }
        }

        Response::success($this->buildPayload($month));
    }

    private function monthFromRequest(Request $request): ?string
    {
        $month = (string) ($request->routeParams['month'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            Response::error('validation_error', 'Invalid month format, expected YYYY-MM', 422, 'month');
            return null;
        }

        return $month;
    }

    private function ensureMonth(PDO $db, string $month): int
    {
        $existing = $this->findMonthId($db, $month);
        if ($existing !== null) {
            return $existing;
        }

        $stmt = $db->prepare(
            'INSERT INTO budget_months (month, current_balance, minimum_balance, notes, created_at, updated_at)
             VALUES (:month, 0, -2400, NULL, unixepoch(), unixepoch())',
        );
        $stmt->execute(['month' => $month]);

        return (int) $db->lastInsertId();
    }

    private function findMonthId(PDO $db, string $month): ?int
    {
        $stmt = $db->prepare('SELECT id FROM budget_months WHERE month = ? LIMIT 1');
        $stmt->execute([$month]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayload(string $month): array
    {
        $db = Database::getInstance();
        $monthId = $this->ensureMonth($db, $month);

        $monthStmt = $db->prepare('SELECT * FROM budget_months WHERE id = ? LIMIT 1');
        $monthStmt->execute([$monthId]);
        /** @var array<string, mixed> $monthRow */
        $monthRow = $monthStmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $cbaRaw = $monthRow['current_balance_account_id'] ?? null;
        $balanceAccountId = $cbaRaw !== null && $cbaRaw !== '' ? (int) $cbaRaw : null;
        $storedBalance = (float) ($monthRow['current_balance'] ?? 0);
        $effectiveBalance = $storedBalance;
        if ($balanceAccountId !== null) {
            $linkStmt = $db->prepare('SELECT balance, kind FROM budget_accounts WHERE id = ? LIMIT 1');
            $linkStmt->execute([$balanceAccountId]);
            /** @var array<string, mixed>|false $linkRow */
            $linkRow = $linkStmt->fetch(PDO::FETCH_ASSOC);
            if ($linkRow !== false && ($linkRow['kind'] ?? '') === 'checking') {
                $effectiveBalance = round((float) ($linkRow['balance'] ?? 0), 2);
            } else {
                $balanceAccountId = null;
            }
        }
        $monthData = [
            'id' => (int) ($monthRow['id'] ?? 0),
            'month' => (string) ($monthRow['month'] ?? $month),
            'current_balance' => $effectiveBalance,
            'current_balance_account_id' => $balanceAccountId,
            'minimum_balance' => (float) ($monthRow['minimum_balance'] ?? -2400),
            'notes' => isset($monthRow['notes']) ? ($monthRow['notes'] !== null ? (string) $monthRow['notes'] : null) : null,
            'created_at' => (int) ($monthRow['created_at'] ?? time()),
            'updated_at' => (int) ($monthRow['updated_at'] ?? time()),
        ];

        $incomeStmt = $db->prepare('SELECT * FROM budget_income WHERE month_id = ? ORDER BY sort_order ASC, id ASC');
        $incomeStmt->execute([$monthId]);
        /** @var list<array<string, mixed>> $incomeRows */
        $incomeRows = $incomeStmt->fetchAll(PDO::FETCH_ASSOC);
        $income = array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'month_id' => (int) $row['month_id'],
                'name' => (string) $row['name'],
                'amount' => (float) $row['amount'],
                'received' => ((int) $row['received']) === 1,
                'sort_order' => (int) $row['sort_order'],
            ];
        }, $incomeRows);

        $expenseStmt = $db->prepare('SELECT * FROM budget_expenses WHERE month_id = ? ORDER BY sort_order ASC, id ASC');
        $expenseStmt->execute([$monthId]);
        /** @var list<array<string, mixed>> $expenseRows */
        $expenseRows = $expenseStmt->fetchAll(PDO::FETCH_ASSOC);
        $expenses = array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'month_id' => (int) $row['month_id'],
                'name' => (string) $row['name'],
                'amount' => (float) $row['amount'],
                'category' => (string) $row['category'],
                'paid' => ((int) $row['paid']) === 1,
                'sort_order' => (int) $row['sort_order'],
            ];
        }, $expenseRows);

        $totalIncome = 0.0;
        $received = 0.0;
        $pendingIncome = 0.0;
        foreach ($income as $row) {
            $totalIncome += (float) $row['amount'];
            if (!empty($row['received'])) {
                $received += (float) $row['amount'];
            } else {
                $pendingIncome += (float) $row['amount'];
            }
        }

        $totalExpenses = 0.0;
        $paid = 0.0;
        $pendingExpenses = 0.0;
        foreach ($expenses as $row) {
            $totalExpenses += (float) $row['amount'];
            if (!empty($row['paid'])) {
                $paid += (float) $row['amount'];
            } else {
                $pendingExpenses += (float) $row['amount'];
            }
        }

        $byCategoryStmt = $db->prepare(
            'SELECT category, COALESCE(SUM(amount), 0) AS amount
             FROM budget_expenses
             WHERE month_id = ?
             GROUP BY category
             ORDER BY category ASC',
        );
        $byCategoryStmt->execute([$monthId]);
        /** @var list<array<string, mixed>> $catRows */
        $catRows = $byCategoryStmt->fetchAll(PDO::FETCH_ASSOC);
        $byCategory = array_map(static function (array $row): array {
            return [
                'category' => (string) $row['category'],
                'amount' => (float) $row['amount'],
            ];
        }, $catRows);

        return [
            'month' => $monthData,
            'income' => $income,
            'expenses' => $expenses,
            'summary' => [
                'total_income' => round($totalIncome, 2),
                'total_expenses' => round($totalExpenses, 2),
                'received' => round($received, 2),
                'paid' => round($paid, 2),
                'pending_income' => round($pendingIncome, 2),
                'pending_expenses' => round($pendingExpenses, 2),
                'projected_balance' => round($effectiveBalance + $pendingIncome - $pendingExpenses, 2),
                'by_category' => $byCategory,
            ],
        ];
    }

    private function previousMonth(string $month): string
    {
        $dt = \DateTimeImmutable::createFromFormat('Y-m', $month);
        if (!$dt instanceof \DateTimeImmutable) {
            return $month;
        }

        return $dt->modify('-1 month')->format('Y-m');
    }
}
