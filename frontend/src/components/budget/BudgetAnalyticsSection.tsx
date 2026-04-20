import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBudgetAnalytics, useBudgetInsights } from '../../hooks/useBudget';
import {
  BUDGET_CATEGORIES,
  CATEGORY_COLORS,
  type BudgetAnalyticsPayload,
  type BudgetCategory,
} from '../../types';

function formatEuro(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
}

function shortMonth(monthKey: string): string {
  try {
    return format(parseISO(`${monthKey}-01`), 'MMM yy', { locale: nl });
  } catch {
    return monthKey;
  }
}

function TrendBadge({ direction, label }: { direction: BudgetAnalyticsPayload['trend']['direction']; label: string }) {
  const cls =
    direction === 'growing'
      ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200'
      : direction === 'drifting'
        ? 'border-rose-500/50 bg-rose-950/40 text-rose-200'
        : 'border-slate-500/50 bg-slate-900/60 text-slate-200';
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs leading-snug ${cls}`}>
      <span className="font-medium text-slate-300">Trend: </span>
      {label}
    </div>
  );
}

function BudgetInsightsCard() {
  const q = useBudgetInsights({ enabled: false });
  const msg = q.error instanceof Error ? q.error.message : '';
  const noKey = /not configured|Anthropic|422/i.test(msg);
  const text = q.data?.text?.trim() ?? '';
  return (
    <div className="rounded-xl border border-codex-border bg-gradient-to-br from-codex-surface to-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-codex-muted">AI-analyse</h2>
        <button
          type="button"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          className="rounded-md border border-codex-border px-2.5 py-1 text-xs text-slate-200 transition hover:border-codex-accent/50 disabled:opacity-60"
        >
          {q.isFetching ? 'Analyseren…' : text ? 'Vernieuw analyse' : 'Genereer analyse'}
        </button>
      </div>
      {q.isError ? (
        <p className="mt-2 text-xs text-amber-200/90">
          {noKey
            ? 'Geen Anthropic API-sleutel geconfigureerd. Voeg ANTHROPIC_API_KEY toe of stel de sleutel in bij Instellingen.'
            : msg || 'Kon geen analyse laden.'}
        </p>
      ) : text ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{text}</p>
      ) : (
        <p className="mt-2 text-xs text-codex-muted">Klik op de knop om een korte AI-analyse van je financiën op te halen.</p>
      )}
    </div>
  );
}

export function BudgetAnalyticsSection() {
  const q = useBudgetAnalytics();
  const data = q.data;

  const mergedLine = useMemo(() => {
    if (!data) {
      return [];
    }
    const hist = data.line_series.map((p) => ({
      monthLabel: shortMonth(p.month),
      month: p.month,
      inkomen: p.total_income,
      uitgaven: p.total_expenses,
      saldo: p.balance_trajectory,
    }));
    const proj = data.projection.map((p) => ({
      monthLabel: shortMonth(p.month),
      month: p.month,
      inkomen: null as number | null,
      uitgaven: null as number | null,
      saldo: p.balance_trajectory,
    }));
    return [...hist, ...proj];
  }, [data]);

  const stackedBars = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.category_by_month.map((row) => {
      const o: Record<string, string | number> = { monthLabel: shortMonth(row.month) };
      for (const c of BUDGET_CATEGORIES) {
        o[c] = row.by_category[c] ?? 0;
      }
      return o;
    });
  }, [data]);

  const savingsLine = useMemo(() => {
    if (!data) {
      return [];
    }
    return data.savings_rate.map((r) => ({
      monthLabel: shortMonth(r.month),
      rate: r.rate_pct,
    }));
  }, [data]);

  const avgSavingsPct = useMemo(() => {
    if (!data) {
      return null;
    }
    const vals = data.savings_rate.map((r) => r.rate_pct).filter((x): x is number => x != null && Number.isFinite(x));
    if (vals.length === 0) {
      return null;
    }
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }, [data]);

  if (q.isLoading) {
    return (
      <div className="mb-6 space-y-4">
        <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        <div className="h-64 animate-pulse rounded-xl bg-white/5" />
      </div>
    );
  }
  if (q.isError || !data) {
    return (
      <p className="mb-4 text-sm text-rose-400">
        {q.error instanceof Error ? q.error.message : 'Kon analytics niet laden'}
      </p>
    );
  }

  const { runway, trend } = data;

  return (
    <div className="mb-6 space-y-4">
      <BudgetInsightsCard />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-codex-border bg-codex-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-codex-muted">Buffer (runway)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">
            {runway.months != null ? `${runway.months} mnd` : '—'}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-codex-muted">
            Liquiditeit ({formatEuro(runway.liquid_total)}) ÷ gem. uitgaven 3 mnd ({formatEuro(runway.avg_monthly_expenses_3m)}
            ).
          </p>
        </div>
        <div className="rounded-xl border border-codex-border bg-codex-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-codex-muted">Gem. spaarquote (12 mnd)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-100">{avgSavingsPct != null ? `${avgSavingsPct}%` : '—'}</p>
          <p className="mt-1 text-[11px] text-codex-muted">(Inkomen − uitgaven) ÷ inkomen, gemiddeld over de grafiekperiode.</p>
        </div>
        <div className="rounded-xl border border-codex-border bg-codex-surface p-4 md:col-span-2">
          <TrendBadge direction={trend.direction} label={trend.label_nl} />
          <p className="mt-2 text-[11px] text-codex-muted">
            Hellingshoek netto: {formatEuro(trend.slope_euros_per_month)} / maand (lineaire trend op 12 punten).
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-codex-border bg-codex-surface p-4">
        <h2 className="mb-1 text-sm font-medium text-slate-300">Inkomen, uitgaven &amp; saldotraject</h2>
        <p className="mb-3 text-[11px] text-codex-muted">
          Gestippelde lijn: saldo uit start + cumulatief netto; laatste drie punten gebruiken het gemiddelde netto van de vorige
          drie maanden als prognose.
        </p>
        <div className="h-72 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={mergedLine} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="monthLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => `€${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(1)}k` : v}`}
              />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(value, name) => {
                  const n = String(name ?? '');
                  if (value === '' || value == null) {
                    return ['—', n];
                  }
                  return [formatEuro(Number(value)), n];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="inkomen"
                name="Inkomen"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="uitgaven"
                name="Uitgaven"
                stroke="#fb7185"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="saldo"
                name="Saldotraject (incl. prognose)"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 2 }}
                strokeDasharray="4 4"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-codex-border bg-codex-surface p-4">
          <h2 className="mb-1 text-sm font-medium text-slate-300">Uitgaven per categorie (gestapeld)</h2>
          <p className="mb-3 text-[11px] text-codex-muted">Zie o.a. abonnementen vs. persoonlijk over de tijd.</p>
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stackedBars} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="monthLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(value) => formatEuro(Number(value ?? 0))}
                />
                <Legend />
                {BUDGET_CATEGORIES.map((c) => (
                  <Bar
                    key={c}
                    dataKey={c}
                    stackId="cat"
                    fill={CATEGORY_COLORS[c as BudgetCategory]}
                    name={c}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-codex-border bg-codex-surface p-4">
          <h2 className="mb-1 text-sm font-medium text-slate-300">Spaarquote per maand</h2>
          <p className="mb-3 text-[11px] text-codex-muted">(Inkomen − uitgaven) ÷ inkomen. Leeg als inkomen nul is.</p>
          <div className="h-72 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={savingsLine} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                <XAxis dataKey="monthLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(value) => [`${String(value ?? '—')}%`, 'Spaarquote']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Spaarquote %"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
