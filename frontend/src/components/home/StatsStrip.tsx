import { CheckCircle2, Flame, Smile } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { DailySnapshot, DiaryLog } from '../../types';

const CHECKIN_HOURS = [8, 12, 15, 18, 21];

function getActiveMoodCheckInHour(now: Date, recentLogs: DiaryLog[]): number | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const dayStart = Math.floor(new Date(y, m, d, 0, 0, 0, 0).getTime() / 1000);
  const dayEnd = Math.floor(new Date(y, m, d, 23, 59, 59, 999).getTime() / 1000);

  const todayMoodLogs = recentLogs.filter(
    (log) => log.log_type === 'mood' && log.logged_at >= dayStart && log.logged_at <= dayEnd,
  );

  const nowSec = Math.floor(now.getTime() / 1000);

  for (const h of CHECKIN_HOURS) {
    const windowStart = Math.floor(new Date(y, m, d, h, 0, 0, 0).getTime() / 1000);
    const windowEnd = windowStart + 30 * 60;
    if (nowSec < windowStart || nowSec >= windowEnd) {
      continue;
    }
    const alreadyLogged = todayMoodLogs.some((log) => log.logged_at >= windowStart && log.logged_at < windowEnd);
    if (!alreadyLogged) {
      return h;
    }
  }
  return null;
}

interface StatsStripProps {
  snapshot: DailySnapshot | null;
  recentLogs: DiaryLog[];
  onMoodClick: () => void;
}

interface StatPillProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function StatPill({ icon, label, value, sub, accent = 'text-slate-200' }: StatPillProps) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-lg border border-codex-border bg-codex-surface px-3 py-2.5">
      <div className="shrink-0 text-codex-muted">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-codex-muted">{label}</p>
        <p className={`mt-0.5 text-sm font-semibold leading-none ${accent}`}>{value}</p>
        {sub ? <p className="mt-0.5 text-[10px] text-slate-600">{sub}</p> : null}
      </div>
    </div>
  );
}

export function StatsStrip({ snapshot, recentLogs, onMoodClick }: StatsStripProps) {
  const streak = snapshot?.diary_streak ?? 0;
  const done = snapshot?.tasks_completed ?? 0;
  const planned = snapshot?.tasks_planned ?? 0;
  const mood = snapshot?.avg_mood_score;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const missedCheckIn = getActiveMoodCheckInHour(now, recentLogs);
  const shouldPulse = missedCheckIn !== null;

  const streakAccent =
    streak >= 7 ? 'text-amber-400' : streak >= 3 ? 'text-orange-400' : 'text-slate-200';

  return (
    <div className="flex gap-2">
      <StatPill
        icon={<CheckCircle2 size={15} />}
        label="Vandaag klaar"
        value={planned > 0 ? `${done}/${planned}` : done}
        sub={planned > 0 ? `${Math.round((done / planned) * 100)}% voltooid` : undefined}
        accent={done > 0 ? 'text-emerald-400' : 'text-slate-200'}
      />
      <button
        type="button"
        onClick={onMoodClick}
        className={`flex flex-1 items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-300 ${
          shouldPulse
            ? 'animate-pulse cursor-pointer border-amber-500/60 bg-amber-900/20'
            : 'border-codex-border bg-codex-surface'
        }`}
        title={shouldPulse ? `Stemming — ${missedCheckIn}:00` : 'Stemming loggen'}
      >
        <Smile size={15} className={shouldPulse ? 'shrink-0 text-amber-400' : 'shrink-0 text-codex-muted'} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-codex-muted">Avg mood</p>
          <p
            className={`mt-0.5 text-sm font-semibold leading-none ${
              shouldPulse ? 'text-amber-400' : mood != null && mood >= 7 ? 'text-emerald-400' : 'text-slate-200'
            }`}
          >
            {mood != null ? mood.toFixed(1) : shouldPulse ? 'Invullen' : '—'}
          </p>
          {shouldPulse ? (
            <p className="mt-0.5 text-[10px] text-amber-500/80">{missedCheckIn}:00</p>
          ) : mood != null ? (
            <p className="mt-0.5 text-[10px] text-slate-600">van de 10</p>
          ) : (
            <p className="mt-0.5 text-[10px] text-slate-600">Geen stemmingen</p>
          )}
        </div>
      </button>
      <StatPill
        icon={<Flame size={15} />}
        label="Dagboek reeks"
        value={streak === 0 ? '—' : `${streak}d`}
        sub={streak >= 1 ? `${streak} dag${streak > 1 ? 'en' : ''} op rij` : 'Log vandaag om te starten'}
        accent={streakAccent}
      />
    </div>
  );
}
