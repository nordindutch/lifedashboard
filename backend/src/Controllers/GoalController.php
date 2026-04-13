<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\GoalRepository;

final class GoalController
{
    private const ALLOWED_STATUS = ['active', 'completed', 'paused', 'archived'];

    public function __construct(private readonly GoalRepository $goals)
    {
    }

    public function index(Request $request): void
    {
        unset($request);
        $list = $this->goals->findAll();
        Response::success($list);
    }

    public function show(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid goal id', 422, 'id');
            return;
        }
        $bundle = $this->goals->findWithRelations($id);
        if ($bundle === null) {
            Response::error('not_found', 'Goal not found', 404);
            return;
        }
        $payload = [
            ...$bundle['goal'],
            'projects' => $bundle['projects'],
            'notes' => $bundle['notes'],
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
        $data = [
            'title' => $title,
            'description' => isset($body['description']) ? (is_string($body['description']) ? $body['description'] : null) : null,
            'color' => isset($body['color']) ? (string) $body['color'] : '#6366f1',
            'icon' => isset($body['icon']) ? (is_string($body['icon']) ? $body['icon'] : null) : null,
            'status' => $status,
            'target_date' => $this->optionalInt($body, 'target_date'),
            'completed_at' => $this->optionalInt($body, 'completed_at'),
        ];
        $created = $this->goals->create($data);
        Response::success($created, 201);
    }

    public function update(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid goal id', 422, 'id');
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
            $st = (string) $body['status'];
            if (!in_array($st, self::ALLOWED_STATUS, true)) {
                Response::error('validation_error', 'Invalid status', 422, 'status');
                return;
            }
            $data['status'] = $st;
        }
        if (array_key_exists('target_date', $body)) {
            $data['target_date'] = $body['target_date'] === null ? null : (int) $body['target_date'];
        }
        if (array_key_exists('completed_at', $body)) {
            $data['completed_at'] = $body['completed_at'] === null ? null : (int) $body['completed_at'];
        }
        $updated = $this->goals->update($id, $data);
        if ($updated === null) {
            Response::error('not_found', 'Goal not found', 404);
            return;
        }
        Response::success($updated);
    }

    public function destroy(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid goal id', 422, 'id');
            return;
        }
        $ok = $this->goals->softDelete($id);
        if (!$ok) {
            Response::error('not_found', 'Goal not found', 404);
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
