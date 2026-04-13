import type { Task } from '../../types';
import { PriorityPip } from '../ui/PriorityPip';

type Props = { task: Task; onOpen: (t: Task) => void };

export function TaskCard({ task, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpen(task)}
      className="w-full rounded-lg border border-codex-border bg-codex-bg p-3 text-left hover:border-codex-accent/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-slate-100">{task.title}</span>
        <PriorityPip priority={task.priority} />
      </div>
      {task.description ? (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>
      ) : null}
    </button>
  );
}
