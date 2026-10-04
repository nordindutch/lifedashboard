import { Copy, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useIsDesktop } from '../../../hooks/useMediaQuery';
import type { BudgetExpenseRow, BudgetIncomeRow, BudgetMonthPayload } from '../../../types';
import { AccountsList } from '../components/AccountsList';
import { BalanceBar, BalanceCard } from '../components/BalanceCard';
import { BalanceSettingsSheet } from '../components/BalanceSettingsSheet';
import { CategoryBars } from '../components/CategoryBars';
import { DebtCard } from '../components/DebtCard';
import { EditItemSheet, type EditTarget } from '../components/EditItemSheet';
import { Fab } from '../components/Fab';
import { InlineAddRow } from '../components/InlineAddRow';
import { ItemRow, ItemSection, type RowItem } from '../components/ItemRow';
import { MonthHeader } from '../components/MonthHeader';
import { QuickAddSheet } from '../components/QuickAddSheet';
import { ArchiveNotice, EmptyMonthCard, ErrorCard, LoadingCard } from '../components/StateCards';
import { useAccounts, useBudget, useBudgetAnalytics, useCopyFromPrevious, useDebts, useToggleRow } from '../hooks/useBudget';
import { useMonthParam } from '../hooks/useMonthParam';
import { balanceBarModel, formatEuro, isArchiveMonth, runwayLabel, shiftMonth, sortOpenFirstLargest } from '../lib/budgetMath';

function toRows(data: BudgetMonthPayload): { open: RowItem[]; done: RowItem[] } {
  const expenses: RowItem[] = data.expenses.map((e) => ({
    key: `e${e.id}`,
    name: e.name,
    amount: e.amount,
    done: e.paid,
    category: e.category,
    subtitle: e.category,
    kind: 'expense',
  }));
  const income: RowItem[] = data.income.map((i) => ({
    key: `i${i.id}`,
    name: i.name,
    amount: i.amount,
    done: i.received,
    subtitle: 'Inkomen',
    kind: 'income',
  }));
  const interest: RowItem[] = (data.summary.interest_items ?? []).map((it) => ({
    key: `r${it.debt_id}`,
    name: `Rente ${it.name}`,
    amount: it.amount,
    done: false,
    subtitle: 'Rente op schuld, automatisch',
    kind: 'interest',
  }));
  const all = [...expenses, ...income, ...interest];
  return {
    open: sortOpenFirstLargest(all.filter((r) => !r.done)),
    done: all.filter((r) => r.done),
  };
}

function findTarget(data: BudgetMonthPayload, item: RowItem): EditTarget | null {
  const id = Number(item.key.slice(1));
  if (item.kind === 'expense') {
    const row = data.expenses.find((e) => e.id === id);
    return row ? { kind: 'expense', row } : null;
  }
  if (item.kind === 'income') {
    const row = data.income.find((i) => i.id === id);
    return row ? { kind: 'income', row } : null;
  }
  return null;
}

