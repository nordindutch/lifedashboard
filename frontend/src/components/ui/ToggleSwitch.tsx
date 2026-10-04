import { useId } from 'react';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

/** Schakelaar met echt label en 44 px hoog aanraakdoel. */
export function ToggleSwitch({ checked, onChange, label, description, disabled = false, className = '' }: Props) {
  const id = useId();
  return (
    <div className={`flex min-h-touch items-center justify-between gap-3 ${className}`}>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-semibold">{label}</span>
        {description ? <span className="block text-xs text-codex-muted">{description}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-codex-accent' : 'bg-[#2c303b]'
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all ${
            checked ? 'left-[23px] bg-codex-accent-ink' : 'left-[3px] bg-codex-muted'
          }`}
        />
      </button>
    </div>
  );
}
