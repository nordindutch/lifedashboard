<?php

declare(strict_types=1);

namespace Codex\Tests\Modules\Budget;

use Codex\Tests\Support\ApiTestCase;

final class DebtApiTest extends ApiTestCase
{
    public function testCreateDebtWithInterestReturnsMonthlyInterest(): void
    {
        $res = $this->call('POST', '/api/budget/debts', [
            'name' => 'Creditcard',
            'amount' => 800,
            'paid_amount' => 160,
            'deadline' => null,
            'paid' => false,
            'interest_rate_pct' => 14.9,
            'include_interest_in_budget' => true,
        ]);
        $data = $this->assertOk($res);
        $this->assertCount(1, $data['items']);
        $debt = $data['items'][0];
        $this->assertEquals(640.0, $debt['remaining']);
        $this->assertEquals(14.9, $debt['interest_rate_pct']);
        $this->assertTrue($debt['include_interest_in_budget']);
        $this->assertEquals(7.95, $debt['monthly_interest']);
        $this->assertEquals(640.0, $data['outstanding']);
        $this->assertEquals(7.95, $data['monthly_interest']);
    }

    public function testExistingDebtsDefaultToZeroInterest(): void
    {
        $this->db->exec("INSERT INTO budget_debts (name, amount, paid_amount) VALUES ('Oud', 100, 0)");
        $data = $this->assertOk($this->call('GET', '/api/budget/debts'));
        $this->assertEquals(0.0, $data['items'][0]['interest_rate_pct']);
        $this->assertFalse($data['items'][0]['include_interest_in_budget']);
        $this->assertEquals(0.0, $data['items'][0]['monthly_interest']);
    }

    public function testInterestRateIsValidated(): void
    {
        $res = $this->call('POST', '/api/budget/debts', ['name' => 'X', 'amount' => 100, 'interest_rate_pct' => 150]);
        $this->assertEquals(422, $res['status']);
        $this->assertEquals('interest_rate_pct', $res['json']['error']['field']);

        $res = $this->call('POST', '/api/budget/debts', ['name' => 'X', 'amount' => 100, 'interest_rate_pct' => 'abc']);
        $this->assertEquals(422, $res['status']);
    }

    public function testUpdateWithoutInterestFieldsKeepsExistingValues(): void
    {
        $created = $this->assertOk($this->call('POST', '/api/budget/debts', [
            'name' => 'Studie', 'amount' => 2000, 'interest_rate_pct' => 2.56, 'include_interest_in_budget' => true,
        ]));
        $id = $created['items'][0]['id'];
        $updated = $this->assertOk($this->call('POST', '/api/budget/debts', [
            'id' => $id, 'name' => 'Studieschuld', 'amount' => 2000, 'paid_amount' => 900, 'deadline' => null, 'paid' => false,
        ]));
        $debt = $updated['items'][0];
        $this->assertEquals('Studieschuld', $debt['name']);
        $this->assertEquals(2.56, $debt['interest_rate_pct']);
        $this->assertTrue($debt['include_interest_in_budget']);
        $this->assertEquals(2.35, $debt['monthly_interest']);
    }

    public function testRegisterPaymentIncrementsPaidAmountAndLogsHistory(): void
    {
        $created = $this->assertOk($this->call('POST', '/api/budget/debts', ['name' => 'CC', 'amount' => 800, 'paid_amount' => 160]));
        $id = $created['items'][0]['id'];

        $after = $this->assertOk($this->call('POST', "/api/budget/debts/{$id}/payments", ['amount' => 80, 'note' => 'oktober']));
        $this->assertEquals(240.0, $after['items'][0]['paid_amount']);
        $this->assertEquals(560.0, $after['items'][0]['remaining']);
        $this->assertFalse($after['items'][0]['paid']);

        $detail = $this->assertOk($this->call('GET', "/api/budget/debts/{$id}"));
        $this->assertCount(1, $detail['payments']);
        $this->assertEquals(80.0, $detail['payments'][0]['amount']);
        $this->assertEquals('oktober', $detail['payments'][0]['note']);
    }

    public function testPaymentIsCappedAndMarksDebtPaid(): void
    {
        $created = $this->assertOk($this->call('POST', '/api/budget/debts', ['name' => 'CC', 'amount' => 100, 'paid_amount' => 90]));
        $id = $created['items'][0]['id'];
        $after = $this->assertOk($this->call('POST', "/api/budget/debts/{$id}/payments", ['amount' => 500]));
        $debt = $after['items'][0];
        $this->assertTrue($debt['paid']);
        $this->assertEquals(100.0, $debt['paid_amount']);
        $this->assertEquals(0.0, $debt['remaining']);

        $again = $this->call('POST', "/api/budget/debts/{$id}/payments", ['amount' => 5]);
        $this->assertEquals(422, $again['status']);
    }

    public function testPaymentValidation(): void
    {
        $created = $this->assertOk($this->call('POST', '/api/budget/debts', ['name' => 'CC', 'amount' => 100]));
        $id = $created['items'][0]['id'];
        $this->assertEquals(422, $this->call('POST', "/api/budget/debts/{$id}/payments", ['amount' => 0])['status']);
        $this->assertEquals(422, $this->call('POST', "/api/budget/debts/{$id}/payments", [])['status']);
        $this->assertEquals(404, $this->call('POST', '/api/budget/debts/9999/payments', ['amount' => 10])['status']);
    }

    public function testDeleteRemovesPaymentsViaCascade(): void
    {
        $created = $this->assertOk($this->call('POST', '/api/budget/debts', ['name' => 'CC', 'amount' => 100]));
        $id = $created['items'][0]['id'];
        $this->assertOk($this->call('POST', "/api/budget/debts/{$id}/payments", ['amount' => 10]));
        $this->assertOk($this->call('DELETE', "/api/budget/debts/{$id}"));
        $count = (int) $this->db->query('SELECT COUNT(*) FROM budget_debt_payments')->fetchColumn();
        $this->assertEquals(0, $count);
    }
}
