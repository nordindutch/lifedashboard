import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { useCreateTask, useReorderTasks, useTasks } from '../../hooks/useTasks';
import type { Task, TaskStatus } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { KanbanColumn } from './KanbanColumn';
import { ProjectsPanel } from './ProjectsPanel';
import { TaskCard } from './TaskCard';
import { TaskDrawer } from './TaskDrawer';

const DEFAULT_COLUMNS: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};
export function KanbanBoard() {
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const q = useTasks(activeProjectId != null ? { project_id: activeProjectId } : undefined);
  const { data: projects = [] } = useProjects({ status: 'active' });
  const createTask = useCreateTask();
  const reorder = useReorderTasks();
  const tasks = q.data ?? [];
  const [selected, setSelected] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('todo');
  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    setNewProjectId(activeProjectId);
  }, [activeProjectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, Task[]>();
    DEFAULT_COLUMNS.forEach((c) => m.set(c, []));
    tasks
      .slice()
      .sort((a, b) => a.display_order - b.display_order)
      .forEach((t) => {
        const list = m.get(t.status as TaskStatus);
        if (list) {
          list.push(t);
        }
      });
    return m;
  }, [tasks]);

  const handleDragStart = (e: DragStartEvent): void => {
    const t = tasks.find((x) => x.id === e.active.id);
    setDragging(t ?? null);
  };

  const handleDragEnd = (e: DragEndEvent): void => {
    setDragging(null);
    const { active, over } = e;
    if (!over || active.id === over.id) {
      return;
    }

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) {
      return;
    }

    const overTask = tasks.find((t) => t.id === over.id);
    const newStatus = (overTask?.status ?? over.id) as TaskStatus;
    const colTasks = (byStatus.get(newStatus) ?? []).filter((t) => t.id !== active.id);
    const overIndex = overTask ? colTasks.findIndex((t) => t.id === over.id) : colTasks.length;
    const prev = colTasks[overIndex - 1]?.display_order ?? 0;
    const next = colTasks[overIndex]?.display_order ?? prev + 2;
    const newOrder = (prev + next) / 2;

    reorder.mutate([
      {
        task_id: draggedTask.id,
        new_status: newStatus,
        new_display_order: newOrder,
      },
    ]);
  };

  const handleCreate = async (): Promise<void> => {
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    const dueUnix =
      newDueDate !== '' ? Math.floor(new Date(`${newDueDate}T23:59:59`).getTime() / 1000) : undefined;
    const res = await createTask.mutateAsync({
      title,
      status: newStatus,
      project_id: newProjectId ?? undefined,
      due_date: dueUnix,
    });
    if (!res.success) {
      return;
    }
    setNewTitle('');
    setNewDueDate('');
    setCreating(false);
  };

  return (
    <>
      <ProjectsPanel activeProjectId={activeProjectId} onProjectSelect={setActiveProjectId} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">Tasks</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 rounded-lg border border-codex-border bg-codex-surface px-3 py-1.5 text-sm text-slate-200 hover:border-codex-accent/50"
        >
          <Plus size={15} /> New task
        </button>
      </div>

      {creating ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-codex-accent/30 bg-codex-surface p-3">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleCreate();
              }
              if (e.key === 'Escape') {
                setCreating(false);
                setNewDueDate('');
              }
            }}
            placeholder="Task title..."
            className="flex-1 rounded-md border border-codex-border bg-codex-bg px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-codex-accent"
          />
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
            className="rounded-md border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200"
          >
            {DEFAULT_COLUMNS.map((c) => (
              <option key={c} value={c}>
                {COLUMN_LABELS[c]}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="rounded-md border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200"
            aria-label="Due date"
          />
          <select
            value={newProjectId ?? ''}
            onChange={(e) => setNewProjectId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-md border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={createTask.isPending}
            className="rounded-md bg-codex-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {createTask.isPending ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
              setNewDueDate('');
            }}
            className="text-sm text-codex-muted hover:text-slate-300"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {q.isLoading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : q.isError ? (
        <EmptyState title="Tasks unavailable" description={q.error instanceof Error ? q.error.message : 'API error'} />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {DEFAULT_COLUMNS.map((c) => (
              <SortableContext key={c} id={c} items={(byStatus.get(c) ?? []).map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <KanbanColumn status={c} label={COLUMN_LABELS[c]} tasks={byStatus.get(c) ?? []} onOpenTask={setSelected} />
              </SortableContext>
            ))}
          </div>
          <DragOverlay>{dragging ? <TaskCard task={dragging} onOpen={() => {}} /> : null}</DragOverlay>
        </DndContext>
      )}

      <TaskDrawer task={selected} onClose={() => setSelected(null)} />
    </>
  );
}