export function MonthPage() {
  const [month, setMonth] = useMonthParam();
  const isDesktop = useIsDesktop();
  const q = useBudget(month);
  const copyPrev = useCopyFromPrevious(month);
  const toggle = useToggleRow(month);
  const archive = isArchiveMonth(month);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);

  const data = q.data;
  const rows = useMemo(() => (data ? toRows(data) : { open: [], done: [] }), [data]);
  const isEmpty = data !== undefined && data.income.length === 0 && data.expenses.length === 0;
  const nextSortOrder = data ? data.income.length + data.expenses.length + 1 : 1;

  const onToggle = (item: RowItem) => {
    if (!data || archive) {
      return;
    }
    const target = findTarget(data, item);
    if (target) {
      toggle.mutate(target);
    }
  };
  const onOpen = (item: RowItem) => {
    if (!data || archive) {
      return;
    }
    setEditTarget(findTarget(data, item));
  };

  const copyButton = (
    <button
      type="button"
      onClick={() => void copyPrev.mutateAsync(undefined)}
      disabled={archive || copyPrev.isPending || !isEmpty}
      title={!isEmpty ? 'Alleen mogelijk in een lege maand' : undefined}
      className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-[#2c303b] px-2.5 text-xs font-semibold text-[#c8ccd6] disabled:opacity-40 md:px-3.5 md:text-[13px]"
    >
      {isDesktop ? <Copy className="h-4 w-4" aria-hidden /> : null}
      {isDesktop ? 'Kopieer vorige maand' : 'Kopieer vorige'}
    </button>
  );

  const body = (() => {
    if (q.isLoading) {
      return <LoadingCard />;
    }
    if (!data) {
      return <ErrorCard message={q.error instanceof Error ? q.error.message : 'Budget niet beschikbaar'} onRetry={() => void q.refetch()} />;
    }
    return null;
  })();

  const stale = q.isError && data !== undefined;

  return (
    <div className={`mx-auto flex flex-col gap-4 p-4 ${isDesktop ? 'max-w-screen-2xl gap-5 p-6 lg:p-8' : 'max-w-lg'}`}>
      <MonthHeader
        month={month}
        onChange={setMonth}
        size={isDesktop ? 'desktop' : 'mobile'}
        actions={
          <>
            {copyButton}
            {isDesktop && !archive ? (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex h-11 items-center gap-2 rounded-xl bg-codex-accent px-4 text-sm font-extrabold text-codex-accent-ink"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nieuwe post
              </button>
            ) : null}
          </>
        }
      />

      {archive ? <ArchiveNotice /> : null}
      {body}

      {data && !isDesktop ? (
        <>
          <BalanceCard month={data.month} summary={data.summary} onEditBalance={archive ? undefined : () => setBalanceOpen(true)} stale={stale} />
          {isEmpty ? (
            <EmptyMonthCard onCopy={() => void copyPrev.mutateAsync(undefined)} pending={copyPrev.isPending} canCopy={!archive} />
          ) : (
            <>
              <ItemSection title="Nog te betalen" count={rows.open.length} items={rows.open} emptyText="Alles is afgerond. Goed bezig." onToggle={onToggle} onOpen={onOpen} readOnly={archive} />
              <ItemSection title="Afgerond" count={rows.done.length} items={rows.done} emptyText="Nog niets afgevinkt." onToggle={onToggle} onOpen={onOpen} readOnly={archive} muted />
            </>
          )}
        </>
      ) : null}

      {data && isDesktop ? (
        <DesktopMonthView data={data} month={month} archive={archive} stale={stale} isEmpty={isEmpty} onToggle={onToggle} onOpen={onOpen} onEditBalance={() => setBalanceOpen(true)} onCopy={() => void copyPrev.mutateAsync(undefined)} copyPending={copyPrev.isPending} />
      ) : null}

      {!archive && data ? <Fab onClick={() => setAddOpen(true)} /> : null}

      <QuickAddSheet open={addOpen} onClose={() => setAddOpen(false)} month={month} nextSortOrder={nextSortOrder} />
      <EditItemSheet target={editTarget} onClose={() => setEditTarget(null)} month={month} />
      {data ? <BalanceSettingsSheet open={balanceOpen} onClose={() => setBalanceOpen(false)} monthKey={month} month={data.month} /> : null}
    </div>
  );
}

type DesktopProps = {
  data: BudgetMonthPayload;
  month: string;
  archive: boolean;
  stale: boolean;
  isEmpty: boolean;
  onToggle: (item: RowItem) => void;
  onOpen: (item: RowItem) => void;
  onEditBalance: () => void;
  onCopy: () => void;
  copyPending: boolean;
};

function StatCard({ label, value, tone, children }: { label: string; value: string; tone?: 'positive' | 'risk'; children?: React.ReactNode }) {
  const color = tone === 'positive' ? 'text-codex-positive' : tone === 'risk' ? 'text-codex-risk' : '';
  return (
    <div className="rounded-card border border-codex-border bg-codex-surface p-[18px]">
      <span className="codex-label block">{label}</span>
      <span className={`mt-1 block text-[28px] font-extrabold tracking-tight ${color}`}>{value}</span>
      {children}
    </div>
  );
}

