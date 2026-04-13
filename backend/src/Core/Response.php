<?php

declare(strict_types=1);

namespace Codex\Core;

final class Response
{
    /**
     * @param array<string, mixed> $data
     */
    public static function json(mixed $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }

    public static function success(mixed $data, int $status = 200, ?array $meta = null): void
    {
        $payload = ['success' => true, 'data' => $data];
        if ($meta !== null) {
            $payload['meta'] = $meta;
        }
        self::json($payload, $status);
    }

    public static function error(string $code, string $message, int $status = 400, ?string $field = null): void
    {
        $err = [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ];
        if ($field !== null) {
            $err['error']['field'] = $field;
        }
        self::json($err, $status);
    }

    /**
     * @param array<int, mixed> $items
     * @param array{total?: int, page?: int, per_page?: int} $meta
     */
    public static function paginated(array $items, array $meta, int $status = 200): void
    {
        self::success($items, $status, $meta);
    }
}
