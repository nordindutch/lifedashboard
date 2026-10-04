import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { parseAmountInput } from '../../../lib/amountInput';
import type { Debt } from '../../../types';
import { useUpsertDebt } from '../hooks/useBudget';
import { debtProgressPct, formatEuro } from '../lib/budgetMath';

function formatRate(pct: number): string {
  return pct.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deadlineLabel(ts: number | null): string | null {
  if (ts === null) {
    return null;
  }
  return new Date(ts * 1000).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });
}

type Props = {
  debt: Debt;
  /** Compacte weergave (desktop rechterkolom) */
  compact?: boolean;
  onEdit?: () => void;
};

/**
 * Schuld met voortgangsbalk, inline veld "rente per jaar", rente van de maand en de
 * schakelaar om die rente in het maandbudget mee te tellen.
 */
export function DebtCard({ debt, compact = false, onEdit }: Props) {
  const upsert = useUpsertDebt();
  const [rate, setRate] = useState(formatRate(debt.interest_rate_pct));
  const [rateError, setRateError] = useState(false);
  const pct = debtProgressPct(debt.amount, debt.paid_amount);
  const rateId = `rate-${debt.id}`;

  useEffect(() => {
    setRate(formatRate(debt.interest_rate_pct));
  }, [debt.interest_rate_pct]);

  const patch = (fields: Partial<Pick<Debt, 'interest_rate_pct' | 'include_interest_in_budget'>>) =>
    upsert.mutateAsync({
      id: debt.id,
      name: debt.name,
      amount: debt.amount,
      paid_amount: debt.paid_amount,
      deadline: debt.deadline,
      paid: debt.paid,
      notes: debt.notes,
      sort_order: debt.sort_order,
      interest_rate_pct: debt.interest_rate_pct,
      include_interest_in_budget: debt.include_interest_in_budget,
      ...fields,
    });

  const commitRate = () => {
    const n = parseAmountInput(rate);
    if (n === null || n < 0 || n > 100) {
      setRateError(true);
      return;
    }
    setRateError(false);
    if (Math.abs(n - debt.interest_rate_pct) > 0.0005) {
      void patch({ interest_rate_pct: n });
    } else {
      setRate(formatRate(n));
    }
  };

  const deadline = deadlineLabel(debt.deadline);
  const detailHref = `/budget/accounts/debts/${debt.id}`;

  return (
    <article className="flex flex-col gap-2" aria-label={debt.name}>
      <div className="flex items-baseline justify-between gap-3">
        <Link
          to={detailHref}
          className="flex min-h-[32px] min-w-0 items-center gap-1 text-[15px] font-semibold underline decoration-codex-muted-2 underline-offset-4 hover:decoration-codex-accent"
        >
          <span className="truncate">{debt.name}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-codex-muted" aria-hidden />
        </Link>
        <span className={`shrink-0 text-[15px] font-bold ${debt.paid ? 'text-codex-positive' : ''}`}>
          {debt.paid ? 'Afgelost' : formatEuro(debt.remaining)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-codex-border" role="img" aria-label={`${pct} procent afgelost`}>
        <div className="h-full rounded bg-codex-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between gap-2 text-xs text-codex-muted">
        <span className="truncate">
          {formatEuro(debt.paid_amount)} afgelost van {formatEuro(debt.amount)}
          {deadline ? `, deadline ${deadline}` : ''}
        </span>
        <span className="shrink-0">{pct}%</span>
      </div>

      {!debt.paid ? (
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <label htmlFor={rateId} className="text-xs font-semibold text-codex-muted">
            Rente per jaar
          </label>
          <input
            id={rateId}
            type="text"
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={commitRate}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            aria-invalid={rateError || undefined}
            aria-describedby={rateError ? `${rateId}-err` : undefined}
            className={`h-11 w-[72px] rounded-[10px] border bg-codex-surface-2 px-2.5 text-right text-[15px] font-bold outline-none focus:border-codex-accent ${
              rateError ? 'border-codex-risk' : 'border-[#2c303b]'
            } ${compact ? 'h-9 text-[13px]' : ''}`}
          />
          <span className="text-[15px] font-bold" aria-hidden>
            %
          </span>
          <span className="flex-1 text-right text-xs font-bold text-codex-accent">
            {debt.monthly_interest > 0 ? `+ ${formatEuro(debt.monthly_interest)} ${compact ? 'deze maand' : 'rente deze maand'}` : 'Geen rente'}
          </span>
          {rateError ? (
            <p id={`${rateId}-err`} className="w-full text-xs text-codex-risk" role="alert">
              Vul een percentage tussen 0 en 100 in.
            </p>
          ) : null}
        </div>
      ) : null}

      {!debt.paid && debt.interest_rate_pct > 0 && !compact ? (
        <div className="rounded-xl bg-codex-surface-2 px-3">
          <ToggleSwitch
            label="Rente meetellen in maandbudget"
            checked={debt.include_interest_in_budget}
            disabled={upsert.isPending}
            onChange={(v) => void patch({ include_interest_in_budget: v })}
          />
        </div>
      ) : null}

      {onEdit && !compact ? (
        <button type="button" onClick={onEdit} className="self-start text-xs font-bold text-codex-accent min-h-touch">
          Gegevens wijzigen
        </button>
      ) : null}
    </article>
  );
}
