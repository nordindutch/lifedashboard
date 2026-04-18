import { format, fromUnixTime } from 'date-fns';
import { useEffect, useState } from 'react';
import { TaskNotesList } from '../notes/TaskNotesList';
import { useProjects } from '../../hooks/useProjects';
import { useDeleteTask, useUpdateTask } from '../../hooks/useTasks';
import { useUiStore } from '../../stores/uiStore';
import type { Priority, Task, TaskStatus } from '../../types';
import { Drawer } from '../ui/Drawer';

const STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Te doen',
  in_progress: 'Bezig',
  in_review: 'In review',
  done: 'Klaar',
  cancelled: 'Geannuleerd',
};

type Props = { task: Task | null; onClose: () => void };

export function TaskDrawer({ task, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'notes'>('details');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<Priority>(2);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [estimatedMins, setEstimatedMins] = useState<number | ''>('');

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: projects = [] } = useProjects({ status: 'active' });
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    if (!task) {
      return;
    }
    setActiveTab('details');
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setProjectId(task.project_id ?? null);
    setDueDate(task.due_date ? format(fromUnixTime(task.due_date), 'yyyy-MM-dd') : '');
    setEstimatedMins(task.estimated_mins ?? '');
  }, [task]);

  const open = task !== null;
  const drawerTitle = title.trim() || task?.title || 'Taak';
  const busy = updateTask.isPending || deleteTask.isPending;

  const handleSave = async (): Promise<void> => {
    if (!task) {
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      pushToast({ message: 'Title is required', tone: 'error' });
      return;
    }
    const res = await updateTask.mutateAsync({
      id: task.id,
      body: {
        title: trimmedTitle,
        description: description.trim() === '' ? null : description.trim(),
        status,
        priority,
        project_id: projectId,
        due_date: dueDate === '' ? null : Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000),
        estimated_mins: estimatedMins === '' ? null : Number(estimatedMins),
      },
    });
    if (!res.success) {
      pushToast({ message: res.error.message, tone: 'error' });
      return;
    }
    onClose();
  };

  const handleDelete = async (): Promise<void> => {
    if (!task || !window.confirm('Deze taak verwijderen?')) {
      return;
    }
    const res = await deleteTask.mutateAsync(task.id);
    if (!res.success) {
      pushToast({ message: res.error.message, tone: 'error' });
      return;
    }
    onClose();
  };

  return (
    <Drawer open={open} title={drawerTitle} onClose={onClose} side="bottom">
      {task ? (
        <div className="space-y-3 text-sm">
          <div className="mb-1 flex border-b border-codex-border">
            {(['details', 'notes'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-codex-accent text-slate-200'
                    : 'text-codex-muted hover:text-slate-300'
                }`}
              >
                {tab === 'details' ? 'Details' : 'Notities'}
              </button>
            ))}
          </div>

          {activeTab === 'notes' ? <TaskNotesList taskId={task.id} /> : null}

          {activeTab === 'details' ? (
            <>
          <div>
            <label htmlFor="task-drawer-title" className="mb-1 block text-slate-500">
              Titel
            </label>
            <input
              id="task-drawer-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-codex-border bg-codex-bg px-3 py-2 text-slate-100 outline-none focus:border-codex-accent"
            />
          </div>
          <div>
            <label htmlFor="task-drawer-project" className="mb-1 block text-slate-500">
              Project
            </label>
            <select
              id="task-drawer-project"
              value={projectId ?? ''}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-codex-border bg-codex-bg px-2 py-2 text-slate-200"
            >
              <option value="">— Geen project —</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            {projectId != null ? (
              (() => {
                const project = projects.find((p) => p.id === projectId);
                return project ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: project.color }} />
                    <span className="text-[11px] text-codex-muted">{project.color}</span>
                  </div>
                ) : null;
              })()
            ) : null}
          </div>
          <div>
            <label htmlFor="task-drawer-description" className="mb-1 block text-slate-500">
              Beschrijving
            </label>
            <textarea
              id="task-drawer-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-md border border-codex-border bg-codex-bg px-3 py-2 text-slate-100 outline-none focus:border-codex-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-drawer-status" className="mb-1 block text-slate-500">
                Status
              </label>
              <select
                id="task-drawer-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-md border border-codex-border bg-codex-bg px-2 py-2 text-slate-200"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-drawer-priority" className="mb-1 block text-slate-500">
                Prioriteit
              </label>
              <select
                id="task-drawer-priority"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as Priority)}
                className="w-full rounded-md border border-codex-border bg-codex-bg px-2 py-2 text-slate-200"
              >
                <option value={1}>1 — Hoogst</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4 — Laagst</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-drawer-due-date" className="mb-1 block text-slate-500">
                Deadline
              </label>
              <input
                id="task-drawer-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-codex-border bg-codex-bg px-3 py-2 text-slate-200 outline-none focus:border-codex-accent"
              />
            </div>
            <div>
              <label htmlFor="task-drawer-estimate" className="mb-1 block text-slate-500">
                Schatting (min)
              </label>
              <input
                id="task-drawer-estimate"
                type="number"
                min={1}
                max={480}
                step={15}
                value={estimatedMins}
                onChange={(e) => setEstimatedMins(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="bijv. 30"
                className="w-full rounded-md border border-codex-border bg-codex-bg px-3 py-2 text-slate-200 outline-none focus:border-codex-accent"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
              className="rounded-md bg-codex-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {updateTask.isPending ? 'Opslaan…' : 'Opslaan'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-codex-border px-4 py-2 text-sm text-slate-200 hover:border-codex-accent/50 disabled:opacity-50"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="ml-auto rounded-md border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              {deleteTask.isPending ? 'Verwijderen…' : 'Verwijderen'}
            </button>
          </div>
            </>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}
