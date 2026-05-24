import { X } from 'lucide-react';
import { useUiStore } from '../../stores/uiStore';

const toneClasses = {
  info: 'border-codex-border bg-codex-surface text-slate-200',
  success: 'border-emerald-500/40 bg-emerald-950/80 text-emerald-100',
  error: 'border-rose-500/40 bg-rose-950/80 text-rose-100',
} as const;

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(var(--codex-bottom-nav-height,0px)+1rem+env(safe-area-inset-bottom,0px))] right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-6"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm shadow-lg ${toneClasses[toast.tone ?? 'info']}`}
        >
          <p className="flex-1 leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            aria-label="Melding sluiten"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
