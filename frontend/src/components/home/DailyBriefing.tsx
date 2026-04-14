import { format } from 'date-fns';
import { useBriefing } from '../../hooks/useBriefing';
import { EmptyState } from '../ui/EmptyState';
import { AiPlanCard } from './AiPlanCard';
import { CalendarStrip } from './CalendarStrip';
import { EmailPreview } from './EmailPreview';
import { WeatherCard } from './WeatherCard';

function BriefingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <div className="mb-8 border-b border-codex-border pb-6">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-codex-border" />
          <div className="space-y-2">
            <div className="h-8 w-32 animate-pulse rounded-md bg-codex-border" />
            <div className="h-4 w-48 animate-pulse rounded-md bg-codex-border/80" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-codex-border bg-codex-surface p-4 lg:col-span-4"
          >
            <div className="mb-3 h-4 w-24 rounded bg-codex-border" />
            <div className="h-16 rounded bg-codex-border/60" />
          </div>
        ))}
        <div className="animate-pulse rounded-xl border border-codex-border bg-codex-surface p-4 lg:col-span-12">
          <div className="mb-3 h-4 w-28 rounded bg-codex-border" />
          <div className="h-24 rounded bg-codex-border/60" />
        </div>
      </div>
    </div>
  );
}

export function DailyBriefing() {
  const q = useBriefing();

  if (q.isLoading) {
    return <BriefingSkeleton />;
  }
  if (q.isError) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <EmptyState
          title="Briefing unavailable"
          description={q.error instanceof Error ? q.error.message : 'Check API and credentials.'}
        />
      </div>
    );
  }
  const b = q.data;
  if (!b) {
    return (
      <div className="mx-auto max-w-6xl p-4 md:p-6">
        <EmptyState title="No briefing data" />
      </div>
    );
  }

  const dateLabel = (() => {
    try {
      return format(new Date(b.date + 'T12:00:00'), 'EEEE, MMMM d, yyyy');
    } catch {
      return b.date;
    }
  })();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
      <header className="mb-8 border-b border-codex-border pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="mt-2 h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.45)]"
              title="Today"
              aria-hidden
            />
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-codex-muted">Home</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">Overview</h1>
              <p className="mt-1 text-sm text-codex-muted">{dateLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12 lg:gap-5">
        <section className="lg:col-span-4" aria-labelledby="home-weather">
          <h2 id="home-weather" className="sr-only">
            Weather
          </h2>
          <WeatherCard weather={b.weather} />
        </section>
        <section className="lg:col-span-4" aria-labelledby="home-calendar">
          <h2 id="home-calendar" className="sr-only">
            Calendar
          </h2>
          <CalendarStrip events={b.events} />
        </section>
        <section className="lg:col-span-4" aria-labelledby="home-inbox">
          <h2 id="home-inbox" className="sr-only">
            Inbox
          </h2>
          <EmailPreview emails={b.emails} />
        </section>
        <section className="lg:col-span-12" aria-labelledby="home-ai">
          <h2 id="home-ai" className="sr-only">
            AI plan
          </h2>
          <AiPlanCard plan={b.ai_plan} />
        </section>
      </div>
    </div>
  );
}
