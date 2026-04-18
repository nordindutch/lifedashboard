import { Calendar, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useDebts, useDeleteDebt, useUpsertDebt } from '../../hooks/useBudget';
import { formatAmountInputDisplay, parseAmountInput } from '../../lib/amountInput';
import type { Debt } from '../../types';

const FOURTEEN_DAYS_SEC = 14 * 86400;

function formatEuro(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
}

function tsToDateInput(ts: number | null): string {
  if (ts === null) {
    return '';
  }
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function dateInputToUnix(d: string): number | null {
  if (d.trim() === '') {
    return null;
  }
  return Math.floor(new Date(`${d}T12:00:00`).getTime() / 1000);
}

/** Unpaid debt with balance left whose deadline is in the next 14 days. */
function isDeadlineApproaching(debt: Debt, now: number): boolean {
  if (debt.paid || debt.remaining <= 0 || debt.deadline === null) {
    return false;
  }
  const d = debt.deadline;
  return d >= now && d - now <= FOURTEEN_DAYS_SEC;
}

export function DebtsPanel() {
  const q = useDebts();
  const upsert = useUpsertDebt();
  const del = useDeleteDebt();

  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  const items = q.data?.items ?? [];
  const outstanding = q.data?.outstanding ?? 0;
  const now = Math.floor(Date.now() / 1000);

  const hasApproaching = useMemo(
    () => items.some((d) => isDeadlineApproaching(d, now)),
    [items, now],
  );

  const save = async (row: {
    id?: number;
    name: string;
    amount: number;
    paid_amount?: number;
    deadline: number | null;
    paid: boolean;
    notes?: string | null;
    sort_order?: number;
  }) => {
    const name = row.name.trim();
    if (name === '') {
      return;
    }
    await upsert.mutateAsync({ ...row, name });
  };

  const handleAdd = async () => {
    const amount = parseAmountInput(newAmount);
    if (newName.trim() === '' || amount === null) {
      return;
    }
    await save({
      name: newName.trim(),
      amount,
      paid_amount: 0,
      deadline: dateInputToUnix(newDeadline),
      paid: false,
      sort_order: items.length + 1,
    });
    setNewName('');
    setNewAmount('');
    setNewDeadline('');
  };

  return (
    <section className="rounded-xl border border-codex-border bg-codex-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-200">Schulden</h2>
        <span className="text-sm font-medium text-slate-300">
          Openstaand: {formatEuro(outstanding)}
        </span>
      </div>

      {hasApproaching ? (
        <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          At least one unpaid debt has a deadline within the next 14 days.
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((d) => (
          <DebtRow
            key={d.id}
            debt={d}
            now={now}
            onSave={(patch) =>
              void save({
                id: d.id,
                name: patch.name ?? d.name,
                amount: patch.amount ?? d.amount,
                paid_amount: patch.paid_amount ?? d.paid_amount,
                deadline: patch.deadline !== undefined ? patch.deadline : d.deadline,
                paid: patch.paid ?? d.paid,
                notes: patch.notes !== undefined ? patch.notes : d.notes,
                sort_order: d.sort_order,
              })
            }
            onDelete={() => del.mutate(d.id)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-codex-border pt-3">
        <div className="flex flex-wrap items-end gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Naam"
            className="min-w-0 flex-1 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
          />
          <input
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            onBlur={() => {
              const n = parseAmountInput(newAmount);
              if (n !== null) {
                setNewAmount(formatAmountInputDisplay(n));
              }
            }}
            placeholder="0,00"
            inputMode="decimal"
            autoComplete="off"
            className="w-24 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
          />
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0 text-white opacity-90" aria-hidden />
            <input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="codex-date-input rounded-md border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-codex-accent"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="flex items-center gap-1 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-200 hover:border-codex-accent"
          >
            <Plus size={14} /> Toevoegen
          </button>
        </div>
      </div>
    </section>
  );
}

function DebtRow({
  debt,
  now,
  onSave,
  onDelete,
}: {
  debt: Debt;
  now: number;
  onSave: (patch: {
    name?: string;
    amount?: number;
    paid_amount?: number;
    deadline?: number | null;
    paid?: boolean;
    notes?: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(debt.name);
  const [amount, setAmount] = useState(formatAmountInputDisplay(debt.amount));
  const [deadlineStr, setDeadlineStr] = useState(tsToDateInput(debt.deadline));
  const [notes, setNotes] = useState(debt.notes ?? '');
  const [partialPay, setPartialPay] = useState('');

  useEffect(() => {
    setName(debt.name);
    setAmount(formatAmountInputDisplay(debt.amount));
    setDeadlineStr(tsToDateInput(debt.deadline));
    setNotes(debt.notes ?? '');
  }, [debt.id, debt.name, debt.amount, debt.deadline, debt.notes, debt.paid_amount, debt.updated_at]);

  const urgent = isDeadlineApproaching(debt, now);

  const applyPartialPayment = () => {
    const add = parseAmountInput(partialPay);
    if (add === null || add <= 0) {
      return;
    }
    const next = Math.min(debt.amount, debt.paid_amount + add);
    if (next !== debt.paid_amount) {
      onSave({ paid_amount: next });
    }
    setPartialPay('');
  };

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-codex-border/50 bg-codex-bg/40 p-3 ${
        urgent ? 'border-l-4 border-l-rose-500' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={debt.paid}
            onChange={() => onSave({ paid: !debt.paid })}
            className="rounded border-codex-border"
          />
          Afgelost
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== debt.name && onSave({ name: name.trim() })}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-100 hover:border-codex-border focus:border-codex-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={onDelete}
          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
          title="Schuld verwijderen"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-codex-muted">Totaal</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => {
              const n = parseAmountInput(amount);
              if (n === null) {
                setAmount(formatAmountInputDisplay(debt.amount));
                return;
              }
              setAmount(formatAmountInputDisplay(n));
              if (n !== debt.amount) {
                onSave({ amount: n });
              }
            }}
            inputMode="decimal"
            autoComplete="off"
            className="w-24 rounded-md border border-codex-border/60 bg-codex-bg px-2 py-1 text-right text-sm text-slate-100 focus:border-codex-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-codex-muted">Paid</span>
          <span className="min-w-[4.5rem] text-sm text-slate-300">{formatEuro(debt.paid_amount)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-codex-muted">Resterend</span>
          <span
            className={`min-w-[4.5rem] text-sm font-medium ${
              debt.remaining > 0 ? 'text-amber-200' : 'text-emerald-400'
            }`}
          >
            {formatEuro(debt.remaining)}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-codex-muted">Deelbetaling</span>
          <div className="flex items-center gap-1">
            <input
              value={partialPay}
              onChange={(e) => setPartialPay(e.target.value)}
              onBlur={() => {
                const n = parseAmountInput(partialPay);
                if (n !== null) {
                  setPartialPay(formatAmountInputDisplay(n));
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyPartialPayment();
                }
              }}
              placeholder="0,00"
              inputMode="decimal"
              autoComplete="off"
              className="w-20 rounded-md border border-codex-border bg-codex-bg px-2 py-1 text-right text-sm text-slate-100 placeholder:text-slate-600 focus:border-codex-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => applyPartialPayment()}
              disabled={debt.remaining <= 0 || debt.paid}
              className="rounded-md border border-codex-border bg-codex-surface px-2 py-1 text-xs text-slate-200 hover:border-codex-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              Betalen
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wide text-codex-muted">Vervaldatum</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 shrink-0 text-white opacity-90" aria-hidden />
            <input
              type="date"
              value={deadlineStr}
              onChange={(e) => setDeadlineStr(e.target.value)}
              onBlur={() => {
                const next = dateInputToUnix(deadlineStr);
                const prev = debt.deadline;
                const same =
                  (next === null && prev === null) ||
                  (next !== null && prev !== null && next === prev);
                if (!same) {
                  onSave({ deadline: next });
                }
              }}
              className="codex-date-input rounded-md border border-codex-border/60 bg-codex-bg px-2 py-1 text-sm text-slate-200 focus:border-codex-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== (debt.notes ?? '')) {
            onSave({ notes: notes || null });
          }
        }}
        placeholder="Notities"
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-300 placeholder:text-slate-600 hover:border-codex-border focus:border-codex-accent focus:outline-none"
      />
    </div>
  );
}
