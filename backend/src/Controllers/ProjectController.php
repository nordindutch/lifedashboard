<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\ProjectRepository;

final class ProjectController
{
    private const ALLOWED_STATUS = ['active', 'completed', 'on_hold', 'archived'];
    private const ALLOWED_PRIORITY = [1, 2, 3, 4];

    public function __construct(private readonly ProjectRepository $projects)
    {
    }

    public function index(Request $request): void
    {
        $filters = [];
        if (($goalId = $request->getQueryString('goal_id')) !== null && $goalId !== '') {
            $filters['goal_id'] = (int) $goalId;
        }
        if (($status = $request->getQueryString('status')) !== null && $status !== '') {
            if (!in_array($status, self::ALLOWED_STATUS, true)) {
                Response::error('validation_error', 'Invalid status', 422, 'status');
                return;
            }
            $filters['status'] = $status;
        }

        $list = $this->projects->findAll($filters);
        Response::success($list);
    }

    public function show(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid project id', 422, 'id');
            return;
        }

        $bundle = $this->projects->findWithRelations($id);
        if ($bundle === null) {
            Response::error('not_found', 'Project not found', 404);
            return;
        }

        $payload = [
            ...$bundle['project'],
            'tasks' => $bundle['tasks'],
            'task_counts' => $bundle['task_counts'],
        ];
        Response::success($payload);
    }

    public function store(Request $request): void
    {
        $body = $request->getBody();
        $title = isset($body['title']) ? trim((string) $body['title']) : '';
        if ($title === '') {
            Response::error('validation_error', 'title is required', 422, 'title');
            return;
        }

        $status = isset($body['status']) ? (string) $body['status'] : 'active';
        if (!in_array($status, self::ALLOWED_STATUS, true)) {
            Response::error('validation_error', 'Invalid status', 422, 'status');
            return;
        }

        $priority = isset($body['priority']) ? (int) $body['priority'] : 2;
        if (!in_array($priority, self::ALLOWED_PRIORITY, true)) {
            Response::error('validation_error', 'Invalid priority', 422, 'priority');
            return;
        }

        $data = [
            'goal_id' => $this->optionalInt($body, 'goal_id'),
            'title' => $title,
            'description' => isset($body['description']) ? (is_string($body['description']) ? $body['description'] : null) : null,
            'color' => isset($body['color']) ? (string) $body['color'] : '#8b5cf6',
            'icon' => isset($body['icon']) ? (is_string($body['icon']) ? $body['icon'] : null) : null,
            'status' => $status,
            'priority' => $priority,
            'target_date' => $this->optionalInt($body, 'target_date'),
        ];

        $created = $this->projects->create($data);
        Response::success($created, 201);
    }

    public function update(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid project id', 422, 'id');
            return;
        }

        $body = $request->getBody();
        $data = [];

        if (array_key_exists('title', $body)) {
            $t = trim((string) $body['title']);
            if ($t === '') {
                Response::error('validation_error', 'title cannot be empty', 422, 'title');
                return;
            }
            $data['title'] = $t;
        }

        foreach (['description', 'color', 'icon'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = $body[$key] === null ? null : (string) $body[$key];
            }
        }

        if (array_key_exists('status', $body)) {
            $status = (string) $body['status'];
            if (!in_array($status, self::ALLOWED_STATUS, true)) {
                Response::error('validation_error', 'Invalid status', 422, 'status');
                return;
            }
            $data['status'] = $status;
        }

        if (array_key_exists('priority', $body)) {
            $priority = (int) $body['priority'];
            if (!in_array($priority, self::ALLOWED_PRIORITY, true)) {
                Response::error('validation_error', 'Invalid priority', 422, 'priority');
                return;
            }
            $data['priority'] = $priority;
        }

        foreach (['goal_id', 'target_date', 'completed_at'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = $body[$key] === null ? null : (int) $body[$key];
            }
        }

        $updated = $this->projects->update($id, $data);
        if ($updated === null) {
            Response::error('not_found', 'Project not found', 404);
            return;
        }

        Response::success($updated);
    }

    public function destroy(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid project id', 422, 'id');
            return;
        }

        $ok = $this->projects->softDelete($id);
        if (!$ok) {
            Response::error('not_found', 'Project not found', 404);
            return;
        }

        Response::success(['deleted' => true]);
    }

    /**
     * @param array<string, mixed> $body
     */
    private function optionalInt(array $body, string $key): ?int
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