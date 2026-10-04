<?php

declare(strict_types=1);

namespace Codex\Tests\Modules\Budget;

use Codex\Modules\Budget\DebtMath;
use PHPUnit\Framework\TestCase;

final class DebtMathTest extends TestCase
{
    public function testMonthlyInterestIsBalanceTimesRateOverTwelve(): void
    {
        // 640 euro bij 14,9 procent: 640 x 0,149 / 12 = 7,95 (ontwerpscherm 5)
        $this->assertSame(7.95, DebtMath::monthlyInterest(640.0, 14.9));
        // 1100 euro bij 2,56 procent: 2,35 (ontwerpscherm 4)
        $this->assertSame(2.35, DebtMath::monthlyInterest(1100.0, 2.56));
    }

    public function testMonthlyInterestIsZeroWithoutRateOrBalance(): void
    {
        $this->assertSame(0.0, DebtMath::monthlyInterest(500.0, 0.0));
        $this->assertSame(0.0, DebtMath::monthlyInterest(0.0, 12.0));
        $this->assertSame(0.0, DebtMath::monthlyInterest(-10.0, 12.0));
    }

    public function testPayoffEstimateWithoutInterestIsSimpleDivision(): void
    {
        $est = DebtMath::payoffEstimate(800.0, 0.0, 80.0);
        $this->assertSame(10, $est['months']);
        $this->assertSame(0.0, $est['total_interest']);
        $this->assertTrue($est['pays_off']);
    }

    public function testPayoffEstimateWithInterestTakesLongerAndCostsInterest(): void
    {
        // 640 euro, 14,9 procent, 80 per maand: ongeveer 9 maanden en ongeveer 38 euro rente
        $est = DebtMath::payoffEstimate(640.0, 14.9, 80.0);
        $this->assertSame(9, $est['months']);
        $this->assertEqualsWithDelta(38.0, $est['total_interest'], 2.0);
        $this->assertTrue($est['pays_off']);
    }

    public function testPayoffEstimateNeverPaysOffWhenPaymentBelowInterest(): void
    {
        // 10.000 bij 12 procent = 100 rente per maand; 50 aflossen dekt dat niet
        $est = DebtMath::payoffEstimate(10000.0, 12.0, 50.0);
        $this->assertNull($est['months']);
        $this->assertFalse($est['pays_off']);
    }

    public function testPayoffEstimateHandlesEdgeCases(): void
    {
        $this->assertSame(0, DebtMath::payoffEstimate(0.0, 10.0, 50.0)['months']);
        $this->assertNull(DebtMath::payoffEstimate(100.0, 10.0, 0.0)['months']);
    }
}
