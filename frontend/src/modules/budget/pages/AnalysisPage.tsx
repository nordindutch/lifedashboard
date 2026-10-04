import type { BudgetAnalyticsPayload } from '../../../types';
import { CategoryBars } from '../components/CategoryBars';
import { InsightsCard } from '../components/InsightsCard';
import { ErrorCard, LoadingCard } from '../components/StateCards';
import { useBudget, useBudgetAnalytics } from '../hooks/useBudget';
import { currentMonthKey, formatEuro, formatEuroRounded, monthLabel, runwayLabel, shortMonthLabel } from '../lib/budgetMath';

function NetBars({ analytics }: { analytics: BudgetAnalyticsPayload }) {
  const history = analytics.line_series.slice(-5);
  const projected = analytics.projection.slice(0, 2);
  const points = [
    ...history.map((p) => ({ month: p.month, net: p.net, projected: false })),
    ...projected.map((p) => ({ month: p.month, net: p.avg_net_assumption, projected: true })),
  ];
  const maxAbs = Math.max(1, ...points.map((p) => Math.abs(p.net)));
  const trend = analytics.trend;
  const trendColor = trend.direction === 'drifting' ? 'text-codex-risk' : 'text-codex-positive';
  const slope = trend.slope_euros_per_month;
  const trendText =
    trend.direction === 'stable'
      ? `Stabiel, ${slope >= 0 ? '+' : '-'}${formatEuroRounded(Math.abs(slope))} per maand`
      : trend.direction === 'growing'
        ? `Stijgend, +${formatEuroRounded(Math.abs(slope))} per maand`
        : `Dalend, -${formatEuroRounded(Math.abs(slope))} per maand`;

  return (
    <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-labelledby="net-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="net-heading" className="codex-label">Netto per maand</h2>
        <span className={`text-xs font-bold ${trendColor}`}>{trendText}</span>
      </div>
      <ul className="mt-3.5 flex h-[150px] items-end gap-2.5 border-b border-codex-border" aria-label="Netto per maand, laatste maanden en verwachting">
        {points.map((p) => {
          const h = Math.max(4, Math.round((Math.abs(p.net) / maxAbs) * 100));
          const negative = p.net < 0;
          const label = `${monthLabel(p.month)}: ${formatEuro(p.net)}${p.projected ? ', verwachting' : ''}`;
          return (
            <li key={p.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 self-stretch" aria-label={label} title={label}>
              <span className="text-[10px] font-semibold tabular-nums text-codex-muted">{formatEuroRounded(p.net)}</span>
              <span
                className={`block w-full rounded-t-md ${
                  p.projected
                    ? `border-2 border-dashed ${negative ? 'border-codex-risk/60' : 'border-codex-positive/60'}`
                    : negative
                      ? 'bg-codex-risk'
                      : 'bg-codex-positive'
                }`}
                style={{ height: `${h}%` }}
                aria-hidden
              />
              <span className="text-[11px] font-semibold text-codex-muted">{shortMonthLabel(p.month)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2.5 text-xs text-codex-muted">Gestippeld is de verwachting op basis van het gemiddelde van de laatste drie maanden.</p>
    </section>
  );
}

/** Scherm 6: looptijd, spaarquote, netto per maand, uitgaven per categorie als balken. */
export function AnalysisPage() {
  const analyticsQ = useBudgetAnalytics();
  const month = currentMonthKey();
  const monthQ = useBudget(month);
  const analytics = analyticsQ.data;

  const savings = analytics?.savings_rate.filter((s) => s.rate_pct !== null).slice(-1)[0] ?? null;
  const savingsPct = savings?.rate_pct ?? null;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 md:max-w-3xl md:p-6">
      <h1 className="px-1 pt-2 text-[22px] font-extrabold tracking-tight">Analyse</h1>

      {analyticsQ.isLoading ? <LoadingCard label="Analyse laden..." /> : null}
      {analyticsQ.isError && !analytics ? (
        <ErrorCard message={analyticsQ.error instanceof Error ? analyticsQ.error.message : 'Analyse niet beschikbaar'} onRetry={() => void analyticsQ.refetch()} />
      ) : null}

      {analytics ? (
        <>
          <section className="grid grid-cols-2 gap-4 rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-label="Kerncijfers">
            <div>
              <span className="codex-label block">Looptijd</span>
              <span className="mt-1 block text-[26px] font-extrabold tracking-tight">{runwayLabel(analytics.runway.months)}</span>
              <span className="mt-0.5 block text-xs text-codex-muted">
                met je liquide geld ({formatEuro(analytics.runway.liquid_total)}) bij {formatEuro(analytics.runway.avg_monthly_expenses_3m)} per maand
              </span>
            </div>
            <div>
              <span className="codex-label block">Spaarquote</span>
              <span className={`mt-1 block text-[26px] font-extrabold tracking-tight ${savingsPct !== null && savingsPct < 0 ? 'text-codex-risk' : 'text-codex-positive'}`}>
                {savingsPct === null ? 'n.v.t.' : `${Math.round(savingsPct)}%`}
              </span>
              <span className="mt-0.5 block text-xs text-codex-muted">{savings ? `van je inkomen in ${monthLabel(savings.month).toLowerCase()}` : 'nog geen inkomen geregistreerd'}</span>
            </div>
          </section>

          <NetBars analytics={analytics} />
        </>
      ) : null}

      <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-labelledby="cat-heading">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id="cat-heading" className="codex-label">Uitgaven {monthLabel(month).toLowerCase()}</h2>
          <span className="text-sm font-bold">{formatEuro(monthQ.data?.summary.total_expenses ?? 0)}</span>
        </div>
        {monthQ.isLoading ? <LoadingCard label="Uitgaven laden..." /> : null}
        {monthQ.data ? (
          <CategoryBars
            byCategory={monthQ.data.summary.by_category}
            extra={monthQ.data.summary.total_interest > 0 ? [{ label: 'Rente op schulden', amount: monthQ.data.summary.total_interest, color: '#f2b84b' }] : []}
          />
        ) : null}
      </section>

      <InsightsCard />
    </div>
  );
}
