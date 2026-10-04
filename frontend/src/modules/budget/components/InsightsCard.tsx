import { Sparkles } from 'lucide-react';
import { useBudgetInsights } from '../hooks/useBudget';

/** AI-analyse (Claude) op aanvraag. */
export function InsightsCard() {
  const q = useBudgetInsights({ enabled: false });
  const msg = q.error instanceof Error ? q.error.message : '';
  const noKey = /not configured|Anthropic|422/i.test(msg);
  const text = q.data?.text?.trim() ?? '';

  return (
    <section className="rounded-card border border-codex-border bg-codex-surface p-[18px]" aria-labelledby="insights-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="insights-heading" className="codex-label">AI-analyse</h2>
        <button
          type="button"
          onClick={() => void q.refetch()}
          disabled={q.isFetching}
          className="flex h-11 items-center gap-2 rounded-xl border border-[#2c303b] px-3.5 text-[13px] font-semibold text-[#c8ccd6] disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-codex-accent" aria-hidden />
          {q.isFetching ? 'Bezig...' : text ? 'Vernieuwen' : 'Analyseer'}
        </button>
      </div>
      {text ? <p className="mt-3 text-[15px] leading-relaxed">{text}</p> : null}
      {!text && !q.isError ? <p className="mt-3 text-sm text-codex-muted">Vraag een korte analyse van je trend, buffer en spaarquote.</p> : null}
      {q.isError ? (
        <p className="mt-3 text-sm text-codex-risk" role="alert">
          {noKey ? 'Geen Anthropic API-sleutel ingesteld. Voeg die toe bij Instellingen.' : msg}
        </p>
      ) : null}
    </section>
  );
}
