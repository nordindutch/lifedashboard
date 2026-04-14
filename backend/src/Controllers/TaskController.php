<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\TaskRepository;

final class TaskController
{
    private const ALLOWED_STATUS = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
    private const ALLOWED_PRIORITY = [1, 2, 3, 4];

    public function __construct(private readonly TaskRepository $tasks)
    {
    }

    public function index(Request $request): void
    {
        $filters = [];
        if (($projectId = $request->getQueryString('project_id')) !== null && $projectId !== '') {
            $filters['project_id'] = (int) $projectId;
        }
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
        if (($dueBefore = $request->getQueryString('due_before')) !== null && $dueBefore !== '') {
            $filters['due_before'] = (int) $dueBefore;
        }
        if (($dueAfter = $request->getQueryString('due_after')) !== null && $dueAfter !== '') {
            $filters['due_after'] = (int) $dueAfter;
        }
        if (($page = $request->getQueryString('page')) !== null && $page !== '') {
            $filters['page'] = (int) $page;
        }
        if (($perPage = $request->getQueryString('per_page')) !== null && $perPage !== '') {
            $filters['per_page'] = (int) $perPage;
        }

        $result = $this->tasks->findAll($filters);
        Response::paginated($result['items'], [
            'total' => $result['total'],
            'page' => $result['page'],
            'per_page' => $result['per_page'],
        ]);
    }

    public function show(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid task id', 422, 'id');
            return;
        }

        $bundle = $this->tasks->findWithRelations($id);
        if ($bundle === null) {
            Response::error('not_found', 'Task not found', 404);
            return;
        }

        $payload = [
            ...$bundle['task'],
            'subtasks' => $bundle['subtasks'],
            'labels' => $bundle['labels'],
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

        $status = isset($body['status']) ? (string) $body['status'] : 'backlog';
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
            'project_id' => $this->optionalInt($body, 'project_id'),
            'goal_id' => $this->optionalInt($body, 'goal_id'),
            'parent_task_id' => $this->optionalInt($body, 'parent_task_id'),
            'title' => $title,
            'description' => array_key_exists('description', $body) ? ($body['description'] === null ? null : (string) $body['description']) : null,
            'status' => $status,
            'priority' => $priority,
            'estimated_mins' => $this->optionalInt($body, 'estimated_mins'),
            'due_date' => $this->optionalInt($body, 'due_date'),
        ];
        if (array_key_exists('display_order', $body) && $body['display_order'] !== null) {
            $data['display_order'] = (float) $body['display_order'];
        }

        $created = $this->tasks->create($data);
        Response::success($created, 201);
    }

    public function update(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid task id', 422, 'id');
            return;
        }
        $body = $request->getBody();

        $data = [];
        if (array_key_exists('title', $body)) {
            $title = trim((string) $body['title']);
            if ($title === '') {
                Response::error('validation_error', 'title cannot be empty', 422, 'title');
                return;
            }
            $data['title'] = $title;
        }
        foreach (['description', 'recurrence_rule'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = $body[$key] === null ? null : (string) $body[$key];
            }
        }
        foreach (['display_order'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = $body[$key] === null ? null : (float) $body[$key];
            }
        }
        foreach (['estimated_mins', 'actual_mins', 'due_date', 'completed_at', 'project_id', 'goal_id', 'parent_task_id'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = $body[$key] === null ? null : (int) $body[$key];
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

        $updated = $this->tasks->update($id, $data);
        if ($updated === null) {
            Response::error('not_found', 'Task not found', 404);
            return;
        }
        Response::success($updated);
    }

    public function reorder(Request $request): void
    {
        $body = $request->getBody();
        $rawMoves = $body['moves'] ?? null;
        if (!is_array($rawMoves)) {
            Response::error('validation_error', 'moves is required', 422, 'moves');
            return;
        }

        $moves = [];
        foreach ($rawMoves as $idx => $move) {
            if (!is_array($move)) {
                Response::error('validation_error', "Invalid move at index {$idx}", 422, 'moves');
                return;
            }
            $taskId = isset($move['task_id']) ? (int) $move['task_id'] : 0;
            $newStatus = isset($move['new_status']) ? (string) $move['new_status'] : '';
            $newDisplayOrder = isset($move['new_display_order']) ? (float) $move['new_display_order'] : null;
            if ($taskId < 1 || $newDisplayOrder === null || $newStatus === '') {
                Response::error('validation_error', "Invalid move at index {$idx}", 422, 'moves');
                return;
            }
            if (!in_array($newStatus, self::ALLOWED_STATUS, true)) {
                Response::error('validation_error', 'Invalid status', 422, 'new_status');
                return;
            }
            $moves[] = [
                'task_id' => $taskId,
                'new_status' => $newStatus,
                'new_display_order' => $newDisplayOrder,
            ];
        }

        $ok = $this->tasks->reorder($moves);
        if (!$ok) {
            Response::error('db_error', 'Failed to reorder tasks', 500);
            return;
        }
        Response::success(['ok' => true]);
    }

    public function patchCanvas(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid task id', 422, 'id');
            return;
        }
        $body = $request->getBody();

        $data = [];
        foreach (['canvas_x', 'canvas_y', 'canvas_width'] as $key) {
            if (array_key_exists($key, $body)) {
                $data[$key] = $body[$key] === null ? null : (float) $body[$key];
            }
        }
        if (array_key_exists('canvas_color', $body)) {
            $data['canvas_color'] = $body['canvas_color'] === null ? null : (string) $body['canvas_color'];
        }
        if (array_key_exists('canvas_pinned', $body)) {
            $data['canvas_pinned'] = (bool) $body['canvas_pinned'];
        }

        $updated = $this->tasks->updateCanvas($id, $data);
        if ($updated === null) {
            Response::error('not_found', 'Task not found', 404);
            return;
        }
        Response::success($updated);
    }

    public function destroy(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid task id', 422, 'id');
            return;
        }
        $ok = $this->tasks->softDelete($id);
        if (!$ok) {
            Response::error('not_found', 'Task not found', 404);
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
