<?php

declare(strict_types=1);

namespace Codex\Modules\Budget;

/**
 * Pure rekenlogica voor schulden. Dezelfde formules staan in
 * frontend/src/modules/budget/lib/budgetMath.ts; houd ze gelijk.
 */
final class DebtMath
{
    /** Maximale looptijd die we doorrekenen (50 jaar). */
    public const MAX_MONTHS = 600;

    /**
     * Rente van één maand over het openstaande saldo: saldo x percentage / 100 / 12.
     */
    public static function monthlyInterest(float $remaining, float $ratePct): float
    {
        if ($remaining <= 0.0 || $ratePct <= 0.0) {
            return 0.0;
        }

        return round($remaining * $ratePct / 100.0 / 12.0, 2);
    }

    /**
     * Schatting van looptijd en totale rente bij een vaste maandelijkse aflossing.
     * De rente wordt per maand bijgeschreven voordat de aflossing wordt afgetrokken.
     *
     * @return array{months: int|null, total_interest: float, pays_off: bool}
     *   months is null als de aflossing de rente niet dekt (schuld daalt nooit).
     */
    public static function payoffEstimate(float $remaining, float $ratePct, float $monthlyPayment): array
    {
        if ($remaining <= 0.0) {
            return ['months' => 0, 'total_interest' => 0.0, 'pays_off' => true];
        }
        if ($monthlyPayment <= 0.0) {
            return ['months' => null, 'total_interest' => 0.0, 'pays_off' => false];
        }

        $balance = $remaining;
        $totalInterest = 0.0;
        $months = 0;
        while ($balance > 0.005 && $months < self::MAX_MONTHS) {
            $interest = $balance * $ratePct / 100.0 / 12.0;
            $totalInterest += $interest;
            $balance = $balance + $interest - $monthlyPayment;
            $months++;
        }

        if ($balance > 0.005) {
            return ['months' => null, 'total_interest' => round($totalInterest, 2), 'pays_off' => false];
        }

        return ['months' => $months, 'total_interest' => round($totalInterest, 2), 'pays_off' => true];
    }
}
