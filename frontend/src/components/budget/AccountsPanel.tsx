import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CrudRow } from '../ui/CrudRow';
import { EditableField } from '../ui/EditableField';
import { useAccounts, useDeleteAccount, useUpsertAccount } from '../../hooks/useBudget';
import { formatAmountInputDisplay, parseAmountInput } from '../../lib/amountInput';
import { ACCOUNT_KINDS, type Account, type AccountKind } from '../../types';

function formatEuro(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
}

export function AccountsPanel() {
  const q = useAccounts();
  const upsert = useUpsertAccount();
  const del = useDeleteAccount();

  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<AccountKind>('checking');
  const [newBalance, setNewBalance] = useState('');

  const accounts = q.data?.items ?? [];
  const total = q.data?.total ?? 0;

  const save = async (row: { id?: number; name: string; kind: AccountKind; balance: number }) => {
    const name = row.name.trim();
    if (name === '') {
      return;
    }
    await upsert.mutateAsync({ ...row, name });
  };

  const handleAdd = async () => {
    const balance = parseAmountInput(newBalance);
    if (newName.trim() === '' || balance === null) {
      return;
    }
    await save({ name: newName, kind: newKind, balance });
    setNewName('');
    setNewBalance('');
    setNewKind('checking');
  };

  return (
    <section className="rounded-xl border border-codex-border bg-codex-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-200">Rekeningen</h2>
        <span className="text-sm font-medium text-slate-300">Totaal: {formatEuro(total)}</span>
      </div>

      <div className="space-y-1.5">
        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            onSave={(patch) =>
              void save({
                id: a.id,
                name: patch.name ?? a.name,
                kind: patch.kind ?? a.kind,
                balance: patch.balance ?? a.balance,
              })
            }
            onDelete={() => del.mutate(a.id)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-codex-border pt-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Naam"
          className="min-w-0 flex-1 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
        />
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as AccountKind)}
          className="rounded-md border border-codex-border bg-codex-bg px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-codex-accent"
        >
          {ACCOUNT_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <input
          value={newBalance}
          onChange={(e) => setNewBalance(e.target.value)}
          onBlur={() => {
            const n = parseAmountInput(newBalance);
            if (n !== null) {
              setNewBalance(formatAmountInputDisplay(n));
            }
          }}
          placeholder="0,00"
          inputMode="decimal"
          autoComplete="off"
          className="w-28 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
        />
        <button
          type="button"
          onClick={() => void handleAdd()}
          className="flex items-center gap-1 rounded-md border border-codex-border bg-codex-bg px-2.5 py-1.5 text-sm text-slate-200 hover:border-codex-accent"
        >
          <Plus size={14} /> Toevoegen
        </button>
      </div>
    </section>
  );
}

function AccountRow({
  account,
  onSave,
  onDelete,
}: {
  account: Account;
  onSave: (patch: { name?: string; kind?: AccountKind; balance?: number }) => void;
  onDelete: () => void;
}) {
  const [balanceDisplay, setBalanceDisplay] = useState(formatAmountInputDisplay(account.balance));

  useEffect(() => {
    setBalanceDisplay(formatAmountInputDisplay(account.balance));
  }, [account.id, account.balance]);

  const balanceNum = parseAmountInput(balanceDisplay);
  const balanceLooksNegative = balanceNum !== null && balanceNum < 0;

  return (
    <CrudRow onDelete={onDelete} deleteTitle="Rekening verwijderen">
      <EditableField
        value={account.name}
        onSave={(name) => onSave({ name })}
        className="flex-1"
      />
      <select
        value={account.kind}
        onChange={(e) => onSave({ kind: e.target.value as AccountKind })}
        className="rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-codex-muted hover:border-codex-border focus:outline-none"
      >
        {ACCOUNT_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <EditableField
        value={balanceDisplay}
        onSave={(v) => {
          const n = parseAmountInput(v);
          if (n === null) {
            setBalanceDisplay(formatAmountInputDisplay(account.balance));
            return;
          }
          if (n !== account.balance) {
            onSave({ balance: n });
          }
        }}
        inputMode="decimal"
        align="right"
        className={`w-28 ${balanceLooksNegative ? 'text-rose-400' : 'text-slate-100'}`}
      />
    </CrudRow>
  );
}
