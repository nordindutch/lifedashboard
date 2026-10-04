import { BUDGET_CATEGORIES, CATEGORY_COLORS, type BudgetCategory } from '../../../types';

type Props = {
  value: BudgetCategory;
  onChange: (c: BudgetCategory) => void;
  disabled?: boolean;
  name?: string;
};

/** Categorie als radiogroep van chips: kleur altijd met naam erbij. */
export function CategoryChips({ value, onChange, disabled = false, name = 'categorie' }: Props) {
  return (
    <div role="radiogroup" aria-label="Categorie" className="flex flex-wrap gap-2">
      {BUDGET_CATEGORIES.map((c) => {
        const on = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={on}
            name={name}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
              on ? 'border-codex-accent bg-[#1d2130] text-white' : 'border-[#2c303b] text-[#c8ccd6] hover:border-codex-muted'
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} aria-hidden />
            {c}
          </button>
        );
      })}
    </div>
  );
}

export function CategoryDot({ category, className = '' }: { category: BudgetCategory; className?: string }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: CATEGORY_COLORS[category] }}
      aria-hidden
    />
  );
}
