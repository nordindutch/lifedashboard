import { useEffect, useState } from 'react';
import { AmountField } from '../../../components/ui/AmountField';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import type { BudgetCategory, BudgetExpenseRow, BudgetIncomeRow } from '../../../types';
import { useDeleteExpense, useDeleteIncome, useUpsertExpense, useUpsertIncome } from '../hooks/useBudget';
import { CategoryChips } from './CategoryChips';

export type EditTarget = { kind: 'expense'; row: BudgetExpenseRow } | { kind: 'income'; row: BudgetIncomeRow };

type Props = {
  target: EditTarget | null;
  onClose: () => void;
  month: string;
};

/** Lade "Post bewerken": naam, bedrag, categorie, betaald-schakelaar, Verwijderen en Opslaan. */
export function EditItemSheet({ target, onClose, month }: Props) {
  const upsertExpense = useUpsertExpense(month);
  const upsertIncome = useUpsertIncome(month);
  const deleteExpense = useDeleteExpense(month);
  const deleteIncome = useDeleteIncome(month);

  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<BudgetCategory>('Vaste Last');
  const [done, setDone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setName(target.row.name);
      setAmount(target.row.amount);
      setCategory(target.kind === 'expense' ? target.row.category : 'Vaste Last');
      setDone(target.kind === 'expense' ? target.row.paid : target.row.received);
      setConfirmDelete(false);
      setError(null);
    }
  }, [target]);

  const pending = upsertExpense.isPending || upsertIncome.isPending || deleteExpense.isPending || deleteIncome.isPending;

  const save = async () => {
    if (!target || amount === null || name.trim() === '') {
      setError('Naam en bedrag zijn verplicht.');
      return;
    }
    setError(null);
    try {
      if (target.kind === 'expense') {
        await upsertExpense.mutateAsync({ id: target.row.id, name: name.trim(), amount, category, paid: done, sort_order: target.row.sort_order });
      } else {
        await upsertIncome.mutateAsync({ id: target.row.id, name: name.trim(), amount, received: done, sort_order: target.row.sort_order });
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const remove = async () => {
    if (!target) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      if (target.kind === 'expense') {
        await deleteExpense.mutateAsync(target.row.id);
      } else {
        await deleteIncome.mutateAsync(target.row.id);
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verwijderen mislukt');
    }
  };

  return (
    <BottomSheet open={target !== null} onClose={onClose} title="Post bewerken">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="edit-name" className="codex-label">
            Naam
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-[52px] rounded-field border border-[#2c303b] bg-codex-surface-2 px-4 text-base font-medium outline-none focus:border-codex-accent"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="edit-amount" className="codex-label">
            Bedrag
          </label>
          <AmountField id="edit-amount" value={amount} onChange={setAmount} />
        </div>

        {target?.kind === 'expense' ? (
          <div className="flex flex-col gap-2">
            <span className="codex-label">Categorie</span>
            <CategoryChips value={category} onChange={setCategory} />
          </div>
        ) : null}

        <div className="rounded-field bg-codex-surface-2 px-4">
          <ToggleSwitch checked={done} onChange={setDone} label={target?.kind === 'income' ? 'Ontvangen' : 'Betaald'} className="min-h-[56px]" />
        </div>

        {error ? <p className="text-sm text-codex-risk" role="alert">{error}</p> : null}

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => void remove()}
            disabled={pending}
            className={`h-14 rounded-2xl border px-5 text-[15px] font-bold disabled:opacity-60 ${
              confirmDelete ? 'border-codex-risk bg-codex-risk text-white' : 'border-codex-risk-border text-codex-risk'
            }`}
          >
            {confirmDelete ? 'Zeker?' : 'Verwijderen'}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-14 flex-1 rounded-2xl bg-codex-accent text-base font-extrabold text-codex-accent-ink disabled:opacity-60"
          >
            Opslaan
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
