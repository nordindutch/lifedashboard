import { useEffect, useState } from 'react';
import { useDeleteTask, useUpdateTask } from '../../hooks/useTasks';
import { useUiStore } from '../../stores/uiStore';
import type { Priority, Task, TaskStatus } from '../../types';
import { Drawer } from '../ui/Drawer';

const STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
};

type Props = { task: Task | null; onClose: () => void };

export function TaskDrawer({ task, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<Priority>(2);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const pushToast = useUiStore((s) => s.pushToast);

  useEffect(() => {
    if (!task) {
      return;
    }
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setPriority(task.priority);
  }, [task]);

  const open = task !== null;
  const drawerTitle = title.trim() || task?.title || 'Task';
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
      },
    });
    if (!res.success) {
      pushToast({ message: res.error.message, tone: 'error' });
      return;
    }
    onClose();
  };

  const handleDelete = async (): Promise<void> => {
    if (!task || !window.confirm('Delete this task?')) {
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
          <div>
            <label htmlFor="task-drawer-title" className="mb-1 block text-slate-500">
              Title
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
            <label htmlFor="task-drawer-description" className="mb-1 block text-slate-500">
              Description
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
                Priority
              </label>
              <select
                id="task-drawer-priority"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value) as Priority)}
                className="w-full rounded-md border border-codex-border bg-codex-bg px-2 py-2 text-slate-200"
              >
                <option value={1}>1 — Highest</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4 — Lowest</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy}
              className="rounded-md bg-codex-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {updateTask.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-codex-border px-4 py-2 text-sm text-slate-200 hover:border-codex-accent/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={busy}
              className="ml-auto rounded-md border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              {deleteTask.isPending ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
