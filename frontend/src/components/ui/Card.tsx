import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function Card({ className = '', children, ...rest }: Props) {
  return (
    <div
      className={`rounded-xl border border-codex-border bg-codex-surface p-4 shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
