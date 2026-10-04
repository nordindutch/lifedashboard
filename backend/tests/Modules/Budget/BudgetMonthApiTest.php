<?php

declare(strict_types=1);

namespace Codex\Tests\Modules\Budget;

use Codex\Tests\Support\ApiTestCase;

final class BudgetMonthApiTest extends ApiTestCase
{
    private function month(): string
    {
        return (new \DateTimeImmutable('first day of this month'))->format('Y-m');
    }

    public function testProjectionIsBalancePlusPendingIncomeMinusPendingExpenses(): void
    {
        $this->assertOk($this->call('PUT', '/api/budget/' . $this->month(), ['current_balance' => 1842.5, 'minimum_balance' => 500]));
        $this->assertOk($this->call('POST', '/api/budget/' . $this->month() . '/income', ['name' => 'Toeslagen', 'amount' => 450, 'received' => false]));
        $this->assertOk($this->call('POST', '/api/budget/' . $this->month() . '/income', ['name' => 'Salaris', 'amount' => 1610, 'received' => true]));
        $this->assertOk($this->call('POST', '/api/budget/' . $this->month() . '/expenses', ['name' => 'Huur', 'amount' => 725, 'category' => 'Vaste Last', 'paid' => false]));
        $data = $this->assertOk($this->call('POST', '/api/budget/' . $this->month() . '/expenses', ['name' => 'Energie', 'amount' => 96, 'category' => 'Vaste Last', 'paid' => true]));

        $summary = $data['summary'];
        $this->assertEquals(2060.0, $summary['total_income']);
        $this->assertEquals(821.0, $summary['total_expenses']);
        $this->assertEquals(450.0, $summary['pending_income']);
        $this->assertEquals(725.0, $summary['pending_expenses']);
        $this->assertEquals(1842.5 + 450 - 725, $summary['projected_balance']);
        $this->assertEquals([], $summary['interest_items']);
        $this->assertEquals(0.0, $summary['total_interest']);
    }

    public function testDebtInterestCountsAsPendingExpenseWhenEnabled(): void
    {
        $this->assertOk($this->call('PUT', '/api/budget/' . $this->month(), ['current_balance' => 1000]));
        $this->assertOk($this->call('POST', '/api/budget/debts', [
            'name' => 'Creditcard', 'amount' => 800, 'paid_amount' => 160, 'interest_rate_pct' => 14.9, 'include_interest_in_budget' => true,
        ]));
        $this->assertOk($this->call('POST', '/api/budget/debts', [
            'name' => 'Studie', 'amount' => 2000, 'paid_amount' => 900, 'interest_rate_pct' => 2.56, 'include_interest_in_budget' => false,
        ]));

        $summary = $this->assertOk($this->call('GET', '/api/budget/' . $this->month()))['summary'];
        $this->assertCount(1, $summary['interest_items']);
        $this->assertEquals('Creditcard', $summary['interest_items'][0]['name']);
        $this->assertEquals(7.95, $summary['interest_items'][0]['amount']);
        $this->assertEquals(7.95, $summary['total_interest']);
        $this->assertEquals(7.95, $summary['pending_expenses']);
        $this->assertEquals(1000 - 7.95, $summary['projected_balance']);
    }

    public function testInterestIsNotAddedToArchiveMonths(): void
    {
        $this->assertOk($this->call('POST', '/api/budget/debts', [
            'name' => 'CC', 'amount' => 100, 'interest_rate_pct' => 12, 'include_interest_in_budget' => true,
        ]));
        $this->assertEquals(0.0, $this->assertOk($this->call('GET', '/api/budget/2020-01'))['summary']['total_interest']);
        $future = (new \DateTimeImmutable('first day of next month'))->format('Y-m');
        $this->assertEquals(1.0, $this->assertOk($this->call('GET', "/api/budget/{$future}"))['summary']['total_interest']);
    }

    public function testPaidOffDebtNoLongerAddsInterest(): void
    {
        $created = $this->assertOk($this->call('POST', '/api/budget/debts', [
            'name' => 'CC', 'amount' => 100, 'interest_rate_pct' => 12, 'include_interest_in_budget' => true,
        ]));
        $id = $created['items'][0]['id'];
        $this->assertEquals(1.0, $this->assertOk($this->call('GET', '/api/budget/' . $this->month()))['summary']['total_interest']);
        $this->assertOk($this->call('POST', "/api/budget/debts/{$id}/payments", ['amount' => 100]));
        $this->assertEquals(0.0, $this->assertOk($this->call('GET', '/api/budget/' . $this->month()))['summary']['total_interest']);
    }

    public function testCopyPreviousOnlyFillsEmptyMonthAndResetsPaidFlags(): void
    {
        $this->assertOk($this->call('PUT', '/api/budget/2026-09', ['minimum_balance' => 500]));
        $this->assertOk($this->call('POST', '/api/budget/2026-09/expenses', ['name' => 'Huur', 'amount' => 725, 'category' => 'Vaste Last', 'paid' => true]));
        $data = $this->assertOk($this->call('POST', '/api/budget/' . $this->month() . '/copy-previous'));
        $this->assertCount(1, $data['expenses']);
        $this->assertFalse($data['expenses'][0]['paid']);
        $this->assertEquals(500.0, $data['month']['minimum_balance'], 'minimum van vorige maand wordt overgenomen');

        // Tweede keer kopiëren voegt niets toe
        $again = $this->assertOk($this->call('POST', '/api/budget/' . $this->month() . '/copy-previous'));
        $this->assertCount(1, $again['expenses']);
    }

    public function testInvalidMonthAndCategoryAreRejected(): void
    {
        $this->assertEquals(422, $this->call('GET', '/api/budget/2026-1')['status']);
        $res = $this->call('POST', '/api/budget/' . $this->month() . '/expenses', ['name' => 'X', 'amount' => 1, 'category' => 'Onbekend']);
        $this->assertEquals(422, $res['status']);
    }

    public function testHelloModuleRouteIsRegistered(): void
    {
        $data = $this->assertOk($this->call('GET', '/api/hello'));
        $this->assertArrayHasKey('message', $data);
    }
}
