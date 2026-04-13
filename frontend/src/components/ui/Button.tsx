import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  children: ReactNode;
};

export function Button({ variant = 'primary', className = '', ...rest }: Props) {
  const base =
    'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50';
  const styles =
    variant === 'primary'
      ? 'bg-codex-accent text-codex-bg hover:opacity-90'
      : variant === 'danger'
        ? 'bg-red-600/90 text-white hover:bg-red-600'
        : 'bg-transparent text-slate-200 hover:bg-white/5';
  return <button type="button" className={`${base} ${styles} ${className}`} {...rest} />;
}