function DesktopMonthView({ data, month, archive, stale, isEmpty, onToggle, onOpen, onEditBalance, onCopy, copyPending }: DesktopProps) {
  const accountsQ = useAccounts();
  const debtsQ = useDebts();
  const analyticsQ = useBudgetAnalytics();
  const { summary } = data;
  const bar = balanceBarModel(data.month.current_balance, summary.projected_balance, data.month.minimum_balance);

  const expenseRows: (RowItem & { row?: BudgetExpenseRow })[] = [
    ...sortOpenFirstLargest(data.expenses.filter((e) => !e.paid)),
    ...data.expenses.filter((e) => e.paid),
  ].map((e) => ({ key: `e${e.id}`, name: e.name, amount: e.amount, done: e.paid, category: e.category, kind: 'expense', row: e }));
  const interestRows: RowItem[] = (summary.interest_items ?? []).map((it) => ({
    key: `r${it.debt_id}`, name: `Rente ${it.name}`, amount: it.amount, done: false, kind: 'interest', subtitle: 'Rente op schuld, automatisch',
  }));
  const incomeRows: (RowItem & { row?: BudgetIncomeRow })[] = [
    ...sortOpenFirstLargest(data.income.filter((i) => !i.received)),
    ...data.income.filter((i) => i.received),
  ].map((i) => ({ key: `i${i.id}`, name: i.name, amount: i.amount, done: i.received, kind: 'income', row: i }));

  const nextSortOrder = data.income.length + data.expenses.length + 1;
  const openDebts = (debtsQ.data?.items ?? []).filter((d) => !d.paid);

  return (
    <>
      {stale ? (
        <p className="rounded-xl border border-codex-accent/40 bg-codex-accent/10 px-3 py-2 text-xs font-semibold text-codex-accent" role="status">
          Niet bijgewerkt. Dit is de laatst bekende stand.
        </p>
      ) : null}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="rounded-card border border-codex-border bg-codex-surface p-[18px]">
          <span className="codex-label block">Huidig saldo</span>
          {archive ? (
            <span className="mt-1 block text-[28px] font-extrabold tracking-tight">{formatEuro(data.month.current_balance)}</span>
          ) : (
            <button type="button" onClick={onEditBalance} className="mt-1 block rounded-lg text-left text-[28px] font-extrabold tracking-tight hover:bg-white/5" aria-label={`Huidig saldo ${formatEuro(data.month.current_balance)}, wijzigen`}>
              {formatEuro(data.month.current_balance)}
            </button>
          )}
        </div>
        <StatCard label="Te ontvangen" value={formatEuro(summary.pending_income)} tone="positive" />
        <StatCard label="Te betalen" value={formatEuro(summary.pending_expenses)} tone="risk" />
        <div className={`rounded-card border bg-codex-surface p-[18px] ${bar.belowMinimum ? 'border-codex-risk-border' : 'border-[#2f5a4b]'}`}>
          <span className="codex-label block">Projectie</span>
          <span className={`mt-1 block text-[28px] font-extrabold tracking-tight ${bar.belowMinimum ? 'text-codex-risk' : 'text-codex-positive'}`}>{formatEuro(summary.projected_balance)}</span>
          <div className="mt-3">
            <BalanceBar current={data.month.current_balance} projected={summary.projected_balance} minimum={data.month.minimum_balance} height="h-2" />
          </div>
          <p className={`mt-2 text-xs ${bar.belowMinimum ? 'font-bold text-codex-risk' : 'text-codex-muted'}`}>
            {formatEuro(bar.distance)} {bar.belowMinimum ? 'onder' : 'boven'} je minimum van {formatEuro(data.month.minimum_balance)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-col gap-5" style={{ flex: '999 1 560px' }}>
          {isEmpty ? <EmptyMonthCard onCopy={onCopy} pending={copyPending} canCopy={!archive} /> : null}
          <section className="overflow-hidden rounded-card border border-codex-border bg-codex-surface" aria-labelledby="desk-expenses">
            <div className="flex items-center justify-between px-[18px] py-4">
              <h2 id="desk-expenses" className="text-base font-bold">Uitgaven</h2>
              <span className="text-[13px] text-codex-muted">Nog open eerst, grootste bedrag bovenaan</span>
            </div>
            <ul>
              {expenseRows.map((r) => (
                <ItemRow key={r.key} item={r} dense readOnly={archive} onToggle={() => onToggle(r)} onOpen={() => onOpen(r)} />
              ))}
              {interestRows.map((r) => (
                <ItemRow key={r.key} item={r} dense readOnly />
              ))}
              {expenseRows.length === 0 && interestRows.length === 0 ? <li className="px-[18px] py-4 text-sm text-codex-muted">Nog geen uitgaven.</li> : null}
            </ul>
            {!archive ? <InlineAddRow kind="expense" month={month} nextSortOrder={nextSortOrder} /> : null}
          </section>

          <section className="overflow-hidden rounded-card border border-codex-border bg-codex-surface" aria-labelledby="desk-income">
            <div className="flex items-center justify-between px-[18px] py-4">
              <h2 id="desk-income" className="text-base font-bold">Inkomen</h2>
              <span className="text-sm font-bold text-codex-positive">{formatEuro(summary.total_income)}</span>
            </div>
            <ul>
              {incomeRows.map((r) => (
                <ItemRow key={r.key} item={r} dense readOnly={archive} onToggle={() => onToggle(r)} onOpen={() => onOpen(r)} />
              ))}
              {incomeRows.length === 0 ? <li className="px-[18px] py-4 text-sm text-codex-muted">Nog geen inkomen.</li> : null}
            </ul>
            {!archive ? <InlineAddRow kind="income" month={month} nextSortOrder={nextSortOrder} /> : null}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5" style={{ flex: '1 1 320px' }}>
          <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-labelledby="desk-accounts">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 id="desk-accounts" className="text-base font-bold">
                <Link to="/budget/accounts" className="hover:text-codex-accent">Rekeningen</Link>
              </h2>
              <span className="text-sm font-bold">{formatEuro(accountsQ.data?.total ?? 0)}</span>
            </div>
            <AccountsList accounts={accountsQ.data?.items ?? []} compact />
          </section>

          <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-labelledby="desk-debts">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 id="desk-debts" className="text-base font-bold">
                <Link to="/budget/accounts" className="hover:text-codex-accent">Schulden</Link>
              </h2>
              <span className="text-sm font-bold text-codex-risk">{formatEuro(debtsQ.data?.outstanding ?? 0)}</span>
            </div>
            <div className="flex flex-col gap-4">
              {openDebts.length === 0 ? <p className="text-sm text-codex-muted">Geen openstaande schulden.</p> : null}
              {openDebts.map((d) => (
                <DebtCard key={d.id} debt={d} compact />
              ))}
            </div>
          </section>

          <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-labelledby="desk-cats">
            <div className="mb-3.5 flex items-baseline justify-between">
              <h2 id="desk-cats" className="text-base font-bold">
                <Link to="/budget/analysis" className="hover:text-codex-accent">Uitgaven per categorie</Link>
              </h2>
              <span className="text-[13px] text-codex-muted">Looptijd {runwayLabel(analyticsQ.data?.runway.months ?? null)}</span>
            </div>
            <CategoryBars
              byCategory={summary.by_category}
              extra={summary.total_interest > 0 ? [{ label: 'Rente op schulden', amount: summary.total_interest, color: '#f2b84b' }] : []}
            />
          </section>
        </div>
      </div>
      <p className="text-xs text-codex-muted">
        Vorige maand: <Link to={`/budget?m=${shiftMonth(month, -1)}`} className="underline underline-offset-2">bekijken</Link>
      </p>
    </>
  );
}
