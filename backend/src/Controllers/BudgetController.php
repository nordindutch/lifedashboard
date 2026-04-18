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

        $stmt = $db->prepare(
            'UPDATE budget_months
             SET current_balance = :current_balance,
                 minimum_balance = :minimum_balance,
                 notes = :notes,
                 updated_at = unixepoch()
             WHERE id = :id',
        );
        $stmt->execute([
            'id' => $monthId,
            'current_balance' => isset($body['current_balance']) ? (float) $body['current_balance'] : 0.0,
            'minimum_balance' => isset($body['minimum_balance']) ? (float) $body['minimum_balance'] : -2400.0,
            'notes' => array_key_exists('notes', $body) ? ($body['notes'] !== null ? (string) $body['notes'] : null) : null,
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

    public function listAccounts(Request $request): void
    {
        unset($request);
        $db = Database::getInstance();
        $rows = $db->query(
            'SELECT id, name, kind, balance, sort_order, created_at, updated_at
             FROM budget_accounts ORDER BY sort_order ASC, id ASC',
        )->fetchAll(PDO::FETCH_ASSOC);

        $items = array_map([$this, 'mapAccountRow'], $rows);
        $total = 0.0;
        foreach ($items as $row) {
            $total += (float) $row['balance'];
        }

        Response::success([
            'items' => $items,
            'total' => round($total, 2),
        ]);
    }

    public function upsertAccount(Request $request): void
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
        $validKinds = ['checking', 'savings', 'cash', 'investment', 'other'];
        if (!in_array($kind, $validKinds, true)) {
            Response::error('validation_error', 'Invalid kind', 422, 'kind');

            return;
        }

        $db = Database::getInstance();
        if ($id > 0) {
            $db->prepare(
                'UPDATE budget_accounts SET name = ?, kind = ?, balance = ?, sort_order = ?
                 WHERE id = ?',
            )->execute([$name, $kind, $balance, $sortOrder, $id]);
        } else {
            $db->prepare(
                'INSERT INTO budget_accounts (name, kind, balance, sort_order)
                 VALUES (?, ?, ?, ?)',
            )->execute([$name, $kind, $balance, $sortOrder]);
        }

        $this->listAccounts($request);
    }

    public function deleteAccount(Request $request): void
    {
        $id = (int) ($request->routeParams['id'] ?? 0);
        if ($id < 1) {
            Response::error('validation_error', 'Invalid id', 422);

            return;
        }
        Database::getInstance()->prepare('DELETE FROM budget_accounts WHERE id = ?')->execute([$id]);
        $this->listAccounts($request);
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private function mapAccountRow(array $row): array
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

    public function listDebts(Request $request): void
    {
        unset($request);
        $db = Database::getInstance();
        $rows = $db->query(
            'SELECT id, name, amount, deadline, paid, notes, sort_order, created_at, updated_at
             FROM budget_debts ORDER BY paid ASC, sort_order ASC, deadline ASC NULLS LAST, id ASC',
        )->fetchAll(PDO::FETCH_ASSOC);

        $items = array_map([$this, 'mapDebtRow'], $rows);
        $outstanding = 0.0;
        foreach ($items as $row) {
            if (!$row['paid']) {
                $outstanding += (float) $row['amount'];
            }
        }

        Response::success([
            'items' => $items,
            'outstanding' => round($outstanding, 2),
        ]);
    }

    public function upsertDebt(Request $request): void
    {
        $body = $request->getBody();
        $id = isset($body['id']) ? (int) $body['id'] : 0;
        $name = trim((string) ($body['name'] ?? ''));
        $amount = (float) ($body['amount'] ?? 0);
        $deadline = isset($body['deadline']) && $body['deadline'] !== null && $body['deadline'] !== ''
            ? (int) $body['deadline'] : null;
        $paid = !empty($body['paid']) ? 1 : 0;
        $notes = isset($body['notes']) ? (string) $body['notes'] : null;
        $sortOrder = (int) ($body['sort_order'] ?? 0);

        if ($name === '') {
            Response::error('validation_error', 'Name is required', 422, 'name');

            return;
        }

        $db = Database::getInstance();
        if ($id > 0) {
            $db->prepare(
                'UPDATE budget_debts SET name = ?, amount = ?, deadline = ?, paid = ?,
                 notes = ?, sort_order = ? WHERE id = ?',
            )->execute([$name, $amount, $deadline, $paid, $notes, $sortOrder, $id]);
        } else {
            $db->prepare(
                'INSERT INTO budget_debts (name, amount, deadline, paid, notes, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?)',
            )->execute([$name, $amount, $deadline, $paid, $notes, $sortOrder]);
        }

        $this->listDebts($request);
    }

    public function deleteDebt(Request $request): void
    {
        $id = (int) ($request->routeParams['id'] ?? 0);
        if ($id < 1) {
            Response::error('validation_error', 'Invalid id', 422);

            return;
        }
        Database::getInstance()->prepare('DELETE FROM budget_debts WHERE id = ?')->execute([$id]);
        $this->listDebts($request);
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private function mapDebtRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'amount' => round((float) $row['amount'], 2),
            'deadline' => $row['deadline'] !== null ? (int) $row['deadline'] : null,
            'paid' => ((int) $row['paid']) === 1,
            'notes' => $row['notes'] !== null ? (string) $row['notes'] : null,
            'sort_order' => (int) $row['sort_order'],
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
        ];
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
        $monthData = [
            'id' => (int) ($monthRow['id'] ?? 0),
            'month' => (string) ($monthRow['month'] ?? $month),
            'current_balance' => (float) ($monthRow['current_balance'] ?? 0),
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
                'projected_balance' => round(((float) $monthData['current_balance']) + $pendingIncome - $pendingExpenses, 2),
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
