import { useEffect, useState } from 'react';
import { AmountField } from '../../../components/ui/AmountField';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import type { BudgetMonth } from '../../../types';
import { useAccounts, useUpdateBudgetMonth } from '../hooks/useBudget';
import { formatEuro } from '../lib/budgetMath';

type Props = {
  open: boolean;
  onClose: () => void;
  monthKey: string;
  month: BudgetMonth;
};

/** Saldo (handmatig of gekoppeld aan een betaalrekening) en minimumsaldo instellen. */
export function BalanceSettingsSheet({ open, onClose, monthKey, month }: Props) {
  const accountsQ = useAccounts();
  const update = useUpdateBudgetMonth(monthKey);
  const checking = (accountsQ.data?.items ?? []).filter((a) => a.kind === 'checking');

  const [accountId, setAccountId] = useState<number | null>(month.current_balance_account_id ?? null);
  const [balance, setBalance] = useState<number | null>(month.current_balance);
  const [minimum, setMinimum] = useState<number | null>(month.minimum_balance);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAccountId(month.current_balance_account_id ?? null);
      setBalance(month.current_balance);
      setMinimum(month.minimum_balance);
      setError(null);
    }
  }, [open, month]);

  const save = async () => {
    if (minimum === null || (accountId === null && balance === null)) {
      setError('Vul een geldig bedrag in.');
      return;
    }
    try {
      await update.mutateAsync({
        current_balance_account_id: accountId,
        ...(accountId === null ? { current_balance: balance ?? 0 } : {}),
        minimum_balance: minimum,
      });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const linked = accountId !== null ? checking.find((a) => a.id === accountId) : undefined;

  return (
    <BottomSheet open={open} onClose={onClose} title="Saldo en minimum">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="balance-source" className="codex-label">
            Bron voor huidig saldo
          </label>
          <select
            id="balance-source"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value === '' ? null : Number(e.target.value))}
            className="h-[52px] rounded-field border border-[#2c303b] bg-codex-surface-2 px-4 text-base font-medium outline-none focus:border-codex-accent"
          >
            <option value="">Handmatig invoeren</option>
            {checking.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatEuro(a.balance)})
              </option>
            ))}
          </select>
          {linked ? <p className="text-xs text-codex-muted">Volgt het saldo van {linked.name}.</p> : null}
        </div>

        {accountId === null ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="balance-amount" className="codex-label">
              Huidig saldo
            </label>
            <AmountField id="balance-amount" value={balance} onChange={(v) => setBalance(v)} />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="balance-minimum" className="codex-label">
            Minimumsaldo
          </label>
          <AmountField id="balance-minimum" value={minimum} onChange={(v) => setMinimum(v)} />
          <p className="text-xs text-codex-muted">De gele streep in de saldobalk. Daaronder krijg je een waarschuwing.</p>
        </div>

        {error ? <p className="text-sm text-codex-risk" role="alert">{error}</p> : null}

        <button
          type="submit"
          disabled={update.isPending}
          className="h-14 rounded-2xl bg-codex-accent text-base font-extrabold text-codex-accent-ink disabled:opacity-60"
        >
          Opslaan
        </button>
      </form>
    </BottomSheet>
  );
}
