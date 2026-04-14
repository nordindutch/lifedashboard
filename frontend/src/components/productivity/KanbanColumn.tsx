import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

function SortableTaskCard({ task, onOpen }: { task: Task; onOpen: (t: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onOpen={onOpen} />
    </div>
  );
}

export const KanbanColumn = memo(function KanbanColumn({ status, label, tasks, onOpenTask }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      className={`flex min-w-[260px] max-w-[320px] flex-1 flex-col rounded-xl border bg-codex-surface/80 transition-colors ${
        isOver ? 'border-codex-accent/60' : 'border-codex-border'
      }`}
    >
      <div className="flex items-center justify-between border-b border-codex-border px-3 py-2">
        <h3 className="text-sm font-semibold capitalize text-slate-200">{label}</h3>
        <Badge>{tasks.length}</Badge>
      </div>
      <div ref={setNodeRef} className="flex min-h-[80px] flex-col gap-2 p-2" data-status={status}>
        {tasks.map((t) => (
          <SortableTaskCard key={t.id} task={t} onOpen={onOpenTask} />
        ))}
      </div>
    </section>
  );
});
