import { Link } from 'react-router-dom';
import type { Task } from '../../types';
import { Card } from '../ui/Card';
import { PriorityPip } from '../ui/PriorityPip';

interface BriefingTasksCardProps {
  tasksToday: Task[];
  tasksOverdue: Task[];
  tasksActive: Task[];
  className?: string;
}

function TaskRow({ task }: { task: Task }) {
  return (
    <li>
      <Link
        to="/tasks"
        className="flex min-h-[44px] items-start justify-between gap-2 rounded-lg border border-transparent px-1 py-2 text-left hover:border-codex-border hover:bg-codex-bg/60"
      >
        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{task.title}</span>
        <PriorityPip priority={task.priority} />
      </Link>
    </li>
  );
}

export function BriefingTasksCard({ tasksToday, tasksOverdue, tasksActive, className }: BriefingTasksCardProps) {
  const hasOverdue = tasksOverdue.length > 0;
  const hasToday = tasksToday.length > 0;
  const hasActive = tasksActive.length > 0;
  const hasAny = hasOverdue || hasToday || hasActive;

  return (
    <Card className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-300">Taken</h3>
        <Link to="/tasks" className="text-xs text-codex-accent hover:text-indigo-300">
          Open bord
        </Link>
      </div>

      {!hasAny ? (
        <p className="text-sm text-slate-500">Geen open taken. Voeg er een toe op het bord.</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {hasOverdue ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-rose-400/90">Achterstallig</p>
              <ul className="space-y-0.5">
                {tasksOverdue.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </div>
          ) : null}
          {hasToday ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-codex-muted">Vandaag</p>
              <ul className="space-y-0.5">
                {tasksToday.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </div>
          ) : null}
          {hasActive ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-codex-muted">Op je bord</p>
              <ul className="space-y-0.5">
                {tasksActive.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
