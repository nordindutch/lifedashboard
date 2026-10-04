<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Database;
use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Modules\Budget\DebtMath;
use PDO;

final class DebtController
{
    private const COLUMNS = 'id, name, amount, paid_amount, interest_rate_pct, include_interest_in_budget,
                 deadline, paid, notes, sort_order, created_at, updated_at';

    public function index(Request $request): void
    {
        unset($request);
        try {
            Response::success($this->buildListPayload(Database::getInstance()));
        } catch (\Throwable $e) {
            error_log('DebtController: ' . $e->getMessage());
            Response::error(
                'server_error',
                'Could not load debts. If this is a new install, run database migrations (budget_debts table).',
                500,
            );
        }
    }

    /** Eén schuld met de geregistreerde aflossingen. */
    public function show(Request $request): void
    {
        $id = (int) ($request->routeParams['id'] ?? 0);
        if ($id < 1) {
            Response::error('validation_error', 'Invalid id', 422);

            return;
        }
        try {
            $db = Database::getInstance();
            $row = $this->findRow($db, $id);
            if ($row === null) {
                Response::error('not_found', 'Schuld niet gevonden', 404);

                return;
            }
            $payments = $db->prepare(
                'SELECT id, debt_id, amount, note, paid_at, created_at FROM budget_debt_payments
                 WHERE debt_id = ? ORDER BY paid_at DESC, id DESC',
            );
            $payments->execute([$id]);
            $debt = $this->mapRow($row);
            $debt['payments'] = array_map(static fn (array $p): array => [
                'id' => (int) $p['id'],
                'debt_id' => (int) $p['debt_id'],
                'amount' => round((float) $p['amount'], 2),
                'note' => $p['note'] !== null ? (string) $p['note'] : null,
                'paid_at' => (int) $p['paid_at'],
                'created_at' => (int) $p['created_at'],
            ], $payments->fetchAll(PDO::FETCH_ASSOC));
            Response::success($debt);
        } catch (\Throwable $e) {
            error_log('DebtController::show: ' . $e->getMessage());
            Response::error('server_error', 'Could not load debt', 500);
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
        if ($amount < 0.0) {
            Response::error('validation_error', 'Bedrag kan niet negatief zijn', 422, 'amount');

            return;
        }

        $ratePct = null;
        if (array_key_exists('interest_rate_pct', $body) && $body['interest_rate_pct'] !== null && $body['interest_rate_pct'] !== '') {
            if (!is_numeric($body['interest_rate_pct'])) {
                Response::error('validation_error', 'Rente moet een getal zijn', 422, 'interest_rate_pct');

                return;
            }
            $ratePct = round((float) $body['interest_rate_pct'], 3);
            if ($ratePct < 0.0 || $ratePct > 100.0) {
                Response::error('validation_error', 'Rente moet tussen 0 en 100 procent liggen', 422, 'interest_rate_pct');

                return;
            }
        }
        $includeInterest = array_key_exists('include_interest_in_budget', $body)
            ? (!empty($body['include_interest_in_budget']) ? 1 : 0)
            : null;

        try {
            $db = Database::getInstance();
            if ($id > 0) {
                $existing = $this->findRow($db, $id);
                if ($existing === null) {
                    Response::error('not_found', 'Schuld niet gevonden', 404);

                    return;
                }
                $ratePct ??= (float) ($existing['interest_rate_pct'] ?? 0);
                $includeInterest ??= (int) ($existing['include_interest_in_budget'] ?? 0);
                $db->prepare(
                    'UPDATE budget_debts SET name = ?, amount = ?, paid_amount = ?, deadline = ?, paid = ?,
                     notes = ?, sort_order = ?, interest_rate_pct = ?, include_interest_in_budget = ? WHERE id = ?',
                )->execute([$name, $amount, $paidAmount, $deadline, $paid, $notes, $sortOrder, $ratePct, $includeInterest, $id]);
            } else {
                $db->prepare(
                    'INSERT INTO budget_debts (name, amount, paid_amount, deadline, paid, notes, sort_order,
                     interest_rate_pct, include_interest_in_budget)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                )->execute([$name, $amount, $paidAmount, $deadline, $paid, $notes, $sortOrder, $ratePct ?? 0.0, $includeInterest ?? 0]);
            }

            Response::success($this->buildListPayload($db));
        } catch (\Throwable $e) {
            error_log('DebtController::upsert: ' . $e->getMessage());
            Response::error(
                'server_error',
                'Could not save debt. Run database migrations if budget_debts is missing.',
                500,
            );
        }
    }

