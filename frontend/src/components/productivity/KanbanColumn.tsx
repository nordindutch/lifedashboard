import { memo } from 'react';
import type { Task, TaskStatus } from '../../types';
import { Badge } from '../ui/Badge';
import { TaskCard } from './TaskCard';

type Props = {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  onOpenTask: (t: Task) => void;
};

export const KanbanColumn = memo(function KanbanColumn({ status, label, tasks, onOpenTask }: Props) {
  return (
    <section className="flex min-w-[260px] max-w-[320px] flex-1 flex-col rounded-xl border border-codex-border bg-codex-surface/80">
      <div className="flex items-center justify-between border-b border-codex-border px-3 py-2">
        <h3 className="text-sm font-semibold capitalize text-slate-200">{label}</h3>
        <Badge>{tasks.length}</Badge>
      </div>
      <div className="flex flex-col gap-2 p-2" data-status={status}>
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={onOpenTask} />
        ))}
      </div>
    </section>
  );
});
