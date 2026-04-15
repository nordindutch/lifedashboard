import type { Task } from '../../types';
import { PriorityPip } from '../ui/PriorityPip';

type Props = { task: Task; onOpen: (t: Task) => void };

export function TaskCard({ task, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="flex w-full overflow-hidden rounded-lg border border-codex-border bg-codex-bg text-left hover:border-codex-accent/40"
    >
      {task.project_color ? (
        <span className="w-1 shrink-0 rounded-l-lg" style={{ backgroundColor: task.project_color }} aria-hidden />
      ) : (
        <span className="w-1 shrink-0 rounded-l-lg bg-transparent" aria-hidden />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-100">{task.title}</span>
          <PriorityPip priority={task.priority} />
        </div>
        {task.project_title ? <p className="truncate text-[10px] text-codex-muted">{task.project_title}</p> : null}
        {task.description ? <p className="line-clamp-2 text-xs text-slate-500">{task.description}</p> : null}
      </div>
    </button>
  );
}
