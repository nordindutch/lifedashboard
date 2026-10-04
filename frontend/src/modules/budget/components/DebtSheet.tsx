import { useEffect, useState } from 'react';
import { AmountField } from '../../../components/ui/AmountField';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { ToggleSwitch } from '../../../components/ui/ToggleSwitch';
import { parseAmountInput } from '../../../lib/amountInput';
import type { Debt } from '../../../types';
import { useDeleteDebt, useUpsertDebt } from '../hooks/useBudget';

type Props = {
  open: boolean;
  onClose: () => void;
  debt: Debt | null;
  nextSortOrder: number;
  onDeleted?: () => void;
};

function tsToDateInput(ts: number | null): string {
  return ts === null ? '' : new Date(ts * 1000).toISOString().slice(0, 10);
}

function dateInputToUnix(d: string): number | null {
  return d.trim() === '' ? null : Math.floor(new Date(`${d}T12:00:00`).getTime() / 1000);
}

/** Schuld toevoegen of de gegevens wijzigen: naam, totaalbedrag, al afgelost, rente, deadline, meetellen. */
export function DebtSheet({ open, onClose, debt, nextSortOrder, onDeleted }: Props) {
  const upsert = useUpsertDebt();
  const del = useDeleteDebt();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState<number | null>(0);
  const [rate, setRate] = useState('0,00');
  const [deadline, setDeadline] = useState('');
  const [include, setInclude] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(debt?.name ?? '');
      setAmount(debt?.amount ?? null);
      setPaidAmount(debt?.paid_amount ?? 0);
      setRate((debt?.interest_rate_pct ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setDeadline(tsToDateInput(debt?.deadline ?? null));
      setInclude(debt?.include_interest_in_budget ?? false);
      setConfirmDelete(false);
      setError(null);
    }
  }, [open, debt]);

  const save = async () => {
    const ratePct = parseAmountInput(rate) ?? 0;
    if (name.trim() === '' || amount === null || amount <= 0) {
      setError('Naam en totaalbedrag zijn verplicht.');
      return;
    }
    if (ratePct < 0 || ratePct > 100) {
      setError('Rente moet tussen 0 en 100 procent liggen.');
      return;
    }
    try {
      await upsert.mutateAsync({
        id: debt?.id,
        name: name.trim(),
        amount,
        paid_amount: paidAmount ?? 0,
        deadline: dateInputToUnix(deadline),
        paid: (paidAmount ?? 0) >= amount,
        notes: debt?.notes ?? null,
        sort_order: debt?.sort_order ?? nextSortOrder,
        interest_rate_pct: ratePct,
        include_interest_in_budget: include && ratePct > 0,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const remove = async () => {
    if (!debt) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await del.mutateAsync(debt.id);
      onClose();
      onDeleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verwijderen mislukt');
    }
  };

  const field = 'h-[52px] rounded-field border border-[#2c303b] bg-codex-surface-2 px-4 text-base font-medium outline-none focus:border-codex-accent';

  return (
    <BottomSheet open={open} onClose={onClose} title={debt ? 'Schuld bewerken' : 'Schuld toevoegen'}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="debt-name" className="codex-label">Naam</label>
          <input id="debt-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijvoorbeeld Creditcard" className={field} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="debt-amount" className="codex-label">Totaal bedrag</label>
          <AmountField id="debt-amount" value={amount} onChange={setAmount} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="debt-paid" className="codex-label">Al afgelost</label>
          <AmountField id="debt-paid" value={paidAmount} onChange={setPaidAmount} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="debt-rate" className="codex-label">Rente per jaar (%)</label>
          <input id="debt-rate" type="text" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={`${field} text-right font-bold`} />
          <p className="text-xs text-codex-muted">Rente van de maand = openstaand saldo x percentage / 12.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="debt-deadline" className="codex-label">Deadline (optioneel)</label>
          <input id="debt-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`${field} codex-date-input`} />
        </div>
        <div className="rounded-field bg-codex-surface-2 px-4">
          <ToggleSwitch
            label="Rente meetellen in maandbudget"
            description="De maandrente verschijnt als uitgavepost bij Nog te betalen."
            checked={include}
            onChange={setInclude}
            className="min-h-[56px]"
          />
        </div>
        {error ? <p className="text-sm text-codex-risk" role="alert">{error}</p> : null}
        <div className="flex gap-2.5">
          {debt ? (
            <button
              type="button"
              onClick={() => void remove()}
              className={`h-14 rounded-2xl border px-5 text-[15px] font-bold ${confirmDelete ? 'border-codex-risk bg-codex-risk text-white' : 'border-codex-risk-border text-codex-risk'}`}
            >
              {confirmDelete ? 'Zeker?' : 'Verwijderen'}
            </button>
          ) : null}
          <button type="submit" disabled={upsert.isPending} className="h-14 flex-1 rounded-2xl bg-codex-accent text-base font-extrabold text-codex-accent-ink disabled:opacity-60">
            {debt ? 'Opslaan' : 'Voeg toe'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
