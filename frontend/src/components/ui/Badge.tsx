import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLSpanElement> & { children: ReactNode };

export function Badge({ className = '', children, ...rest }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-slate-200 ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
