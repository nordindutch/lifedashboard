import { useEffect, useState } from 'react';

interface Props {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'date';
  step?: string;
  className?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  align?: 'left' | 'right';
  disabled?: boolean;
}

/**
 * Text/number input that saves on blur, only if the value changed.
 * Used throughout Budget and Accounts rows.
 */
export function EditableField({
  value,
  onSave,
  placeholder,
  type = 'text',
  step,
  className,
  inputMode,
  align = 'left',
  disabled = false,
}: Props) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = () => {
    const trimmed = local.trim();
    if (trimmed !== value.trim()) onSave(trimmed);
  };

  const alignClass = align === 'right' ? 'text-right' : 'text-left';

  return (
    <input
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      inputMode={inputMode}
      step={step}
      disabled={disabled}
      className={`min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 ${alignClass} text-sm text-slate-100 hover:border-codex-border focus:border-codex-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${className ?? ''}`}
    />
  );
}
