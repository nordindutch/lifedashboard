import { Copy, RefreshCw } from 'lucide-react';

export function LoadingCard({ label = 'Budget laden...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-card border border-codex-border bg-codex-surface p-8 text-sm text-codex-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-codex-border border-t-codex-accent" aria-hidden />
      {label}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-card border border-codex-risk-border bg-codex-risk-bg p-5" role="alert">
      <p className="text-sm font-semibold text-[#f5c2c5]">Niet bijgewerkt</p>
      <p className="text-sm text-[#f5c2c5]/80">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-11 items-center gap-2 rounded-xl border border-codex-risk-border px-4 text-sm font-bold text-codex-risk"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Opnieuw proberen
      </button>
    </div>
  );
}

export function EmptyMonthCard({ onCopy, pending, canCopy }: { onCopy: () => void; pending: boolean; canCopy: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-codex-border bg-codex-surface p-8 text-center">
      <p className="text-base font-bold">Deze maand is nog leeg</p>
      <p className="max-w-sm text-sm text-codex-muted">
        Begin met de posten van vorige maand. Alles komt als nog te betalen binnen, zodat je ze deze maand opnieuw kunt afvinken.
      </p>
      {canCopy ? (
        <button
          type="button"
          onClick={onCopy}
          disabled={pending}
          className="flex h-14 items-center gap-2 rounded-2xl bg-codex-accent px-6 text-base font-extrabold text-codex-accent-ink disabled:opacity-60"
        >
          <Copy className="h-5 w-5" aria-hidden />
          {pending ? 'Kopiëren...' : 'Kopieer vorige maand'}
        </button>
      ) : null}
    </div>
  );
}

export function ArchiveNotice() {
  return (
    <p className="rounded-xl border border-codex-border bg-codex-surface-2 px-4 py-3 text-sm text-codex-muted" role="note">
      Archiefmaand, alleen lezen. Posten uit eerdere maanden zijn niet meer te wijzigen.
    </p>
  );
}
