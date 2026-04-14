import { format } from 'date-fns';
import { Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { syncCalendar, syncGmail } from '../../api/settings';
import { useBriefing } from '../../hooks/useBriefing';
import { useSettings } from '../../hooks/useSettings';
import { EmptyState } from '../ui/EmptyState';
import { AiPlanCard } from './AiPlanCard';
import { BriefingTasksCard } from './BriefingTasksCard';
import { CalendarStrip } from './CalendarStrip';
import { EmailPreview } from './EmailPreview';
import { WeatherCard } from './WeatherCard';

function BriefingSkeleton() {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-6">
      <div className="mb-8 border-b border-codex-border pb-6">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-codex-border" />
          <div className="space-y-2">
            <div className="h-8 w-32 animate-pulse rounded-md bg-codex-border" />
            <div className="h-4 w-48 animate-pulse rounded-md bg-codex-border/80" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-5 lg:items-stretch">
        <div className="flex min-h-0 flex-col gap-4 lg:h-full">
          <div className="animate-pulse rounded-xl border border-codex-border bg-codex-surface p-4">
            <div className="mb-3 h-4 w-24 rounded bg-codex-border" />
            <div className="h-16 rounded bg-codex-border/60" />
          </div>
          <div className="animate-pulse min-h-[8rem] flex-1 rounded-xl border border-codex-border bg-codex-surface p-4 lg:min-h-0">
            <div className="mb-3 h-4 w-28 rounded bg-codex-border" />
            <div className="h-24 rounded bg-codex-border/60" />
          </div>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse flex min-h-0 flex-col rounded-xl border border-codex-border bg-codex-surface p-4 lg:h-full"
          >
            <div className="mb-3 h-4 w-24 rounded bg-codex-border" />
            <div className="min-h-[12rem] flex-1 rounded bg-codex-border/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DailyBriefing() {
  const q = useBriefing();
  const { settings } = useSettings();
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [isSyncingEmail, setIsSyncingEmail] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeTimezone = settings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: activeTimezone,
  }).format(now);

  const handleCalendarSync = async (): Promise<void> => {
    setIsSyncingCalendar(true);
    try {
      const res = await syncCalendar();
      if (res.success) {
        await q.refetch();
      }
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const handleEmailSync = async (): Promise<void> => {
    setIsSyncingEmail(true);
    try {
      const res = await syncGmail();
      if (res.success) {
        await q.refetch();
      }
    } finally {
      setIsSyncingEmail(false);
    }
  };

  if (q.isLoading) {
    return <BriefingSkeleton />;
  }
  if (q.isError) {
    return (
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
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
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
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
    <div className="mx-auto max-w-screen-2xl px-4 py-6 md:px-6">
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
              <div className="mt-1 flex items-center gap-3 text-sm text-codex-muted">
                <span>{dateLabel}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 size={13} />
                  {timeLabel} ({activeTimezone})
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-5 lg:items-stretch">
        <div className="flex min-h-0 flex-col gap-4 lg:h-full">
          <section aria-labelledby="home-weather">
            <h2 id="home-weather" className="sr-only">
              Weather
            </h2>
            <WeatherCard weather={b.weather} />
          </section>
          <section aria-labelledby="home-ai" className="flex min-h-0 flex-1 flex-col">
            <h2 id="home-ai" className="sr-only">
              AI plan
            </h2>
            <AiPlanCard plan={b.ai_plan} className="min-h-0 flex flex-1 flex-col" />
          </section>
        </div>

        <section aria-labelledby="home-calendar" className="flex min-h-0 flex-col lg:h-full">
          <h2 id="home-calendar" className="sr-only">
            Calendar
          </h2>
          <CalendarStrip
            events={b.events}
            onSync={() => void handleCalendarSync()}
            isSyncing={isSyncingCalendar}
            className="min-h-0 flex-1 flex flex-col"
          />
        </section>

        <section aria-labelledby="home-inbox" className="flex min-h-0 flex-col lg:h-full">
          <h2 id="home-inbox" className="sr-only">
            Inbox
          </h2>
          <EmailPreview
            emails={b.emails}
            onSync={() => void handleEmailSync()}
            isSyncing={isSyncingEmail}
            className="min-h-0 flex-1 flex flex-col"
          />
        </section>

        <section aria-labelledby="home-tasks" className="flex min-h-0 flex-col lg:h-full">
          <h2 id="home-tasks" className="sr-only">
            Tasks
          </h2>
          <BriefingTasksCard
            tasksToday={b.tasks_today}
            tasksOverdue={b.tasks_overdue}
            tasksActive={b.tasks_active}
            className="min-h-0 flex-1 flex flex-col"
          />
        </section>
      </div>
    </div>
  );
}
