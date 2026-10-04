import { CATEGORY_COLORS, type BudgetCategory } from '../../../types';
import { categoryBars, formatEuro } from '../lib/budgetMath';

type Props = {
  byCategory: readonly { category: BudgetCategory; amount: number }[];
  /** Extra regel, bijvoorbeeld rente op schulden */
  extra?: { label: string; amount: number; color: string }[];
};

/** Uitgaven per categorie als horizontale balken, kleur altijd met naam. */
export function CategoryBars({ byCategory, extra = [] }: Props) {
  const bars = categoryBars([
    ...byCategory,
    ...extra.map((e) => ({ category: e.label, amount: e.amount })),
  ]);
  if (bars.length === 0) {
    return <p className="text-sm text-codex-muted">Nog geen uitgaven deze maand.</p>;
  }
  const colorFor = (label: string): string =>
    (CATEGORY_COLORS as Record<string, string>)[label] ?? extra.find((e) => e.label === label)?.color ?? '#71717a';
  return (
    <ul className="flex flex-col gap-3.5">
      {bars.map((b) => (
        <li key={b.category} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3 text-[13px] font-semibold">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorFor(b.category) }} aria-hidden />
              <span className="truncate">{b.category}</span>
            </span>
            <span className="shrink-0">
              {formatEuro(b.amount)} <span className="text-codex-muted">({b.sharePct}%)</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-codex-border" role="img" aria-label={`${b.category}: ${b.sharePct} procent van de uitgaven`}>
            <div className="h-full rounded" style={{ width: `${b.widthPct}%`, backgroundColor: colorFor(b.category) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
