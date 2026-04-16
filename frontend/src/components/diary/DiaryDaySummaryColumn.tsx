import { addDays, format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEveningPlan } from '../../hooks/useEveningPlan';
import { EveningSummaryCard, eveningPlanHasRenderableContent } from '../home/EveningSummaryCard';

interface Props {
  date: string;
  hasLogs: boolean;
  onDateChange: (next: string) => void;
}

export function DiaryDaySummaryColumn({ date, hasLogs, onDateChange }: Props) {
  const q = useEveningPlan(date);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const atToday = date >= todayStr;
  const label = (() => {
    try {
      return format(parseISO(`${date}T12:00:00`), 'EEEE, MMM d, yyyy');
    } catch {
      return date;
    }
  })();

  const goPrev = (): void => {
    const d = parseISO(`${date}T12:00:00`);
    onDateChange(format(addDays(d, -1), 'yyyy-MM-dd'));
  };

  const goNext = (): void => {
    if (atToday) {
      return;
    }
    const d = parseISO(`${date}T12:00:00`);
    onDateChange(format(addDays(d, 1), 'yyyy-MM-dd'));
  };

  const plan = q.data?.evening_plan ?? null;
  const showCard = eveningPlanHasRenderableContent(plan);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-codex-border bg-codex-surface px-2 py-2">
        <button
          type="button"
          onClick={goPrev}
          className="inline-flex shrink-0 rounded-md border border-codex-border p-1.5 text-slate-400 transition-colors hover:border-codex-accent/40 hover:text-slate-200"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="min-w-0 flex-1 text-center text-xs font-medium text-slate-300">{label}</p>
        <button
          type="button"
          onClick={goNext}
          disabled={atToday}
          className="inline-flex shrink-0 rounded-md border border-codex-border p-1.5 text-slate-400 transition-colors hover:border-codex-accent/40 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {q.isLoading ? <p className="text-xs text-slate-500">Loading day summary…</p> : null}
      {q.isError ? <p className="text-xs text-rose-400">Could not load day summary.</p> : null}

      {!q.isLoading && !q.isError ? (
        showCard || hasLogs ? (
          <EveningSummaryCard plan={plan} date={date} />
        ) : (
          <div className="rounded-xl border border-codex-border bg-codex-surface/80 px-3 py-3">
            <p className="text-xs font-medium text-slate-400">Day summary</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              No summary for this day yet. When AI evening plans are enabled, a reflection is generated after 22:30
              (local) and stored so you can browse it here.
            </p>
          </div>
        )
      ) : null}
    </div>
  );
}
