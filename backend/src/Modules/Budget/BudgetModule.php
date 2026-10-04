<?php

declare(strict_types=1);

namespace Codex\Modules\Budget;

use Codex\Controllers\AccountController;
use Codex\Controllers\BudgetController;
use Codex\Controllers\DebtController;
use Codex\Core\AbstractModule;
use Codex\Core\Router;

final class BudgetModule extends AbstractModule
{
    public function id(): string
    {
        return 'budget';
    }

    public function migrationsDir(): ?string
    {
        return $this->defaultMigrationsDir(__FILE__);
    }

    public function registerRoutes(Router $router): void
    {
        $budget = new BudgetController();
        $accounts = new AccountController();
        $debts = new DebtController();

        $router->get('/api/budget/accounts', [$accounts, 'index']);
        $router->post('/api/budget/accounts', [$accounts, 'upsert']);
        $router->delete('/api/budget/accounts/:id', [$accounts, 'destroy']);

        $router->get('/api/budget/debts', [$debts, 'index']);
        $router->post('/api/budget/debts', [$debts, 'upsert']);
        $router->get('/api/budget/debts/:id', [$debts, 'show']);
        $router->post('/api/budget/debts/:id/payments', [$debts, 'registerPayment']);
        $router->delete('/api/budget/debts/:id', [$debts, 'destroy']);

        $router->get('/api/budget/analytics', [$budget, 'analytics']);
        $router->get('/api/budget/insights', [$budget, 'insights']);

        $router->get('/api/budget/:month', [$budget, 'getMonth']);
        $router->put('/api/budget/:month', [$budget, 'updateMonth']);
        $router->post('/api/budget/:month/income', [$budget, 'upsertIncome']);
        $router->post('/api/budget/:month/expenses', [$budget, 'upsertExpense']);
        $router->delete('/api/budget/:month/income/:id', [$budget, 'deleteIncome']);
        $router->delete('/api/budget/:month/expenses/:id', [$budget, 'deleteExpense']);
        $router->post('/api/budget/:month/copy-previous', [$budget, 'copyFromPrevious']);
    }
}
