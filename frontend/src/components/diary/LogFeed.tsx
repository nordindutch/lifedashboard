import type { DiaryLog } from '../../types';
import { EmptyState } from '../ui/EmptyState';
import { LogEntry } from './LogEntry';

export function LogFeed({ logs }: { logs: DiaryLog[] }) {
  if (logs.length === 0) {
    return <EmptyState title="No logs yet" description="Capture thoughts with the quick log bar below." />;
  }
  return (
    <div className="space-y-3">
      {logs.map((l) => (
        <LogEntry key={l.id} log={l} />
      ))}
    </div>
  );
}
