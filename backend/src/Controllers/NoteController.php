<?php

declare(strict_types=1);

namespace Codex\Controllers;

use Codex\Core\Request;
use Codex\Core\Response;
use Codex\Repositories\NoteRepository;

final class NoteController
{
    private const ALLOWED_FORMATS = ['html', 'markdown', 'plain'];

    public function __construct(private readonly NoteRepository $notes)
    {
    }

    public function index(Request $request): void
    {
        $filters = [];
        foreach (['project_id', 'task_id', 'goal_id', 'label_id'] as $intKey) {
            $value = $request->getQueryString($intKey);
            if ($value !== null && $value !== '') {
                $filters[$intKey] = (int) $value;
            }
        }

        $search = $request->getQueryString('search');
        if ($search !== null && trim($search) !== '') {
            $filters['search'] = trim($search);
        }
        $isPinned = $request->getQueryString('is_pinned');
        if ($isPinned !== null && $isPinned !== '') {
            $filters['is_pinned'] = in_array(strtolower($isPinned), ['1', 'true', 'yes'], true);
        }

        $page = max(1, (int) ($request->getQueryString('page') ?? '1'));
        $perPage = (int) ($request->getQueryString('per_page') ?? '30');
        $perPage = max(1, min(200, $perPage));

        $result = $this->notes->findPage($filters, $page, $perPage);
        Response::success([
            'items' => $result['items'],
            'total' => $result['total'],
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    public function show(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid note id', 422, 'id');
            return;
        }

        $note = $this->notes->findById($id);
        if ($note === null) {
            Response::error('not_found', 'Note not found', 404);
            return;
        }
        Response::success($note);
    }

    public function store(Request $request): void
    {
        $body = $request->getBody();
        $noteData = $this->extractNoteData($body, false);
        if ($noteData === null) {
            return;
        }

        $created = $this->notes->create($noteData);
        $hasLabelFields = array_key_exists('label_ids', $body) || array_key_exists('label_names', $body);
        $labelIds = $this->resolveLabelIds($body);
        if ($hasLabelFields && $labelIds === null) {
            return;
        }
        if ($labelIds !== null) {
            $this->notes->syncLabels((int) $created['id'], $labelIds);
            $created = $this->notes->findById((int) $created['id']) ?? $created;
        }

        Response::success($created, 201);
    }

    public function update(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid note id', 422, 'id');
            return;
        }

        $body = $request->getBody();
        $noteData = $this->extractNoteData($body, true);
        if ($noteData === null) {
            return;
        }

        $updated = $this->notes->update($id, $noteData);
        if ($updated === null) {
            Response::error('not_found', 'Note not found', 404);
            return;
        }

        $shouldSyncLabels = array_key_exists('label_ids', $body) || array_key_exists('label_names', $body);
        if ($shouldSyncLabels) {
            $labelIds = $this->resolveLabelIds($body);
            if ($labelIds === null) {
                return;
            }
            $this->notes->syncLabels($id, $labelIds);
            $updated = $this->notes->findById($id) ?? $updated;
        }

        Response::success($updated);
    }

    public function destroy(Request $request): void
    {
        $id = isset($request->routeParams['id']) ? (int) $request->routeParams['id'] : 0;
        if ($id < 1) {
            Response::error('validation_error', 'Invalid note id', 422, 'id');
            return;
        }
        $ok = $this->notes->softDelete($id);
        if (!$ok) {
            Response::error('not_found', 'Note not found', 404);
            return;
        }
        Response::success(['deleted' => true]);
    }

    /**
     * @param array<string, mixed> $body
     * @return array<string, mixed>|null
     */
    private function extractNoteData(array $body, bool $partial): ?array
    {
        $data = [];

        foreach (['project_id', 'task_id', 'goal_id'] as $intKey) {
            if (array_key_exists($intKey, $body)) {
                $data[$intKey] = $body[$intKey] === null ? null : (int) $body[$intKey];
            }
        }

        if (array_key_exists('title', $body)) {
            $data['title'] = $body['title'] === null ? null : trim((string) $body['title']);
        } elseif (!$partial) {
            $data['title'] = null;
        }

        if (array_key_exists('body', $body)) {
            $data['body'] = (string) $body['body'];
        } elseif (!$partial) {
            $data['body'] = '';
        }

        if (array_key_exists('body_format', $body)) {
            $format = (string) $body['body_format'];
            if (!in_array($format, self::ALLOWED_FORMATS, true)) {
                Response::error('validation_error', 'Invalid body_format', 422, 'body_format');
                return null;
            }
            $data['body_format'] = $format;
        } elseif (!$partial) {
            $data['body_format'] = 'html';
        }

        if (array_key_exists('is_pinned', $body)) {
            $data['is_pinned'] = (bool) $body['is_pinned'];
        } elseif (!$partial) {
            $data['is_pinned'] = false;
        }

        return $data;
    }

    /**
     * @param array<string, mixed> $body
     * @return list<int>|null
     */
    private function resolveLabelIds(array $body): ?array
    {
        $labelIds = null;

        if (array_key_exists('label_ids', $body)) {
            if (!is_array($body['label_ids'])) {
                Response::error('validation_error', 'label_ids must be an array', 422, 'label_ids');
                return null;
            }
            $labelIds = [];
            foreach ($body['label_ids'] as $labelId) {
                $labelIds[] = (int) $labelId;
            }
        }

        if (array_key_exists('label_names', $body)) {
            if (!is_array($body['label_names'])) {
                Response::error('validation_error', 'label_names must be an array', 422, 'label_names');
                return null;
            }
            $names = [];
            foreach ($body['label_names'] as $name) {
                $names[] = (string) $name;
            }
            $nameIds = $this->notes->upsertLabelsByName($names);
            $labelIds = $labelIds === null ? $nameIds : array_values(array_unique(array_merge($labelIds, $nameIds)));
        }

        return $labelIds;
    }
}
