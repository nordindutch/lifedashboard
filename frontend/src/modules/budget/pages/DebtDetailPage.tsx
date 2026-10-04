import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AmountField } from '../../../components/ui/AmountField';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { DebtSheet } from '../components/DebtSheet';
import { ErrorCard, LoadingCard } from '../components/StateCards';
import { useDebt, useRegisterDebtPayment, useUpsertDebt } from '../hooks/useBudget';
import { debtProgressPct, formatEuro, formatEuroRounded, formatPercent, paymentPresets, payoffEstimate } from '../lib/budgetMath';

function paymentDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Scherm 5: schuld met rente, aflossing registreren, schatting looptijd en totale rente. */
export function DebtDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();
  const q = useDebt(Number.isFinite(id) ? id : null);
  const pay = useRegisterDebtPayment(id);
  const upsert = useUpsertDebt();
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const debt = q.data;

  useEffect(() => {
    if (debt && amount === null) {
      const presets = paymentPresets(debt.remaining);
      setAmount(presets[1] ?? presets[0] ?? null);
    }
  }, [debt, amount]);

  if (q.isLoading) {
    return <div className="mx-auto max-w-lg p-4"><LoadingCard label="Schuld laden..." /></div>;
  }
  if (!debt) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <ErrorCard message={q.error instanceof Error ? q.error.message : 'Schuld niet gevonden'} onRetry={() => void q.refetch()} />
      </div>
    );
  }

  const pct = debtProgressPct(debt.amount, debt.paid_amount);
  const estimate = amount !== null && amount > 0 ? payoffEstimate(debt.remaining, debt.interest_rate_pct, amount) : null;
  const presets = paymentPresets(debt.remaining);

  const submitPayment = async () => {
    if (amount === null || amount <= 0) {
      setError('Vul een bedrag groter dan nul in.');
      return;
    }
    setError(null);
    try {
      await pay.mutateAsync({ amount });
      setAmount(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const toggleInclude = (v: boolean) =>
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
      include_interest_in_budget: v,
    });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 md:max-w-2xl md:p-6">
      <div className="flex items-center gap-1">
        <Link to="/budget/accounts" className="flex h-11 w-11 items-center justify-center rounded-xl text-[#c8ccd6] hover:bg-white/5" aria-label="Terug naar rekeningen">
          <ChevronLeft className="h-[22px] w-[22px]" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-tight">{debt.name}</h1>
        <button type="button" onClick={() => setEditOpen(true)} className="h-11 rounded-xl border border-[#2c303b] px-3.5 text-[13px] font-semibold text-[#c8ccd6]">
          Gegevens
        </button>
      </div>

      <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-label="Stand van de schuld">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="codex-label block">{debt.paid ? 'Afgelost' : 'Nog te betalen'}</span>
            <span className="mt-0.5 block text-[32px] font-extrabold tracking-tight">{formatEuro(debt.remaining)}</span>
          </div>
          <div className="text-right">
            <span className="codex-label block">Rente</span>
            <span className="mt-1 block text-xl font-bold text-codex-accent">{formatPercent(debt.interest_rate_pct, 2)}</span>
          </div>
        </div>
        <div className="mt-3.5 h-2.5 overflow-hidden rounded-[5px] bg-codex-border" role="img" aria-label={`${pct} procent afgelost`}>
          <div className="h-full rounded-[5px] bg-codex-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-xs text-codex-muted">
          <span>{formatEuro(debt.paid_amount)} afgelost van {formatEuro(debt.amount)}</span>
          <span>{pct}%</span>
        </div>
        {debt.monthly_interest > 0 ? (
          <p className="mt-3 text-sm">
            <span className="font-bold text-codex-accent">+ {formatEuro(debt.monthly_interest)}</span> rente deze maand
            <span className="text-codex-muted"> ({formatEuro(debt.remaining)} x {formatPercent(debt.interest_rate_pct, 2)} / 12)</span>
          </p>
        ) : null}
        {!debt.paid && debt.interest_rate_pct > 0 ? (
          <div className="mt-3 rounded-xl bg-codex-surface-2 px-3">
            <ToggleSwitch
              label="Rente meetellen in maandbudget"
              description="Verschijnt als uitgavepost bij Nog te betalen."
              checked={debt.include_interest_in_budget}
              disabled={upsert.isPending}
              onChange={(v) => void toggleInclude(v)}
            />
          </div>
        ) : null}
      </section>

      {!debt.paid ? (
        <section className="flex flex-col gap-2" aria-labelledby="pay-heading">
          <h2 id="pay-heading" className="codex-label px-1">Aflossing registreren</h2>
          <form
            className="flex flex-col gap-3 rounded-card border border-codex-border bg-codex-surface p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPayment();
            }}
          >
            <label htmlFor="pay-amount" className="sr-only">Bedrag aflossing</label>
            <AmountField id="pay-amount" value={amount} onChange={setAmount} className="[&_input]:border-codex-accent [&_input]:text-xl [&_input]:font-extrabold" />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Snelknoppen">
              {presets.map((p, i) => {
                const isAll = i === presets.length - 1 && Math.abs(p - debt.remaining) < 0.005;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    aria-pressed={amount !== null && Math.abs(amount - p) < 0.005}
                    className={`h-11 rounded-full border px-3.5 text-sm font-bold ${
                      amount !== null && Math.abs(amount - p) < 0.005 ? 'border-codex-accent bg-[#1d2130] text-white' : 'border-[#2c303b] text-[#c8ccd6]'
                    }`}
                  >
                    {isAll ? 'Alles' : formatEuroRounded(p)}
                  </button>
                );
              })}
            </div>
            {error ? <p className="text-sm text-codex-risk" role="alert">{error}</p> : null}
            <button type="submit" disabled={pay.isPending} className="h-[52px] rounded-field bg-codex-accent text-[15px] font-extrabold text-codex-accent-ink disabled:opacity-60">
              {pay.isPending ? 'Opslaan...' : 'Aflossing opslaan'}
            </button>
          </form>
        </section>
      ) : null}

      {!debt.paid && estimate && amount !== null ? (
        <section className="rounded-card border border-[#4a3a14] bg-codex-surface p-4" aria-live="polite">
          <h2 className="text-[13px] font-bold text-codex-accent">Zo lang duurt het</h2>
          {estimate.paysOff && estimate.months !== null ? (
            <p className="mt-1 text-[15px] leading-relaxed">
              Bij {formatEuroRounded(amount)} per maand ben je over {estimate.months === 1 ? 'ongeveer 1 maand' : `ongeveer ${estimate.months} maanden`} klaar.
              {debt.interest_rate_pct > 0 ? ` Je betaalt dan ongeveer ${formatEuroRounded(estimate.totalInterest)} aan rente.` : ' Zonder rente.'}
            </p>
          ) : (
            <p className="mt-1 text-[15px] leading-relaxed text-[#f5c2c5]">
              Bij {formatEuroRounded(amount)} per maand dekt je aflossing de rente niet. De schuld daalt dan niet. Kies een hoger bedrag.
            </p>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-2" aria-labelledby="hist-heading">
        <h2 id="hist-heading" className="codex-label px-1">Aflossingen</h2>
        <ul className="overflow-hidden rounded-card border border-codex-border bg-codex-surface">
          {debt.payments.length === 0 ? <li className="px-4 py-4 text-sm text-codex-muted">Nog geen aflossingen geregistreerd.</li> : null}
          {debt.payments.map((p) => (
            <li key={p.id} className="flex min-h-[52px] items-center justify-between gap-3 border-t border-codex-border-soft px-4 text-sm first:border-t-0">
              <span className="text-codex-muted">{paymentDate(p.paid_at)}{p.note ? `, ${p.note}` : ''}</span>
              <span className="font-bold text-codex-positive">{formatEuro(p.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <DebtSheet open={editOpen} onClose={() => setEditOpen(false)} debt={debt} nextSortOrder={debt.sort_order} onDeleted={() => navigate('/budget/accounts')} />
    </div>
  );
}
