import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AmountField } from '../../../components/ui/AmountField';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import type { BudgetCategory } from '../../../types';
import { useUpsertExpense, useUpsertIncome } from '../hooks/useBudget';
import { CategoryChips } from './CategoryChips';

type Kind = 'expense' | 'income';

type Props = {
  open: boolean;
  onClose: () => void;
  month: string;
  nextSortOrder: number;
  defaultKind?: Kind;
};

/** Lade "Snel toevoegen": eerst bedrag, dan naam, dan categorie, schakelaar Uitgave/Inkomen, Al betaald. */
export function QuickAddSheet({ open, onClose, month, nextSortOrder, defaultKind = 'expense' }: Props) {
  const upsertExpense = useUpsertExpense(month);
  const upsertIncome = useUpsertIncome(month);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [amount, setAmount] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BudgetCategory>('Persoonlijk');
  const [alreadyDone, setAlreadyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setKind(defaultKind);
      setAmount(null);
      setName('');
      setCategory('Persoonlijk');
      setAlreadyDone(false);
      setError(null);
      setTouched(false);
    }
  }, [open, defaultKind]);

  const pending = upsertExpense.isPending || upsertIncome.isPending;
  const amountInvalid = touched && (amount === null || amount <= 0);
  const nameInvalid = touched && name.trim() === '';

  const submit = async () => {
    setTouched(true);
    if (amount === null || amount <= 0 || name.trim() === '') {
      return;
    }
    setError(null);
    try {
      if (kind === 'expense') {
        await upsertExpense.mutateAsync({ name: name.trim(), amount, category, paid: alreadyDone, sort_order: nextSortOrder });
      } else {
        await upsertIncome.mutateAsync({ name: name.trim(), amount, received: alreadyDone, sort_order: nextSortOrder });
      }
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const segment = (k: Kind, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={kind === k}
      onClick={() => setKind(k)}
      className={`h-11 flex-1 rounded-[10px] text-[15px] ${kind === k ? 'bg-codex-border font-bold text-white' : 'font-semibold text-codex-muted'}`}
    >
      {label}
    </button>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="Snel toevoegen" hideTitle>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div role="tablist" aria-label="Soort post" className="flex rounded-field bg-codex-surface-2 p-1">
          {segment('expense', 'Uitgave')}
          {segment('income', 'Inkomen')}
        </div>

        <div className="text-center">
          <label htmlFor="qa-amount" className="codex-label">
            Bedrag
          </label>
          <AmountField id="qa-amount" size="lg" value={amount} onChange={setAmount} placeholder="0,00" invalid={amountInvalid} autoFocus />
          {amountInvalid ? <p className="mt-1 text-xs text-codex-risk" role="alert">Vul een bedrag groter dan nul in.</p> : null}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="qa-name" className="codex-label">
            Naam
          </label>
          <input
            id="qa-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === 'expense' ? 'Bijvoorbeeld Boodschappen' : 'Bijvoorbeeld Salaris'}
            aria-invalid={nameInvalid || undefined}
            className={`h-[52px] rounded-field border bg-codex-surface-2 px-4 text-base font-medium outline-none focus:border-codex-accent ${nameInvalid ? 'border-codex-risk' : 'border-[#2c303b]'}`}
          />
          {nameInvalid ? <p className="text-xs text-codex-risk" role="alert">Geef de post een naam.</p> : null}
        </div>

        {kind === 'expense' ? (
          <div className="flex flex-col gap-2">
            <span className="codex-label">Categorie</span>
            <CategoryChips value={category} onChange={setCategory} />
          </div>
        ) : null}

        <button
          type="button"
          role="checkbox"
          aria-checked={alreadyDone}
          onClick={() => setAlreadyDone((v) => !v)}
          className="flex h-11 items-center gap-2.5 self-start text-sm font-semibold text-[#c8ccd6]"
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${alreadyDone ? 'border-codex-positive bg-codex-positive' : 'border-codex-muted-2'}`}
            aria-hidden
          >
            {alreadyDone ? <Check className="h-3.5 w-3.5 text-codex-bg" strokeWidth={3.5} /> : null}
          </span>
          {kind === 'expense' ? 'Al betaald' : 'Al ontvangen'}
        </button>

        {error ? <p className="text-sm text-codex-risk" role="alert">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="h-14 rounded-2xl bg-codex-accent text-base font-extrabold text-codex-accent-ink disabled:opacity-60"
        >
          {pending ? 'Bezig...' : 'Voeg toe'}
        </button>
      </form>
    </BottomSheet>
  );
}
