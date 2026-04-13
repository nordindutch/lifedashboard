import { useState } from 'react';
import type { LogType } from '../../types';

const TYPES: { type: LogType; emoji: string }[] = [
  { type: 'activity', emoji: '⚡' },
  { type: 'reflection', emoji: '💭' },
  { type: 'win', emoji: '🏆' },
  { type: 'blocker', emoji: '🧱' },
  { type: 'idea', emoji: '💡' },
  { type: 'mood', emoji: '🙂' },
];

type Props = {
  onSubmit: (body: string, logType: LogType) => void;
};

export function QuickLogBar({ onSubmit }: Props) {
  const [text, setText] = useState('');
  const [logType, setLogType] = useState<LogType>('activity');

  const submit = () => {
    const t = text.trim();
    if (t === '') {
      return;
    }
    onSubmit(t, logType);
    setText('');
  };

  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-codex-border bg-codex-bg/95 p-3 backdrop-blur md:bottom-0 md:relative md:border-t-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex flex-wrap gap-1">
          {TYPES.map((x) => (
            <button
              key={x.type}
              type="button"
              onClick={() => setLogType(x.type)}
              className={`rounded-full px-2 py-1 text-sm ${
                logType === x.type ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'
              }`}
              aria-label={x.type}
            >
              {x.emoji}
            </button>
          ))}
        </div>
        <input
          className="w-full rounded-lg border border-codex-border bg-codex-surface px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-codex-accent focus:outline-none"
          placeholder="Quick log…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
    </div>
  );
}
