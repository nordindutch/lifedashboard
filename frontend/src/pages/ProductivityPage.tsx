import { KanbanBoard } from '../components/productivity/KanbanBoard';
import { EmptyState } from '../components/ui/EmptyState';
import { useTasks } from '../hooks/useTasks';

export function ProductivityPage() {
  const q = useTasks();
  const tasks = q.data ?? [];
  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-semibold">Productivity</h1>
      {q.isLoading ? (
        <p className="text-sm text-slate-400">Loading tasks…</p>
      ) : q.isError ? (
        <EmptyState
          title="Tasks unavailable"
          description={q.error instanceof Error ? q.error.message : 'Backend route not implemented yet.'}
        />
      ) : (
        <KanbanBoard initialTasks={tasks} />
      )}
    </div>
  );
}
