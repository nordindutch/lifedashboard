import { Check, Percent } from 'lucide-react';
import type { BudgetCategory } from '../../../types';
import { formatEuro } from '../lib/budgetMath';
import { CategoryDot } from './CategoryChips';

export type RowItem = {
  key: string;
  name: string;
  amount: number;
  done: boolean;
  /** Uitgave met categorie, inkomen zonder */
  category?: BudgetCategory;
  subtitle?: string;
  /** Rente-regels zijn automatisch en niet af te vinken */
  kind: 'expense' | 'income' | 'interest';
};

type Props = {
  item: RowItem;
  onToggle?: () => void;
  onOpen?: () => void;
  readOnly?: boolean;
  /** Compacte desktoprij (52 px) of mobiel (56 px) */
  dense?: boolean;
};

/** Eén post: afvinkrondje (44 px aanraakdoel), kleurstip met naam, bedrag. */
export function ItemRow({ item, onToggle, onOpen, readOnly = false, dense = false }: Props) {
  const toggleLabel = item.kind === 'income'
    ? item.done ? `${item.name} markeren als niet ontvangen` : `${item.name} markeren als ontvangen`
    : item.done ? `${item.name} markeren als niet betaald` : `${item.name} markeren als betaald`;
  const canToggle = !readOnly && item.kind !== 'interest' && onToggle;
  const canOpen = !readOnly && item.kind !== 'interest' && onOpen;
  const nameClass = item.done ? 'line-through text-codex-muted' : '';

  return (
    <li className={`flex items-center gap-2.5 border-t border-codex-border-soft first:border-t-0 ${dense ? 'min-h-[52px] pl-1 pr-4' : 'min-h-row pl-0.5 pr-3.5'}`}>
      {item.kind === 'interest' ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden>
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-codex-accent/60 text-codex-accent">
            <Percent className="h-3 w-3" strokeWidth={3} />
          </span>
        </span>
      ) : (
        <button
          type="button"
          onClick={canToggle ? onToggle : undefined}
          disabled={!canToggle}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:cursor-default"
          aria-label={toggleLabel}
          aria-pressed={item.done}
        >
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
              item.done ? 'border-codex-positive bg-codex-positive' : 'border-codex-muted-2'
            } ${!canToggle ? 'opacity-60' : ''}`}
            aria-hidden
          >
            {item.done ? <Check className="h-3.5 w-3.5 text-codex-bg" strokeWidth={3.5} /> : null}
          </span>
        </button>
      )}

      {item.category ? <CategoryDot category={item.category} /> : <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-codex-positive" aria-hidden />}

      {canOpen ? (
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 py-2 text-left" aria-label={`${item.name} bewerken`}>
          <span className={`block truncate text-[15px] font-semibold ${nameClass}`}>{item.name}</span>
          {item.subtitle ? <span className="block truncate text-xs text-codex-muted">{item.subtitle}</span> : null}
        </button>
      ) : (
        <div className="min-w-0 flex-1 py-2">
          <span className={`block truncate text-[15px] font-semibold ${nameClass}`}>{item.name}</span>
          {item.subtitle ? <span className="block truncate text-xs text-codex-muted">{item.subtitle}</span> : null}
        </div>
      )}

      <span className={`shrink-0 text-[15px] ${item.done ? 'text-codex-muted' : 'font-bold'}`}>{formatEuro(item.amount)}</span>
    </li>
  );
}

type SectionProps = {
  title: string;
  count?: number;
  items: RowItem[];
  emptyText?: string;
  onToggle?: (item: RowItem) => void;
  onOpen?: (item: RowItem) => void;
  readOnly?: boolean;
  muted?: boolean;
};

export function ItemSection({ title, count, items, emptyText, onToggle, onOpen, readOnly, muted = false }: SectionProps) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={title}>
      <h2 className="codex-label px-1">
        {title}
        {count !== undefined ? `, ${count}` : ''}
      </h2>
      <ul className={`overflow-hidden rounded-card border border-codex-border bg-codex-surface ${muted ? 'opacity-80' : ''}`}>
        {items.length === 0 && emptyText ? (
          <li className="px-4 py-4 text-sm text-codex-muted">{emptyText}</li>
        ) : (
          items.map((it) => (
            <ItemRow
              key={it.key}
              item={it}
              readOnly={readOnly}
              onToggle={onToggle ? () => onToggle(it) : undefined}
              onOpen={onOpen ? () => onOpen(it) : undefined}
            />
          ))
        )}
      </ul>
    </section>
  );
}
