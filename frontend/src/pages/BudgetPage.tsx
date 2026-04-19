import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { AccountsPanel } from '../components/budget/AccountsPanel';
import { DebtsPanel } from '../components/budget/DebtsPanel';
import { CrudRow } from '../components/ui/CrudRow';
import { EditableField } from '../components/ui/EditableField';
import {
  useAccounts,
  useBudget,
  useCopyFromPrevious,
  useDeleteExpense,
  useDeleteIncome,
  useUpdateBudgetMonth,
  useUpsertExpense,
  useUpsertIncome,
} from '../hooks/useBudget';
import { formatAmountInputDisplay, parseAmountInput } from '../lib/amountInput';
import { BUDGET_CATEGORIES, CATEGORY_COLORS, type BudgetCategory, type BudgetMonth } from '../types';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatEuro(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
}

function shiftMonth(month: string, delta: number): string {
  const [yRaw, mRaw] = month.split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const dt = new Date(`${month}-01T12:00:00`);
  return format(dt, 'MMMM yyyy', { locale: nl });
}

function BudgetCurrentBalanceField({
  monthData,
  isArchive,
  updateMonth,
}: {
  monthData: BudgetMonth;
  isArchive: boolean;
  updateMonth: ReturnType<typeof useUpdateBudgetMonth>;
}) {
  const accountsQ = useAccounts();
  const checking = useMemo(
    () => (accountsQ.data?.items ?? []).filter((a) => a.kind === 'checking'),
    [accountsQ.data?.items],
  );
  const [manualInput, setManualInput] = useState(() => formatAmountInputDisplay(monthData.current_balance));

  useEffect(() => {
    if ((monthData.current_balance_account_id ?? null) == null) {
      setManualInput(formatAmountInputDisplay(monthData.current_balance));
    }
  }, [monthData.month, monthData.current_balance, monthData.current_balance_account_id]);

  const linked = (monthData.current_balance_account_id ?? null) != null;

  return (
    <>
      <span className="text-codex-muted">Huidig saldo</span>
      <div className="flex flex-col items-end gap-1">
        <select
          value={monthData.current_balance_account_id != null ? String(monthData.current_balance_account_id) : ''}
          disabled={isArchive}
          onChange={(e) => {
            const v = e.target.value;
            void updateMonth.mutateAsync({
              current_balance_account_id: v === '' ? null : Number(v),
            });
          }}
          className="w-full max-w-[16rem] rounded border border-codex-border bg-codex-bg px-2 py-1 text-right text-sm text-slate-200"
          aria-label="Bron voor huidig saldo"
        >
          <option value="">Handmatig invoeren</option>
          {checking.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {linked ? (
          <span
            className={`w-full max-w-[16rem] rounded border border-codex-border/60 bg-codex-bg/40 px-2 py-1 text-right text-sm ${
              monthData.current_balance < 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {formatEuro(monthData.current_balance)}
          </span>
        ) : (
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onBlur={() => {
              const n = parseAmountInput(manualInput);
              if (n === null) {
                setManualInput(formatAmountInputDisplay(monthData.current_balance));
                return;
              }
              setManualInput(formatAmountInputDisplay(n));
              if (n !== monthData.current_balance) {
                void updateMonth.mutateAsync({ current_balance: n });
              }
            }}
            disabled={isArchive}
            inputMode="decimal"
            autoComplete="off"
            className={`w-full max-w-[16rem] rounded border border-codex-border bg-codex-bg px-2 py-1 text-right text-sm ${
              monthData.current_balance < 0 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          />
        )}
        {linked ? (
          <span className="max-w-[16rem] text-right text-[10px] text-codex-muted">
            Volgt saldo van de gekoppelde betaalrekening.
          </span>
        ) : null}
      </div>
    </>
  );
}

export function BudgetPage() {
  const [month, setMonth] = useState(currentMonthKey);
  const q = useBudget(month);
  const upsertIncome = useUpsertIncome(month);
  const upsertExpense = useUpsertExpense(month);
  const deleteIncome = useDeleteIncome(month);
  const deleteExpense = useDeleteExpense(month);
  const copyPrev = useCopyFromPrevious(month);
  const updateMonth = useUpdateBudgetMonth(month);

  const [newIncomeName, setNewIncomeName] = useState('');
  const [newIncomeAmount, setNewIncomeAmount] = useState('');
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseCategory, setNewExpenseCategory] = useState<BudgetCategory>('Vaste Last');

  const isArchive = month < currentMonthKey();
  const data = q.data;
  const summary = data?.summary;

  const chartData = useMemo(() => {
    if (!summary) {
      return [];
    }
    return summary.by_category
      .filter((c) => c.amount > 0)
      .map((c) => ({
        name: c.category,
        value: Math.round(c.amount * 100) / 100,
        color: CATEGORY_COLORS[c.category],
      }));
  }, [summary]);

  const saveIncome = async (row: {
    id?: number;
    name: string;
    amount: number;
    received: boolean;
    sort_order?: number;
  }): Promise<void> => {
    const name = row.name.trim();
    if (name === '' || isArchive) {
      return;
    }
    await upsertIncome.mutateAsync({ ...row, name, amount: Number.isFinite(row.amount) ? row.amount : 0 });
  };

  const saveExpense = async (row: {
    id?: number;
    name: string;
    amount: number;
    category: BudgetCategory;
    paid: boolean;
    sort_order?: number;
  }): Promise<void> => {
    const name = row.name.trim();
    if (name === '' || isArchive) {
      return;
    }
    await upsertExpense.mutateAsync({ ...row, name, amount: Number.isFinite(row.amount) ? row.amount : 0 });
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-100">Budget</h1>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="rounded border border-codex-border p-1.5 text-slate-400 hover:text-slate-100"
            aria-label="Vorige maand"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[8rem] text-center text-sm text-slate-200">{monthLabel(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="rounded border border-codex-border p-1.5 text-slate-400 hover:text-slate-100"
            aria-label="Volgende maand"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => void copyPrev.mutateAsync(undefined)}
          disabled={isArchive || copyPrev.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-codex-border px-3 py-1.5 text-sm text-slate-300 hover:border-codex-accent/60 hover:text-slate-100 disabled:opacity-50"
        >
          <Copy size={14} />
          Copy from previous
        </button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-slate-400">Budget laden…</p>
      ) : (
        <>
          {q.isError || !data || !summary ? (
            <p className="text-sm text-rose-400">
              {q.error instanceof Error ? q.error.message : 'Budget niet beschikbaar'}
            </p>
          ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <section className="min-w-0 overflow-hidden rounded-xl border border-codex-border bg-codex-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">Inkomen</h2>
            <div className="space-y-2">
              {data.income.map((row) => (
                <CrudRow
                  key={row.id}
                  className="group flex flex-col gap-2 rounded-lg border border-codex-border/40 p-2 md:grid md:grid-cols-[auto_minmax(0,1fr)_minmax(0,120px)_auto] md:items-center md:gap-2 md:rounded-none md:border-0 md:p-0"
                  onDelete={isArchive ? undefined : () => void deleteIncome.mutateAsync(row.id)}
                  deleteTitle="Verwijderen"
                  deleteButtonClassName="shrink-0 rounded p-1 text-slate-500 opacity-100 transition hover:text-rose-300 disabled:opacity-20 md:opacity-0 md:group-hover:opacity-100"
                >
                  <div className="flex min-w-0 items-center gap-2 md:contents">
                    <input
                      type="checkbox"
                      checked={row.received}
                      disabled={isArchive}
                      onChange={() =>
                        void saveIncome({
                          id: row.id,
                          name: row.name,
                          amount: row.amount,
                          received: !row.received,
                          sort_order: row.sort_order,
                        })
                      }
                      className="shrink-0"
                    />
                    <EditableField
                      value={row.name}
                      onSave={(v) =>
                        void saveIncome({
                          id: row.id,
                          name: v,
                          amount: row.amount,
                          received: row.received,
                          sort_order: row.sort_order,
                        })
                      }
                      disabled={isArchive}
                      className="min-w-0 flex-1 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200 md:min-w-0 md:border-0 md:bg-transparent"
                    />
                  </div>
                  <EditableField
                    value={row.amount.toFixed(2)}
                    onSave={(v) => {
                      const n = Number(v);
                      if (!Number.isFinite(n)) return;
                      void saveIncome({
                        id: row.id,
                        name: row.name,
                        amount: n,
                        received: row.received,
                        sort_order: row.sort_order,
                      });
                    }}
                    type="number"
                    step="0.01"
                    disabled={isArchive}
                    align="right"
                    className="min-w-0 w-full max-w-[11rem] rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200 md:max-w-none md:border-0 md:bg-transparent"
                  />
                </CrudRow>
              ))}
              <div className="flex min-w-0 flex-col gap-2 pt-2 md:grid md:grid-cols-[minmax(0,1fr)_120px_auto] md:gap-2">
                <input
                  type="text"
                  value={newIncomeName}
                  disabled={isArchive}
                  onChange={(e) => setNewIncomeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void saveIncome({
                        name: newIncomeName,
                        amount: Number(newIncomeAmount || 0),
                        received: false,
                        sort_order: data.income.length + 1,
                      }).then(() => {
                        setNewIncomeName('');
                        setNewIncomeAmount('');
                      });
                    }
                  }}
                  placeholder="Inkomen toevoegen…"
                  className="min-w-0 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200"
                />
                <div className="flex items-center gap-2 md:contents">
                  <input
                    type="number"
                    step="0.01"
                    value={newIncomeAmount}
                    disabled={isArchive}
                    onChange={(e) => setNewIncomeAmount(e.target.value)}
                    className="min-w-0 flex-1 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-right text-sm text-slate-200 md:flex-none"
                  />
                  <button
                    type="button"
                    disabled={isArchive}
                    onClick={() =>
                      void saveIncome({
                        name: newIncomeName,
                        amount: Number(newIncomeAmount || 0),
                        received: false,
                        sort_order: data.income.length + 1,
                      }).then(() => {
                        setNewIncomeName('');
                        setNewIncomeAmount('');
                      })
                    }
                    className="shrink-0 rounded border border-codex-border px-2 text-slate-300 disabled:opacity-40"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-xl border border-codex-border bg-codex-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">Uitgaven</h2>
            <div className="space-y-2">
              {data.expenses.map((row) => (
                <CrudRow
                  key={row.id}
                  className="group flex flex-col gap-2 rounded-lg border border-codex-border/40 p-2 md:grid md:grid-cols-[auto_minmax(0,1fr)_minmax(0,150px)_minmax(0,120px)_auto] md:items-center md:gap-2 md:rounded-none md:border-0 md:p-0"
                  onDelete={isArchive ? undefined : () => void deleteExpense.mutateAsync(row.id)}
                  deleteTitle="Verwijderen"
                  deleteButtonClassName="justify-self-end rounded p-1 text-slate-500 opacity-100 transition hover:text-rose-300 disabled:opacity-20 sm:justify-self-auto md:opacity-0 md:group-hover:opacity-100"
                >
                  <div className="flex min-w-0 items-center gap-2 md:contents">
                    <input
                      type="checkbox"
                      checked={row.paid}
                      disabled={isArchive}
                      onChange={() =>
                        void saveExpense({
                          id: row.id,
                          name: row.name,
                          amount: row.amount,
                          category: row.category,
                          paid: !row.paid,
                          sort_order: row.sort_order,
                        })
                      }
                      className="shrink-0"
                    />
                    <EditableField
                      value={row.name}
                      onSave={(v) =>
                        void saveExpense({
                          id: row.id,
                          name: v,
                          amount: row.amount,
                          category: row.category,
                          paid: row.paid,
                          sort_order: row.sort_order,
                        })
                      }
                      disabled={isArchive}
                      className="min-w-0 flex-1 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200 md:min-w-0 md:border-0 md:bg-transparent"
                    />
                  </div>
                  <select
                    value={row.category}
                    disabled={isArchive}
                    onChange={(e) =>
                      void saveExpense({
                        id: row.id,
                        name: row.name,
                        amount: row.amount,
                        category: e.target.value as BudgetCategory,
                        paid: row.paid,
                        sort_order: row.sort_order,
                      })
                    }
                    className="min-w-0 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-xs text-slate-200"
                  >
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <EditableField
                    value={row.amount.toFixed(2)}
                    onSave={(v) => {
                      const n = Number(v);
                      if (!Number.isFinite(n)) return;
                      void saveExpense({
                        id: row.id,
                        name: row.name,
                        amount: n,
                        category: row.category,
                        paid: row.paid,
                        sort_order: row.sort_order,
                      });
                    }}
                    type="number"
                    step="0.01"
                    disabled={isArchive}
                    align="right"
                    className="min-w-0 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200 md:border-0 md:bg-transparent"
                  />
                </CrudRow>
              ))}
              <div className="flex min-w-0 flex-col gap-2 pt-2 md:grid md:grid-cols-[minmax(0,1fr)_150px_120px_auto] md:gap-2">
                <input
                  type="text"
                  value={newExpenseName}
                  disabled={isArchive}
                  onChange={(e) => setNewExpenseName(e.target.value)}
                  placeholder="Uitgave toevoegen…"
                  className="min-w-0 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200"
                />
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] md:contents">
                  <select
                    value={newExpenseCategory}
                    disabled={isArchive}
                    onChange={(e) => setNewExpenseCategory(e.target.value as BudgetCategory)}
                    className="min-w-0 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-xs text-slate-200"
                  >
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={newExpenseAmount}
                    disabled={isArchive}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                    className="min-w-0 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-right text-sm text-slate-200"
                  />
                  <button
                    type="button"
                    disabled={isArchive}
                    onClick={() =>
                      void saveExpense({
                        name: newExpenseName,
                        amount: Number(newExpenseAmount || 0),
                        category: newExpenseCategory,
                        paid: false,
                        sort_order: data.expenses.length + 1,
                      }).then(() => {
                        setNewExpenseName('');
                        setNewExpenseAmount('');
                      })
                    }
                    className="shrink-0 justify-self-start rounded border border-codex-border px-2 py-1.5 text-slate-300 disabled:opacity-40 sm:justify-self-auto"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-codex-border bg-codex-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">Samenvatting</h2>
            <div className="mb-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <BudgetCurrentBalanceField monthData={data.month} isArchive={isArchive} updateMonth={updateMonth} />
              <span className="text-codex-muted">Te ontvangen</span>
              <span className="text-emerald-400">{formatEuro(summary.pending_income)}</span>
              <span className="text-codex-muted">Te betalen</span>
              <span className="text-rose-400">{formatEuro(summary.pending_expenses)}</span>
              <span className="font-medium text-slate-200">Projectie</span>
              <span className={summary.projected_balance < data.month.minimum_balance ? 'font-semibold text-rose-400' : 'text-slate-200'}>
                {formatEuro(summary.projected_balance)}
              </span>
              <span className="text-codex-muted">Minimum saldo</span>
              <input
                type="number"
                step="0.01"
                defaultValue={data.month.minimum_balance.toFixed(2)}
                disabled={isArchive}
                onBlur={(e) => void updateMonth.mutateAsync({ minimum_balance: Number(e.target.value) })}
                className="rounded border border-codex-border bg-codex-bg px-2 py-1 text-right text-slate-300"
              />
            </div>
            {summary.projected_balance < data.month.minimum_balance ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
                ⚠ Projectie ligt onder het minimum saldo
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-codex-border bg-codex-surface p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-300">Uitgaven per categorie</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                  >
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => formatEuro(Number(v ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
          )}

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AccountsPanel />
          <DebtsPanel />
        </div>
        </>
      )}
    </div>
  );
}
