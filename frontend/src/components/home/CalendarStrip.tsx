import { format } from 'date-fns';
import type { CalendarEvent } from '../../types';
import { Card } from '../ui/Card';

export function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const next = events.slice(0, 3);
  return (
    <Card>
      <h3 className="mb-2 text-sm font-medium text-slate-300">Up next</h3>
      {next.length === 0 ? (
        <p className="text-sm text-slate-500">No events synced.</p>
      ) : (
        <ul className="space-y-2">
          {next.map((e) => (
            <li key={e.id} className="flex justify-between gap-2 text-sm">
              <span className="truncate font-medium text-slate-200">{e.title}</span>
              <span className="shrink-0 text-slate-500">
                {e.is_all_day ? 'All day' : format(new Date(e.start_at * 1000), 'HH:mm')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
