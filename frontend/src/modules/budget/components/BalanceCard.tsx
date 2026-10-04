import { AlertTriangle } from 'lucide-react';
import type { BudgetMonth, BudgetSummary } from '../../../types';
import { balanceBarModel, formatEuro } from '../lib/budgetMath';

type Props = {
  month: BudgetMonth;
  summary: BudgetSummary;
  /** Opent de lade om saldo en minimum te wijzigen; undefined in archiefmaanden */
  onEditBalance?: () => void;
  /** Toon de staaf "Niet bijgewerkt" wanneer de laatste ophaalactie mislukte */
  stale?: boolean;
};

export function BalanceBar({ current, projected, minimum, height = 'h-2.5' }: { current: number; projected: number; minimum: number; height?: string }) {
  const bar = balanceBarModel(current, projected, minimum);
  const color = bar.belowMinimum ? 'bg-codex-risk' : 'bg-codex-positive';
  return (
    <div
      className={`relative ${height} rounded-md bg-codex-border`}
      role="img"
      aria-label={`Projectie ${formatEuro(projected)}, minimum ${formatEuro(minimum)}, ${formatEuro(bar.distance)} ${bar.belowMinimum ? 'eronder' : 'erboven'}`}
    >
      <div className={`absolute inset-y-0 left-0 rounded-md ${color}`} style={{ width: `${bar.fillPct}%` }} />
      <div className="absolute -inset-y-1 w-0.5 bg-codex-accent" style={{ left: `${bar.minPct}%` }} />
    </div>
  );
}

export function BalanceCard({ month, summary, onEditBalance, stale = false }: Props) {
  const bar = balanceBarModel(month.current_balance, summary.projected_balance, month.minimum_balance);
  const statusColor = bar.belowMinimum ? 'text-codex-risk' : 'text-codex-positive';

  const saldoBlock = (
    <>
      <span className="codex-label block">Huidig saldo</span>
      <span className="mt-0.5 block text-[32px] font-extrabold tracking-tight">{formatEuro(month.current_balance)}</span>
    </>
  );

  return (
    <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-labelledby="balance-heading">
      <h2 id="balance-heading" className="sr-only">
        Saldo en projectie
      </h2>
      {stale ? (
        <p className="mb-3 rounded-xl border border-codex-accent/40 bg-codex-accent/10 px-3 py-2 text-xs font-semibold text-codex-accent" role="status">
          Niet bijgewerkt. Dit is de laatst bekende stand.
        </p>
      ) : null}
      <div className="flex items-end justify-between gap-3">
        {onEditBalance ? (
          <button
            type="button"
            onClick={onEditBalance}
            className="-m-2 rounded-xl p-2 text-left hover:bg-white/5"
            aria-label={`Huidig saldo ${formatEuro(month.current_balance)}, wijzigen`}
          >
            {saldoBlock}
          </button>
        ) : (
          <div>{saldoBlock}</div>
        )}
        <div className="text-right">
          <span className="codex-label block">Projectie</span>
          <span className={`mt-1 block text-xl font-bold ${statusColor}`}>{formatEuro(summary.projected_balance)}</span>
        </div>
      </div>

      <div className="mt-4">
        <BalanceBar current={month.current_balance} projected={summary.projected_balance} minimum={month.minimum_balance} />
        <div className="mt-2 flex justify-between text-xs text-codex-muted">
          <span>Minimum {formatEuro(month.minimum_balance)}</span>
          <span className={`font-bold ${statusColor}`}>
            {formatEuro(bar.distance)} {bar.belowMinimum ? 'eronder' : 'erboven'}
          </span>
        </div>
      </div>

      {bar.belowMinimum ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-codex-risk-border bg-codex-risk-bg p-3" role="alert">
          <AlertTriangle className="mt-px h-[18px] w-[18px] shrink-0 text-codex-risk" aria-hidden />
          <p className="text-[13px] leading-snug text-[#f5c2c5]">
            De projectie ligt onder je minimumsaldo. Stel een post uit of boek iets over van je spaarrekening.
          </p>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-codex-surface-2 px-3 py-2.5">
          <dt className="text-xs text-codex-muted">Te ontvangen</dt>
          <dd className="mt-0.5 text-[17px] font-bold text-codex-positive">{formatEuro(summary.pending_income)}</dd>
        </div>
        <div className="rounded-xl bg-codex-surface-2 px-3 py-2.5">
          <dt className="text-xs text-codex-muted">Te betalen</dt>
          <dd className="mt-0.5 text-[17px] font-bold text-codex-risk">{formatEuro(summary.pending_expenses)}</dd>
        </div>
      </dl>
    </section>
  );
}
