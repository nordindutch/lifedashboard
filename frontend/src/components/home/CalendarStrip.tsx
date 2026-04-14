import { format } from 'date-fns';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { CalendarEvent } from '../../types';
import { Card } from '../ui/Card';

interface PositionedEvent {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
  lane: number;
}

interface TooltipState {
  event: CalendarEvent;
  x: number;
  y: number;
}

interface CalendarStripProps {
  events: CalendarEvent[];
  onSync?: () => void;
  isSyncing?: boolean;
}

export function CalendarStrip({ events, onSync, isSyncing = false }: CalendarStripProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const dismissTooltip = () => setTooltip(null);
    window.addEventListener('scroll', dismissTooltip, { passive: true, capture: true });
    window.addEventListener('wheel', dismissTooltip, { passive: true });
    window.addEventListener('touchmove', dismissTooltip, { passive: true });
    return () => {
      window.removeEventListener('scroll', dismissTooltip, true);
      window.removeEventListener('wheel', dismissTooltip);
      window.removeEventListener('touchmove', dismissTooltip);
    };
  }, []);

  const dayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);
  const dayStartUnix = Math.floor(dayStart.getTime() / 1000);
  const dayEndUnix = dayStartUnix + 86400;

  const dayEvents = useMemo(
    () =>
      [...events]
        .filter((event) => event.end_at > dayStartUnix && event.start_at < dayEndUnix)
        .sort((a, b) => a.start_at - b.start_at),
    [events, dayStartUnix, dayEndUnix],
  );

  const allDayEvents = useMemo(() => dayEvents.filter((event) => event.is_all_day), [dayEvents]);

  const positionedEvents = useMemo(() => {
    const timedEvents = dayEvents.filter((event) => !event.is_all_day);
    const laneEnds: number[] = [];
    const positioned: PositionedEvent[] = [];

    timedEvents.forEach((event) => {
      const startMin = Math.max(0, Math.floor((event.start_at - dayStartUnix) / 60));
      const rawEnd = Math.min(1440, Math.ceil((event.end_at - dayStartUnix) / 60));
      const endMin = Math.max(startMin + 15, rawEnd);

      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(endMin);
      } else {
        laneEnds[lane] = endMin;
      }

      positioned.push({ event, startMin, endMin, lane });
    });

    return {
      events: positioned,
      laneCount: Math.max(1, laneEnds.length),
    };
  }, [dayEvents, dayStartUnix]);

  const nowMinutes = Math.floor((now.getTime() - dayStart.getTime()) / 60000);
  const timelineStartMin = Math.max(0, nowMinutes - 60);
  const timelineDurationMin = Math.max(1, 1440 - timelineStartMin);
  const nowTopPct = Math.min(100, Math.max(0, ((nowMinutes - timelineStartMin) / timelineDurationMin) * 100));
  const startHour = Math.floor(timelineStartMin / 60);
  const timelineHours = Array.from({ length: 25 - startHour }, (_, i) => startHour + i);

  const moveTooltip = (calendarEvent: CalendarEvent, clientX: number, clientY: number) => {
    const offset = 12;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

    const desiredX = clientX + offset;
    const desiredY = clientY + offset;

    const maxW = 320;
    const maxH = 220;

    const x = Math.max(8, Math.min(desiredX, Math.max(8, vw - maxW - 8)));
    const y = Math.max(8, Math.min(desiredY, Math.max(8, vh - maxH - 8)));

    setTooltip({ event: calendarEvent, x, y });
  };

  const hourLabelStyle = (hour: number): CSSProperties => {
    const pct = ((hour * 60 - timelineStartMin) / timelineDurationMin) * 100;
    if (pct <= 0.0001) {
      return { top: `${pct.toFixed(4)}%`, transform: 'translateY(0)' };
    }
    if (pct >= 99.9999) {
      return { top: `${pct.toFixed(4)}%`, transform: 'translateY(-100%)' };
    }
    return { top: `${pct.toFixed(4)}%`, transform: 'translateY(-50%)' };
  };

  const hourLineStyle = (hour: number): CSSProperties => {
    const pct = ((hour * 60 - timelineStartMin) / timelineDurationMin) * 100;
    return { top: `${pct.toFixed(4)}%` };
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-300">Today</h3>
        <button
          type="button"
          onClick={onSync}
          disabled={!onSync || isSyncing}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-codex-border px-2 py-1 text-xs text-codex-muted hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Sync calendar"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>
      {dayEvents.length === 0 ? (
        <p className="text-sm text-slate-500">No events synced.</p>
      ) : (
        <div className="space-y-3">
          {allDayEvents.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-codex-muted">All day</p>
              <div className="space-y-1.5">
                {allDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-md border border-codex-border bg-codex-bg/70 px-2 py-1.5 text-xs text-slate-200"
                  >
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-[2.5rem_1fr] gap-2">
            <div className="relative h-[32rem]">
              <div className="absolute inset-2">
                {timelineHours.map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-0 text-[10px] leading-none text-codex-muted"
                    style={hourLabelStyle(hour)}
                  >
                    {String(hour).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative h-[32rem] overflow-hidden rounded-lg border border-codex-border bg-codex-bg/40">
              <div className="absolute inset-2">
                {timelineHours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-codex-border/40"
                    style={hourLineStyle(hour)}
                  />
                ))}

                <div
                  className="absolute left-0 right-0 z-20 border-t border-rose-500/80"
                  style={{ top: `${nowTopPct}%` }}
                  aria-label="Current time"
                >
                  <span className="absolute right-1 top-1 rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-medium text-rose-300">
                    Now {format(now, 'HH:mm')}
                  </span>
                </div>

                {positionedEvents.events.map(({ event, startMin, endMin, lane }) => {
                  const clippedStartMin = Math.max(timelineStartMin, startMin);
                  const clippedEndMin = Math.min(1440, endMin);
                  if (clippedEndMin <= clippedStartMin) {
                    return null;
                  }

                  const topPct = ((clippedStartMin - timelineStartMin) / timelineDurationMin) * 100;
                  const heightPct = ((clippedEndMin - clippedStartMin) / timelineDurationMin) * 100;
                  const widthPct = 100 / positionedEvents.laneCount;
                  const leftPct = lane * widthPct;
                  const eventTime = `${format(new Date(event.start_at * 1000), 'HH:mm')} - ${format(new Date(event.end_at * 1000), 'HH:mm')}`;

                  return (
                    <article
                      key={event.id}
                      className="absolute z-10 rounded-md border border-indigo-400/40 bg-indigo-500/20 p-1.5 text-[11px] text-indigo-100 hover:z-30"
                      style={{
                        top: `${topPct}%`,
                        height: `max(${heightPct}%, 2.75rem)`,
                        left: `${leftPct}%`,
                        width: `${widthPct}%`,
                      }}
                      onMouseEnter={(e) => moveTooltip(event, e.clientX, e.clientY)}
                      onMouseMove={(e) => moveTooltip(event, e.clientX, e.clientY)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div className="overflow-hidden">
                        <p className="truncate font-medium">{event.title}</p>
                        <p className="truncate text-[10px] text-indigo-200/85">{eventTime}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {typeof document !== 'undefined' && tooltip
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[200] min-w-[12rem] max-w-[20rem] rounded-md border border-indigo-300/50 bg-codex-surface p-2 text-xs text-slate-100 shadow-xl"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              <p className="break-words font-medium">{tooltip.event.title}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                {format(new Date(tooltip.event.start_at * 1000), 'HH:mm')} -{' '}
                {format(new Date(tooltip.event.end_at * 1000), 'HH:mm')}
              </p>
            </div>,
            document.body,
          )
        : null}
    </Card>
  );
}
