import { useEffect, useState } from 'react';
import { AmountField } from '../../../components/ui/AmountField';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { ACCOUNT_KINDS, type Account, type AccountKind } from '../../../types';
import { useDeleteAccount, useUpsertAccount } from '../hooks/useBudget';

type Props = {
  open: boolean;
  onClose: () => void;
  account: Account | null;
  nextSortOrder: number;
};

export function AccountSheet({ open, onClose, account, nextSortOrder }: Props) {
  const upsert = useUpsertAccount();
  const del = useDeleteAccount();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AccountKind>('checking');
  const [balance, setBalance] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(account?.name ?? '');
      setKind(account?.kind ?? 'checking');
      setBalance(account?.balance ?? null);
      setConfirmDelete(false);
      setError(null);
    }
  }, [open, account]);

  const save = async () => {
    if (name.trim() === '' || balance === null) {
      setError('Naam en saldo zijn verplicht.');
      return;
    }
    try {
      await upsert.mutateAsync({ id: account?.id, name: name.trim(), kind, balance, sort_order: account?.sort_order ?? nextSortOrder });
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const remove = async () => {
    if (!account) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await del.mutateAsync(account.id);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Verwijderen mislukt');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={account ? 'Rekening bewerken' : 'Rekening toevoegen'}>
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="acc-name" className="codex-label">
            Naam
          </label>
          <input
            id="acc-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bijvoorbeeld Betaalrekening"
            className="h-[52px] rounded-field border border-[#2c303b] bg-codex-surface-2 px-4 text-base font-medium outline-none focus:border-codex-accent"
          />
        </div>
        <div className="flex flex-col gap-2">
          <span className="codex-label">Soort</span>
          <div role="radiogroup" aria-label="Soort rekening" className="flex flex-wrap gap-2">
            {ACCOUNT_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={kind === k.value}
                onClick={() => setKind(k.value)}
                className={`h-11 rounded-full border px-4 text-sm font-semibold ${
                  kind === k.value ? 'border-codex-accent bg-[#1d2130] text-white' : 'border-[#2c303b] text-[#c8ccd6]'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="acc-balance" className="codex-label">
            Saldo
          </label>
          <AmountField id="acc-balance" value={balance} onChange={setBalance} />
        </div>
        {error ? <p className="text-sm text-codex-risk" role="alert">{error}</p> : null}
        <div className="flex gap-2.5">
          {account ? (
            <button
              type="button"
              onClick={() => void remove()}
              className={`h-14 rounded-2xl border px-5 text-[15px] font-bold ${confirmDelete ? 'border-codex-risk bg-codex-risk text-white' : 'border-codex-risk-border text-codex-risk'}`}
            >
              {confirmDelete ? 'Zeker?' : 'Verwijderen'}
            </button>
          ) : null}
          <button type="submit" disabled={upsert.isPending} className="h-14 flex-1 rounded-2xl bg-codex-accent text-base font-extrabold text-codex-accent-ink disabled:opacity-60">
            {account ? 'Opslaan' : 'Voeg toe'}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
