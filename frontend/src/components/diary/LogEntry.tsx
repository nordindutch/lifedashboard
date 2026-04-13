import { format } from 'date-fns';
import type { DiaryLog } from '../../types';

export function LogEntry({ log }: { log: DiaryLog }) {
  return (
    <article className="rounded-lg border border-codex-border bg-codex-surface p-3 text-sm">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-white/5 px-1.5 py-0.5 capitalize text-slate-300">{log.log_type}</span>
        <time dateTime={new Date(log.logged_at * 1000).toISOString()}>
          {format(new Date(log.logged_at * 1000), 'HH:mm')}
        </time>
      </div>
      <p className="text-slate-200">{log.body}</p>
    </article>
  );
}
