import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { formatAmountInputDisplay, parseAmountInput } from '../../lib/amountInput';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> & {
  /** Huidige waarde in euro's, null is leeg */
  value: number | null;
  /** Wordt aangeroepen bij elke geldige wijziging, null als het veld leeg of ongeldig is */
  onChange: (value: number | null, raw: string) => void;
  /** Groot (lade Snel toevoegen) of normaal */
  size?: 'lg' | 'md';
  invalid?: boolean;
};

/**
 * Bedragveld in Nederlandse notatie (komma als decimaalteken). Toont tabelcijfers,
 * formatteert netjes bij verlaten van het veld.
 */
export function AmountField({ value, onChange, size = 'md', invalid = false, className = '', id, ...rest }: Props) {
  const [raw, setRaw] = useState(value === null ? '' : formatAmountInputDisplay(value));

  useEffect(() => {
    // Alleen synchroniseren als de getypte tekst een andere waarde voorstelt
    const parsed = parseAmountInput(raw);
    if (value === null && raw === '') {
      return;
    }
    if (value !== null && parsed !== null && Math.abs(parsed - value) < 0.005) {
      return;
    }
    setRaw(value === null ? '' : formatAmountInputDisplay(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const sizeClass =
    size === 'lg'
      ? 'text-[44px] font-extrabold tracking-tight'
      : 'h-[52px] rounded-field border bg-codex-surface-2 px-4 text-lg font-bold';
  const borderClass = invalid ? 'border-codex-risk' : 'border-[#2c303b] focus:border-codex-accent';

  return (
    <div className={`flex items-center gap-2 ${size === 'lg' ? 'justify-center' : ''} ${className}`}>
      <span className={`font-semibold text-codex-muted ${size === 'lg' ? 'text-[28px]' : 'text-base'}`} aria-hidden>
        €
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={raw}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setRaw(next);
          onChange(parseAmountInput(next), next);
        }}
        onBlur={() => {
          const parsed = parseAmountInput(raw);
          if (parsed !== null) {
            setRaw(formatAmountInputDisplay(parsed));
          }
        }}
        className={`min-w-0 bg-transparent text-right text-codex-text outline-none placeholder:text-codex-muted-2 ${
          size === 'lg' ? 'w-[200px] text-left' : `flex-1 ${borderClass}`
        } ${sizeClass}`}
        {...rest}
      />
    </div>
  );
}
