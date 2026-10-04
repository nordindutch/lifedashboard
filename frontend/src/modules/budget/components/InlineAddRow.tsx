import { useState } from 'react';
import { parseAmountInput } from '../../../lib/amountInput';
import { BUDGET_CATEGORIES, type BudgetCategory } from '../../../types';
import { useUpsertExpense, useUpsertIncome } from '../hooks/useBudget';

type Props = {
  kind: 'expense' | 'income';
  month: string;
  nextSortOrder: number;
};

/** Desktop: toevoegregel onderaan de tabel (naam, categorie, bedrag, Voeg toe). */
export function InlineAddRow({ kind, month, nextSortOrder }: Props) {
  const upsertExpense = useUpsertExpense(month);
  const upsertIncome = useUpsertIncome(month);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('Persoonlijk');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pending = upsertExpense.isPending || upsertIncome.isPending;

  const submit = async () => {
    const n = parseAmountInput(amount);
    if (name.trim() === '' || n === null || n <= 0) {
      setError('Vul een naam en een bedrag groter dan nul in.');
      return;
    }
    setError(null);
    try {
      if (kind === 'expense') {
        await upsertExpense.mutateAsync({ name: name.trim(), amount: n, category, paid: false, sort_order: nextSortOrder });
      } else {
        await upsertIncome.mutateAsync({ name: name.trim(), amount: n, received: false, sort_order: nextSortOrder });
      }
      setName('');
      setAmount('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const input = 'h-10 rounded-[10px] border border-[#2c303b] bg-codex-surface-2 px-3 text-sm outline-none focus:border-codex-accent';

  return (
    <form
      className="flex flex-wrap items-center gap-2.5 border-t border-codex-border-soft bg-[#11131a] px-4 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      aria-label={kind === 'expense' ? 'Nieuwe uitgave' : 'Nieuw inkomen'}
    >
      <input
        type="text"
        aria-label="Naam"
        placeholder={kind === 'expense' ? 'Nieuwe uitgave' : 'Nieuw inkomen'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`${input} min-w-[160px] flex-1`}
      />
      {kind === 'expense' ? (
        <select aria-label="Categorie" value={category} onChange={(e) => setCategory(e.target.value as BudgetCategory)} className={`${input} w-[150px]`}>
          {BUDGET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : null}
      <input
        type="text"
        inputMode="decimal"
        aria-label="Bedrag"
        placeholder="€ 0,00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className={`${input} w-[110px] text-right`}
      />
      <button type="submit" disabled={pending} className="h-10 rounded-xl bg-codex-accent px-4 text-sm font-extrabold text-codex-accent-ink disabled:opacity-60">
        Voeg toe
      </button>
      {error ? <p className="w-full text-xs text-codex-risk" role="alert">{error}</p> : null}
    </form>
  );
}
