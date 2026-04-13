import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { KanbanColumn } from './KanbanColumn';
import { TaskDrawer } from './TaskDrawer';

const DEFAULT_COLUMNS: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

type Props = {
  columns?: TaskStatus[];
  initialTasks: Task[];
};

/**
 * Kanban columns with local state. Wire `@dnd-kit` sortable + `PATCH /api/tasks/reorder` in a follow-up.
 */
export function KanbanBoard({ columns = DEFAULT_COLUMNS, initialTasks }: Props) {
  const [tasks] = useState<Task[]>(initialTasks);
  const [selected, setSelected] = useState<Task | null>(null);

  const byStatus = useMemo(() => {
    const m = new Map<TaskStatus, Task[]>();
    columns.forEach((c) => m.set(c, []));
    tasks.forEach((t) => {
      const list = m.get(t.status);
      if (list) {
        list.push(t);
      }
    });
    return m;
  }, [tasks, columns]);

  if (tasks.length === 0) {
    return <EmptyState title="No tasks yet" description="Create a task to populate the board." />;
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((c) => (
          <KanbanColumn
            key={c}
            status={c}
            label={c.replace('_', ' ')}
            tasks={byStatus.get(c) ?? []}
            onOpenTask={setSelected}
          />
        ))}
      </div>
      <TaskDrawer task={selected} onClose={() => setSelected(null)} />
    </>
  );
}
