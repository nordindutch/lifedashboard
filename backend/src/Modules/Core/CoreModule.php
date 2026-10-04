<?php

declare(strict_types=1);

namespace Codex\Modules\Core;

use Codex\Controllers\AiController;
use Codex\Controllers\AuthController;
use Codex\Controllers\BriefingController;
use Codex\Controllers\SettingsController;
use Codex\Core\AbstractModule;
use Codex\Core\Request;
use Codex\Core\Router;
use Codex\Repositories\AiPlanRepository;

/**
 * Kern: authenticatie, instellingen, briefing, AI-planning en Google-integraties.
 */
final class CoreModule extends AbstractModule
{
    public function id(): string
    {
        return 'core';
    }

    public function migrationsDir(): ?string
    {
        return $this->defaultMigrationsDir(__FILE__);
    }

    public function publicPaths(): array
    {
        return [
            '/api/auth/google/callback',
            '/api/auth/me',
            '/api/auth/logout',
            '/api/auth/login',
            '/api/auth/setup',
            '/api/auth/bootstrap',
        ];
    }

    public function registerRoutes(Router $router): void
    {
        $auth = new AuthController();
        $settings = new SettingsController();
        $briefing = new BriefingController();
        $ai = $this->lazy(static fn (): AiController => new AiController(AiPlanRepository::make()));

        $router->get('/api/auth/me', [$auth, 'me']);
        $router->get('/api/auth/bootstrap', [$auth, 'bootstrap']);
        $router->post('/api/auth/login', [$auth, 'login']);
        $router->post('/api/auth/setup', [$auth, 'setup']);
        $router->post('/api/auth/logout', [$auth, 'logout']);

        $router->get('/api/briefing', [$briefing, 'index']);
        $router->get('/api/evening-plan', [$briefing, 'eveningPlan']);
        $router->get('/api/ai/plan', static fn (Request $r) => $ai()->getPlan($r));
        $router->post('/api/ai/plan/generate', static fn (Request $r) => $ai()->generate($r));
        $router->get('/api/ai/history', static fn (Request $r) => $ai()->history($r));

        $router->get('/api/integrations/google/oauth-url', [$settings, 'googleIntegrationOAuthUrl']);
        $router->get('/api/auth/google/callback', [$settings, 'googleCallback']);
        $router->delete('/api/auth/google', [$settings, 'revokeGoogle']);
        $router->post('/api/calendar/sync', [$settings, 'syncCalendar']);
        $router->post('/api/calendar/events', [$settings, 'createCalendarEvent']);
        $router->delete('/api/calendar/events/:id', [$settings, 'deleteCalendarEvent']);
        $router->post('/api/gmail/sync', [$settings, 'syncGmail']);
        $router->get('/api/integrations/status', [$settings, 'integrationStatus']);
        $router->get('/api/settings/weather-test', [$settings, 'weatherTest']);
        $router->get('/api/settings', [$settings, 'index']);
        $router->put('/api/settings', [$settings, 'update']);
    }
}
