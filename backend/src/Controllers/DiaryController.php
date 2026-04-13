<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\DiaryRepository;

final class DiaryController
{
    public function __construct(private readonly DiaryRepository $diary)
    {
    }

    public function index(Request $request): void
    {
        $q = $request->getQuery();
        $filters = [];
        if (isset($q['date']) && $q['date'] !== '') {
            $filters['date'] = (string) $q['date'];
        }
        if (isset($q['project_id']) && $q['project_id'] !== '') {
            $filters['project_id'] = (int) $q['project_id'];
        }
        if (isset($q['task_id']) && $q['task_id'] !== '') {
            $filters['task_id'] = (int) $q['task_id'];
        }
        if (isset($q['log_type']) && $q['log_type'] !== '') {
            $filters['log_type'] = (string) $q['log_type'];
        }

        $page = isset($q['page']) ? max(1, (int) $q['page']) : 1;
        $perPage = isset($q['per_page']) ? (int) $q['per_page'] : 50;
        if ($perPage < 1) {
            $perPage = 50;
        }
        if ($perPage > 100) {
            $perPage = 100;
        }

        $result = $this->diary->findPage($filters, $page, $perPage);
        Response::paginated($result['items'], [
            'total' => $result['total'],
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function store(Request $request): void
    {
        $body = $request->getBody();
        $text = isset($body['body']) ? trim((string) $body['body']) : '';
        if ($text === '') {
            Response::error('validation_error', 'body is required', 422, 'body');

            return;
        }
        $logType = isset($body['log_type']) ? (string) $body['log_type'] : 'activity';
        if (!in_array($logType, DiaryRepository::allowedLogTypes(), true)) {
            Response::error('validation_error', 'Invalid log_type', 422, 'log_type');

            return;
        }

        $data = [
            'body' => $text,
            'log_type' => $logType,
            'goal_id' => $this->optionalNullableInt($body, 'goal_id'),
            'project_id' => $this->optionalNullableInt($body, 'project_id'),
            'task_id' => $this->optionalNullableInt($body, 'task_id'),
            'mood_score' => $this->optionalNullableInt($body, 'mood_score'),
            'energy_score' => $this->optionalNullableInt($body, 'energy_score'),
            'duration_mins' => $this->optionalNullableInt($body, 'duration_mins'),
            'logged_at' => isset($body['logged_at']) ? (int) $body['logged_at'] : null,
        ];

        $created = $this->diary->create($data);
        Response::success($created, 201);
    }

    public function show(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid diary log id', 422, 'id');

            return;
        }
        $row = $this->diary->findById($id);
        if ($row === null) {
            Response::error('not_found', 'Diary log not found', 404);

            return;
        }
        Response::success($row);
    }

    public function update(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid diary log id', 422, 'id');

            return;
        }
        $body = $request->getBody();
        $data = [];
        if (array_key_exists('body', $body)) {
            $t = trim((string) $body['body']);
            if ($t === '') {
                Response::error('validation_error', 'body cannot be empty', 422, 'body');

                return;
            }
            $data['body'] = $t;
        }
        if (array_key_exists('log_type', $body)) {
            $lt = (string) $body['log_type'];
            if (!in_array($lt, DiaryRepository::allowedLogTypes(), true)) {
                Response::error('validation_error', 'Invalid log_type', 422, 'log_type');

                return;
            }
            $data['log_type'] = $lt;
        }
        foreach (['goal_id', 'project_id', 'task_id', 'mood_score', 'energy_score', 'duration_mins', 'logged_at'] as $k) {
            if (array_key_exists($k, $body)) {
                $data[$k] = $body[$k] === null ? null : (int) $body[$k];
            }
        }

        $updated = $this->diary->update($id, $data);
        if ($updated === null) {
            Response::error('not_found', 'Diary log not found', 404);

            return;
        }
        Response::success($updated);
    }

    public function destroy(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid diary log id', 422, 'id');

            return;
        }
        $ok = $this->diary->softDelete($id);
        if (!$ok) {
            Response::error('not_found', 'Diary log not found', 404);

            return;
        }
        Response::success(['deleted' => true]);
    }

    /**
     * @param array<string, mixed> $body
     */
    private function optionalNullableInt(array $body, string $key): ?int
    {
        if (!array_key_exists($key, $body)) {
            return null;
        }
        if ($body[$key] === null) {
            return null;
        }

        return (int) $body[$key];
    }
}
