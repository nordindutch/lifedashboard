import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDebts, useDeleteDebt, useUpsertDebt } from '../../hooks/useBudget';
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

/** Unpaid debt whose deadline is in the next 14 days (not yet passed). */
function isDeadlineApproaching(debt: Debt, now: number): boolean {
  if (debt.paid || debt.deadline === null) {
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
    const amount = Number(newAmount);
    if (newName.trim() === '' || Number.isNaN(amount)) {
      return;
    }
    await save({
      name: newName.trim(),
      amount,
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
        <h2 className="text-sm font-medium text-slate-200">Debts</h2>
        <span className="text-sm font-medium text-slate-300">
          Outstanding: {formatEuro(outstanding)}
        </span>
      </div>

      {hasApproaching ? (
        <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-900/20 px-3 py-2 text-xs text-rose-300">
          At least one unpaid debt has a deadline within the next 14 days.
        </div>
      ) : null}

      <div className="space-y-2">
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
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Debt name"
            className="min-w-0 flex-1 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
          />
          <input
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Amount"
            inputMode="decimal"
            className="w-28 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
          />
          <input
            type="date"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            className="rounded-md border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-codex-accent"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="flex items-center gap-1 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-200 hover:border-codex-accent"
          >
            <Plus size={14} /> Add
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
    deadline?: number | null;
    paid?: boolean;
    notes?: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(debt.name);
  const [amount, setAmount] = useState(String(debt.amount));
  const [deadlineStr, setDeadlineStr] = useState(tsToDateInput(debt.deadline));
  const [notes, setNotes] = useState(debt.notes ?? '');

  const urgent = isDeadlineApproaching(debt, now);

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-codex-border/50 bg-codex-bg/40 p-2 sm:flex-row sm:items-center sm:gap-2 ${
        urgent ? 'border-l-4 border-l-rose-500' : ''
      }`}
    >
      <label className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={debt.paid}
          onChange={() => onSave({ paid: !debt.paid })}
          className="rounded border-codex-border"
        />
        Paid
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() !== debt.name && onSave({ name: name.trim() })}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-100 hover:border-codex-border focus:border-codex-accent focus:outline-none"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          const n = Number(amount);
          if (!Number.isNaN(n) && n !== debt.amount) {
            onSave({ amount: n });
          }
        }}
        inputMode="decimal"
        className="w-28 rounded-md border border-transparent bg-transparent px-2 py-1 text-right text-sm text-slate-100 hover:border-codex-border focus:border-codex-accent focus:outline-none"
      />
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
        className="rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-slate-200 hover:border-codex-border focus:border-codex-accent focus:outline-none"
      />
      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => {
          if (notes !== (debt.notes ?? '')) {
            onSave({ notes: notes || null });
          }
        }}
        placeholder="Notes"
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-slate-300 placeholder:text-slate-600 hover:border-codex-border focus:border-codex-accent focus:outline-none sm:max-w-[10rem]"
      />
      <button
        type="button"
        onClick={onDelete}
        className="self-end rounded-md p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 sm:self-center"
        title="Delete debt"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
