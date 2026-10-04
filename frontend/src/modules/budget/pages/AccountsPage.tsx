import { useState } from 'react';
import type { Account, Debt } from '../../../types';
import { AccountSheet } from '../components/AccountSheet';
import { AccountsList } from '../components/AccountsList';
import { DebtCard } from '../components/DebtCard';
import { DebtSheet } from '../components/DebtSheet';
import { ErrorCard, LoadingCard } from '../components/StateCards';
import { useAccounts, useBudget, useDebts } from '../hooks/useBudget';
import { currentMonthKey, formatEuro } from '../lib/budgetMath';

/** Scherm 4: rekeningen en schulden op één scherm. */
export function AccountsPage() {
  const accountsQ = useAccounts();
  const debtsQ = useDebts();
  const monthQ = useBudget(currentMonthKey());
  const [accountSheet, setAccountSheet] = useState<{ open: boolean; account: Account | null }>({ open: false, account: null });
  const [debtSheet, setDebtSheet] = useState<{ open: boolean; debt: Debt | null }>({ open: false, debt: null });

  const accounts = accountsQ.data?.items ?? [];
  const debts = debtsQ.data?.items ?? [];
  const openDebts = debts.filter((d) => !d.paid);
  const paidDebts = debts.filter((d) => d.paid);
  const linkedId = monthQ.data?.month.current_balance_account_id ?? null;

  const addButton = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="h-11 px-1 text-[13px] font-bold text-codex-accent">
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-4 md:max-w-3xl md:p-6">
      <h1 className="px-1 pt-2 text-[22px] font-extrabold tracking-tight">Rekeningen</h1>

      <section className="grid grid-cols-2 gap-3 rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-label="Totalen">
        <div>
          <span className="codex-label block">Totaal vermogen</span>
          <span className="mt-1 block text-[26px] font-extrabold tracking-tight">{formatEuro(accountsQ.data?.total ?? 0)}</span>
        </div>
        <div className="text-right">
          <span className="codex-label block">Openstaande schuld</span>
          <span className="mt-1 block text-[26px] font-extrabold tracking-tight text-codex-risk">{formatEuro(debtsQ.data?.outstanding ?? 0)}</span>
          {(debtsQ.data?.monthly_interest ?? 0) > 0 ? (
            <span className="block text-xs font-bold text-codex-accent">+ {formatEuro(debtsQ.data?.monthly_interest ?? 0)} rente per maand</span>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="accounts-heading">
        <div className="flex items-center justify-between px-1">
          <h2 id="accounts-heading" className="codex-label">Rekeningen</h2>
          {addButton('Toevoegen', () => setAccountSheet({ open: true, account: null }))}
        </div>
        <div className="overflow-hidden rounded-card border border-codex-border bg-codex-surface">
          {accountsQ.isLoading ? <LoadingCard label="Rekeningen laden..." /> : null}
          {accountsQ.isError && !accountsQ.data ? (
            <ErrorCard message={accountsQ.error instanceof Error ? accountsQ.error.message : 'Fout'} onRetry={() => void accountsQ.refetch()} />
          ) : null}
          {accountsQ.data ? <AccountsList accounts={accounts} linkedCheckingId={linkedId} onEdit={(a) => setAccountSheet({ open: true, account: a })} /> : null}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="debts-heading">
        <div className="flex items-center justify-between px-1">
          <h2 id="debts-heading" className="codex-label">Schulden</h2>
          {addButton('Toevoegen', () => setDebtSheet({ open: true, debt: null }))}
        </div>
        <div className="flex flex-col gap-4 rounded-card border border-codex-border bg-codex-surface p-4">
          {debtsQ.isLoading ? <LoadingCard label="Schulden laden..." /> : null}
          {debtsQ.isError && !debtsQ.data ? (
            <ErrorCard message={debtsQ.error instanceof Error ? debtsQ.error.message : 'Fout'} onRetry={() => void debtsQ.refetch()} />
          ) : null}
          {debtsQ.data && openDebts.length === 0 ? <p className="text-sm text-codex-muted">Geen openstaande schulden.</p> : null}
          {openDebts.map((d, i) => (
            <div key={d.id} className={i > 0 ? 'border-t border-codex-border-soft pt-4' : ''}>
              <DebtCard debt={d} onEdit={() => setDebtSheet({ open: true, debt: d })} />
            </div>
          ))}
        </div>
        {paidDebts.length > 0 ? (
          <details className="rounded-card border border-codex-border bg-codex-surface">
            <summary className="flex min-h-touch cursor-pointer items-center px-4 text-sm font-semibold text-codex-muted">
              Afgeloste schulden ({paidDebts.length})
            </summary>
            <ul className="border-t border-codex-border-soft">
              {paidDebts.map((d) => (
                <li key={d.id} className="flex min-h-[52px] items-center justify-between gap-3 px-4 text-sm">
                  <span className="truncate text-codex-muted line-through">{d.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-bold text-codex-positive">{formatEuro(d.amount)}</span>
                    <button type="button" onClick={() => setDebtSheet({ open: true, debt: d })} className="min-h-touch text-xs font-bold text-codex-accent">
                      Wijzig
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <AccountSheet open={accountSheet.open} onClose={() => setAccountSheet((s) => ({ ...s, open: false }))} account={accountSheet.account} nextSortOrder={accounts.length + 1} />
      <DebtSheet open={debtSheet.open} onClose={() => setDebtSheet((s) => ({ ...s, open: false }))} debt={debtSheet.debt} nextSortOrder={debts.length + 1} />
    </div>
  );
}
