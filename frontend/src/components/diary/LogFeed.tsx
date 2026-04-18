import type { DiaryLog } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { LogEntry } from './LogEntry';

interface LogFeedProps {
  logs: DiaryLog[];
  /** Shown when `logs` is empty (e.g. when filtering by day). */
  emptyDescription?: string;
}

export function LogFeed({
  logs,
  emptyDescription = 'Vang gedachten hieronder in de snelle logbalk.',
}: LogFeedProps) {
  if (logs.length === 0) {
    return <EmptyState title="Geen logs voor deze dag" description={emptyDescription} />;
  }
  return (
    <div className="space-y-3">
      {logs.map((l) => (
        <LogEntry key={l.id} log={l} />
      ))}
    </div>
  );
}
