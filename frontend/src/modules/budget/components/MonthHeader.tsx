import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthLabel, shiftMonth } from '../lib/budgetMath';

type Props = {
  month: string;
  onChange: (month: string) => void;
  /** Rechts in de kop, bijvoorbeeld Kopieer vorige */
  actions?: React.ReactNode;
  size?: 'mobile' | 'desktop';
};

export function MonthHeader({ month, onChange, actions, size = 'mobile' }: Props) {
  const btn =
    size === 'desktop'
      ? 'flex h-11 w-11 items-center justify-center rounded-xl border border-[#2c303b] text-codex-muted hover:text-codex-text'
      : 'flex h-11 w-11 items-center justify-center rounded-xl text-codex-muted hover:text-codex-text';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-0">
        <button type="button" onClick={() => onChange(shiftMonth(month, -1))} className={btn} aria-label="Vorige maand">
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1
          className={`font-extrabold tracking-tight ${size === 'desktop' ? 'min-w-[220px] text-center text-[28px]' : 'px-0.5 text-[20px] whitespace-nowrap'}`}
          aria-live="polite"
        >
          {monthLabel(month)}
        </h1>
        <button type="button" onClick={() => onChange(shiftMonth(month, 1))} className={btn} aria-label="Volgende maand">
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