    /**
     * Aflossing registreren: POST /api/budget/debts/:id/payments { amount, note?, paid_at? }.
     * Verhoogt paid_amount (begrensd op het totaalbedrag) en slaat de betaling op in de historie.
     */
    public function registerPayment(Request $request): void
    {
        $id = (int) ($request->routeParams['id'] ?? 0);
        if ($id < 1) {
            Response::error('validation_error', 'Invalid id', 422);

            return;
        }
        $body = $request->getBody();
        if (!isset($body['amount']) || !is_numeric($body['amount'])) {
            Response::error('validation_error', 'Bedrag is verplicht', 422, 'amount');

            return;
        }
        $amount = round((float) $body['amount'], 2);
        if ($amount <= 0.0) {
            Response::error('validation_error', 'Bedrag moet groter zijn dan nul', 422, 'amount');

            return;
        }
        $note = isset($body['note']) && $body['note'] !== '' ? (string) $body['note'] : null;
        $paidAt = isset($body['paid_at']) && is_numeric($body['paid_at']) ? (int) $body['paid_at'] : time();

        try {
            $db = Database::getInstance();
            $row = $this->findRow($db, $id);
            if ($row === null) {
                Response::error('not_found', 'Schuld niet gevonden', 404);

                return;
            }
            $total = (float) $row['amount'];
            $current = (float) ($row['paid_amount'] ?? 0);
            $remaining = max(0.0, $total - $current);
            $applied = min($amount, $remaining);
            if ($applied <= 0.0) {
                Response::error('validation_error', 'Deze schuld is al volledig afgelost', 422, 'amount');

                return;
            }
            $newPaid = round($current + $applied, 2);
            $paidFlag = $newPaid >= $total - 0.005 ? 1 : 0;

            $db->beginTransaction();
            try {
                $db->prepare(
                    'INSERT INTO budget_debt_payments (debt_id, amount, note, paid_at) VALUES (?, ?, ?, ?)',
                )->execute([$id, $applied, $note, $paidAt]);
                $db->prepare('UPDATE budget_debts SET paid_amount = ?, paid = ? WHERE id = ?')
                    ->execute([$paidFlag === 1 ? $total : $newPaid, $paidFlag, $id]);
                $db->commit();
            } catch (\Throwable $e) {
                $db->rollBack();
                throw $e;
            }

            Response::success($this->buildListPayload($db));
        } catch (\Throwable $e) {
            error_log('DebtController::registerPayment: ' . $e->getMessage());
            Response::error('server_error', 'Could not register payment', 500);
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
            Response::success($this->buildListPayload($db));
        } catch (\Throwable $e) {
            error_log('DebtController: ' . $e->getMessage());
            Response::error('server_error', 'Could not delete debt', 500);
        }
    }

    /**
     * Openstaande schulden met rente die in het maandbudget meetellen.
     * Gebruikt door BudgetController voor de maandsamenvatting.
     *
     * @return list<array{debt_id: int, name: string, amount: float}>
     */
    public static function interestItemsForBudget(PDO $db): array
    {
        $stmt = $db->query(
            'SELECT id, name, amount, paid_amount, interest_rate_pct FROM budget_debts
             WHERE paid = 0 AND include_interest_in_budget = 1 AND interest_rate_pct > 0
             ORDER BY sort_order ASC, id ASC',
        );
        $out = [];
        foreach ($stmt !== false ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [] as $row) {
            $remaining = max(0.0, (float) $row['amount'] - (float) ($row['paid_amount'] ?? 0));
            $interest = DebtMath::monthlyInterest($remaining, (float) $row['interest_rate_pct']);
            if ($interest <= 0.0) {
                continue;
            }
            $out[] = [
                'debt_id' => (int) $row['id'],
                'name' => (string) $row['name'],
                'amount' => $interest,
            ];
        }

        return $out;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildListPayload(PDO $db): array
    {
        $rows = $db->query(
            'SELECT ' . self::COLUMNS . ' FROM budget_debts
             ORDER BY paid ASC, sort_order ASC, (deadline IS NULL) ASC, deadline ASC, id ASC',
        )->fetchAll(PDO::FETCH_ASSOC);

        $items = array_map([$this, 'mapRow'], $rows);
        $outstanding = 0.0;
        $monthlyInterest = 0.0;
        foreach ($items as $row) {
            if (!$row['paid']) {
                $outstanding += (float) $row['remaining'];
                $monthlyInterest += (float) $row['monthly_interest'];
            }
        }

        return [
            'items' => $items,
            'outstanding' => round($outstanding, 2),
            'monthly_interest' => round($monthlyInterest, 2),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findRow(PDO $db, int $id): ?array
    {
        $stmt = $db->prepare('SELECT ' . self::COLUMNS . ' FROM budget_debts WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
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
        $ratePct = round((float) ($row['interest_rate_pct'] ?? 0), 3);

        return [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'amount' => $amount,
            'paid_amount' => $paidAmount,
            'remaining' => $remaining,
            'interest_rate_pct' => $ratePct,
            'include_interest_in_budget' => ((int) ($row['include_interest_in_budget'] ?? 0)) === 1,
            'monthly_interest' => $paidFlag ? 0.0 : DebtMath::monthlyInterest($remaining, $ratePct),
            'deadline' => $row['deadline'] !== null ? (int) $row['deadline'] : null,
            'paid' => $paidFlag,
            'notes' => $row['notes'] !== null ? (string) $row['notes'] : null,
            'sort_order' => (int) $row['sort_order'],
            'created_at' => (int) $row['created_at'],
            'updated_at' => (int) $row['updated_at'],
        ];
    }
}
