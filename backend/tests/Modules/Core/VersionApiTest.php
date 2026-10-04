<?php

declare(strict_types=1);

namespace Codex\Tests\Modules\Core;

use Codex\Core\ModuleRegistry;
use Codex\Modules\Core\VersionController;
use Codex\Tests\Support\ApiTestCase;

final class VersionApiTest extends ApiTestCase
{
    public function testVersionEndpointIsPublicAndMatchesVersionFile(): void
    {
        $this->assertContains('/api/version', ModuleRegistry::publicPaths());
        $data = $this->assertOk($this->call('GET', '/api/version'));
        $expected = trim((string) file_get_contents(dirname(__DIR__, 3) . '/VERSION'));
        $this->assertSame($expected, $data['version']);
        $this->assertSame(VersionController::versionCode($expected), $data['android']['version_code']);
    }

    public function testVersionCodeFollowsSyncScriptFormula(): void
    {
        $this->assertSame(200, VersionController::versionCode('0.2.0'));
        $this->assertSame(10203, VersionController::versionCode('1.2.3'));
        $this->assertSame(0, VersionController::versionCode('abc'));
    }

    public function testHealthReportsDatabaseAndMigrations(): void
    {
        $this->assertContains('/api/health', ModuleRegistry::publicPaths());
        $data = $this->assertOk($this->call('GET', '/api/health'));
        $this->assertSame('ok', $data['status']);
        $this->assertTrue($data['database']);
        $this->assertGreaterThan(5, $data['migrations']);
    }
}
