import { useQueryClient } from '@tanstack/react-query';
import { format, fromUnixTime } from 'date-fns';
import { BookOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as diaryApi from '../../api/diary';
import type { DiaryLog, LogType } from '../../types';
import { Card } from '../ui/Card';

const TYPE_EMOJI: Record<LogType, string> = {
  activity: '⚡',
  reflection: '💭',
  win: '🏆',
  blocker: '🧱',
  idea: '💡',
  mood: '🙂',
};

const LOG_TYPES: LogType[] = ['activity', 'reflection', 'win', 'blocker', 'idea', 'mood'];

interface DiaryCardProps {
  logs: DiaryLog[];
  className?: string;
}

export function DiaryCard({ logs, className }: DiaryCardProps) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [logType, setLogType] = useState<LogType>('activity');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    const body = text.trim();
    if (!body) {
      return;
    }

    setSubmitting(true);
    const res = await diaryApi.createDiaryLog({ body, log_type: logType });
    if (res.success) {
      setText('');
      void qc.invalidateQueries({ queryKey: ['diary'] });
      void qc.invalidateQueries({ queryKey: ['briefing'] });
    }
    setSubmitting(false);
  };

  return (
    <Card className={`flex flex-col gap-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-codex-muted" />
          <h3 className="text-sm font-medium text-slate-300">Diary</h3>
        </div>
        <Link to="/diary" className="text-xs text-codex-accent hover:text-indigo-300">
          All logs
        </Link>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-xs text-slate-500">No logs today yet.</p>
        ) : (
          <ul className="space-y-2">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-lg border border-codex-border bg-codex-bg/60 px-2.5 py-2"
              >
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="text-xs" title={log.log_type}>
                    {TYPE_EMOJI[log.log_type] ?? '📝'}
                  </span>
                  <time className="text-[11px] text-slate-500">
                    {format(fromUnixTime(log.logged_at), 'HH:mm')}
                  </time>
                </div>
                <p className="line-clamp-2 text-xs text-slate-300">{log.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-codex-border/60 pt-3">
        <div className="mb-2 flex gap-1">
          {LOG_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setLogType(t)}
              title={t}
              className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                logType === t ? 'bg-white/15 text-slate-200' : 'text-slate-500 hover:bg-white/5'
              }`}
            >
              {TYPE_EMOJI[t]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Quick log…"
            className="min-w-0 flex-1 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !text.trim()}
            className="flex items-center justify-center rounded-md border border-codex-border px-2 py-1.5 text-slate-400 transition-colors hover:border-codex-accent/50 hover:text-slate-200 disabled:opacity-40"
            aria-label="Add log"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </Card>
  );
}
