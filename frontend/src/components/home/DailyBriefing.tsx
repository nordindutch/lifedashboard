import { useBriefing } from '../../hooks/useBriefing';
import { EmptyState } from '../ui/EmptyState';
import { AiPlanCard } from './AiPlanCard';
import { CalendarStrip } from './CalendarStrip';
import { EmailPreview } from './EmailPreview';
import { WeatherCard } from './WeatherCard';

export function DailyBriefing() {
  const q = useBriefing();

  if (q.isLoading) {
    return <p className="p-4 text-sm text-slate-400">Loading briefing…</p>;
  }
  if (q.isError) {
    return (
      <EmptyState
        title="Briefing unavailable"
        description={q.error instanceof Error ? q.error.message : 'Check API and credentials.'}
      />
    );
  }
  const b = q.data;
  if (!b) {
    return <EmptyState title="No briefing data" />;
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Daily briefing</h1>
        <p className="text-sm text-slate-500">{b.date}</p>
      </header>
      <WeatherCard weather={b.weather} />
      <CalendarStrip events={b.events} />
      <EmailPreview emails={b.emails} />
      <AiPlanCard plan={b.ai_plan} />
    </div>
  );
}
