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

    private function sqliteTableExists(PDO $db, string $table): bool
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
            return false;
        }
        $stmt = $db->prepare('SELECT 1 FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1');
        $stmt->execute(['table', $table]);

        return $stmt->fetchColumn() !== false;
    }

    private function sqliteTableHasColumn(PDO $db, string $table, string $column): bool
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $table) || !preg_match('/^[a-zA-Z0-9_]+$/', $column)) {
            return false;
        }
        $stmt = $db->query('PRAGMA table_info(' . $table . ')');
        if ($stmt === false) {
            return false;
        }
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
            if (($col['name'] ?? '') === $column) {
                return true;
            }
        }

        return false;
    }

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

    public function listAccounts(Request $request): void
    {
        unset($request);
        try {
            $db = Database::getInstance();
            if (!$this->sqliteTableExists($db, 'budget_accounts')) {
                Response::success([
                    'items' => [],
                    'total' => 0.0,
                ]);

                return;
            }
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
        } catch (\Throwable) {
            Response::error(
                'server_error',
                'Could not load accounts. If this is a new install, run database migrations (budget_accounts table).',
                500,
            );
        }
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

            $this->listAccounts($request);
        } catch (\Throwable) {
            Response::error(
                'server_error',
                'Could not save account. Run database migrations if budget_accounts is missing.',
                500,
            );
        }
    }

    public function deleteAccount(Request $request): void
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
            $this->listAccounts($request);
        } catch (\Throwable) {
            Response::error('server_error', 'Could not delete account', 500);
        }
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
        try {
            $db = Database::getInstance();
            if (!$this->sqliteTableExists($db, 'budget_debts')) {
                Response::success([
                    'items' => [],
                    'outstanding' => 0.0,
                ]);

                return;
            }
            $hasPaidAmount = $this->sqliteTableHasColumn($db, 'budget_debts', 'paid_amount');
            $selectCols = 'id, name, amount';
            if ($hasPaidAmount) {
                $selectCols .= ', paid_amount';
            }
            $selectCols .= ', deadline, paid, notes, sort_order, created_at, updated_at';
            $sql = 'SELECT ' . $selectCols . '
                 FROM budget_debts
                 ORDER BY paid ASC, sort_order ASC, (deadline IS NULL) ASC, deadline ASC, id ASC';
            $rows = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);

            $items = array_map([$this, 'mapDebtRow'], $rows);
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

    public function upsertDebt(Request $request): void
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

            $this->listDebts($request);
        } catch (\Throwable) {
            Response::error(
                'server_error',
                'Could not save debt. Run database migrations if budget_debts is missing.',
                500,
            );
        }
    }

    public function deleteDebt(Request $request): void
    {
        $id = (int) ($request->routeParams['id'] ?? 0);
        if ($id < 1) {
            Response::error('validation_error', 'Invalid id', 422);

            return;
        }
        try {
            Database::getInstance()->prepare('DELETE FROM budget_debts WHERE id = ?')->execute([$id]);
            $this->listDebts($request);
        } catch (\Throwable) {
            Response::error('server_error', 'Could not delete debt', 500);
        }
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    private function mapDebtRow(array $row): array
    {
        $amount = round((float) $row['amount'], 2);
        $paidFlag = ((int) ($row['paid'] ?? 0)) === 1;
        if (array_key_exists('paid_amount', $row) && $row['paid_amount'] !== null) {
            $paidAmount = round((float) $row['paid_amount'], 2);
        } else {
            // Legacy rows before migration 006: derive from paid flag.
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
