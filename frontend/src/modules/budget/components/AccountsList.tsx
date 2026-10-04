import { Banknote, Landmark, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { ACCOUNT_KINDS, type Account, type AccountKind } from '../../../types';
import { formatEuro } from '../lib/budgetMath';

const KIND_ICON: Record<AccountKind, typeof Wallet> = {
  checking: Landmark,
  savings: PiggyBank,
  cash: Banknote,
  investment: TrendingUp,
  other: Wallet,
};

export function accountKindLabel(kind: AccountKind): string {
  return ACCOUNT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

type Props = {
  accounts: Account[];
  onEdit?: (a: Account) => void;
  linkedCheckingId?: number | null;
  compact?: boolean;
};

export function AccountsList({ accounts, onEdit, linkedCheckingId = null, compact = false }: Props) {
  if (accounts.length === 0) {
    return <p className="px-4 py-4 text-sm text-codex-muted">Nog geen rekeningen. Voeg je betaalrekening toe om je saldo te volgen.</p>;
  }
  if (compact) {
    return (
      <ul className="flex flex-col gap-3.5 text-sm">
        {accounts.map((a) => (
          <li key={a.id} className="flex justify-between gap-3">
            <span className="truncate">{a.name}</span>
            <span className="shrink-0 font-bold">{formatEuro(a.balance)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul>
      {accounts.map((a) => {
        const Icon = KIND_ICON[a.kind];
        const subtitle = a.id === linkedCheckingId ? 'Volgt je maandsaldo' : accountKindLabel(a.kind);
        const inner = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1d2130]">
              <Icon className="h-[18px] w-[18px] text-[#c8ccd6]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[15px] font-semibold">{a.name}</span>
              <span className="block text-xs text-codex-muted">{subtitle}</span>
            </span>
            <span className={`shrink-0 text-[15px] font-bold ${a.balance < 0 ? 'text-codex-risk' : ''}`}>{formatEuro(a.balance)}</span>
          </>
        );
        return (
          <li key={a.id} className="border-t border-codex-border-soft first:border-t-0">
            {onEdit ? (
              <button type="button" onClick={() => onEdit(a)} className="flex min-h-[60px] w-full items-center gap-3 px-4 hover:bg-white/5" aria-label={`${a.name} bewerken`}>
                {inner}
              </button>
            ) : (
              <div className="flex min-h-[60px] items-center gap-3 px-4">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
