<?php

declare(strict_types=1);

namespace Codex\Modules\Hello;

use Codex\Core\Request;
use Codex\Core\Response;

final class HelloController
{
    public function index(Request $request): void
    {
        unset($request);
        Response::success([
            'message' => 'Hallo vanuit de hello-module.',
            'server_time' => time(),
        ]);
    }
}
