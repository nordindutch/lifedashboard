import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { deleteCalendarEvent } from '../../api/calendar';
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
  className?: string;
}

interface DeleteEventButtonProps {
  event: CalendarEvent;
  onDeleted: (id: number) => void;
  compact?: boolean;
}

function DeleteEventButton({ event, onDeleted, compact = false }: DeleteEventButtonProps) {
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleClick = async (e: MouseEvent): Promise<void> => {
    e.stopPropagation();

    if (!confirmed) {
      setConfirmed(true);
      window.setTimeout(() => setConfirmed(false), 3000);
      return;
    }

    setPending(true);
    const res = await deleteCalendarEvent(event.id);
    if (res.success) {
      onDeleted(event.id);
    }
    setPending(false);
    setConfirmed(false);
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => void handleClick(e)}
        disabled={pending}
        className={`mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition-colors disabled:opacity-50 ${
          confirmed
            ? 'bg-rose-500/30 text-rose-300'
            : 'text-indigo-300/60 hover:bg-rose-500/20 hover:text-rose-300'
        }`}
        title={confirmed ? 'Nogmaals klikken om te verwijderen' : 'Afspraak verwijderen'}
      >
        <Trash2 size={9} />
        {confirmed ? 'Bevestigen' : 'Verwijderen'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => void handleClick(e)}
      disabled={pending}
      className={`shrink-0 rounded p-1 text-slate-600 transition-colors disabled:opacity-50 ${
        confirmed ? 'bg-rose-500/20 text-rose-400' : 'hover:bg-rose-500/10 hover:text-rose-400'
      }`}
      title={confirmed ? 'Nogmaals klikken om te bevestigen' : 'Afspraak verwijderen'}
    >
      <Trash2 size={12} />
    </button>
  );
}

export function CalendarStrip({ events, onSync, isSyncing = false, className }: CalendarStripProps) {
  const qc = useQueryClient();
  const [now, setNow] = useState<Date>(() => new Date());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const onDeleted = (_id: number): void => {
    void qc.invalidateQueries({ queryKey: ['briefing'] });
  };

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

  const isTimedEventVisibleNow = (event: CalendarEvent, nowUnix: number): boolean => {
    if (event.is_all_day) {
      return true;
    }
    if (event.end_at >= nowUnix) {
      return true;
    }
    const hourAgoUnix = nowUnix - 3600;
    return event.start_at >= hourAgoUnix && event.end_at <= nowUnix;
  };

  const dayEvents = useMemo(() => {
    const nowUnix = Math.floor(now.getTime() / 1000);
    return [...events]
      .filter((event) => event.end_at > dayStartUnix && event.start_at < dayEndUnix)
      .filter((event) => isTimedEventVisibleNow(event, nowUnix))
      .sort((a, b) => a.start_at - b.start_at);
  }, [events, dayStartUnix, dayEndUnix, now]);

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
    <Card
      className={`flex max-h-[500px] min-h-0 flex-col overflow-hidden lg:max-h-none ${className ?? ''}`}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-300">Vandaag</h3>
        <button
          type="button"
          onClick={onSync}
          disabled={!onSync || isSyncing}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-codex-border px-2 py-1 text-xs text-codex-muted hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Agenda synchroniseren"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Synchroniseren…' : 'Sync'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:overflow-visible">
        {allDayEvents.length > 0 ? (
          <div className="shrink-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-codex-muted">Hele dag</p>
            <div className="space-y-1.5">
              {allDayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-codex-border bg-codex-bg/70 px-2 py-1.5 text-xs text-slate-200"
                >
                  <span className="truncate">{event.title}</span>
                  <DeleteEventButton event={event} onDeleted={onDeleted} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid min-h-[12rem] flex-1 grid-cols-[2.5rem_1fr] gap-2">
          <div className="relative min-h-0">
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

          <div className="relative min-h-0 overflow-hidden rounded-lg border border-codex-border bg-codex-bg/40">
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
                aria-label="Huidige tijd"
              >
                <span className="absolute right-1 top-1 rounded bg-rose-500/20 px-1 py-0.5 text-[10px] font-medium text-rose-300">
                  Nu {format(now, 'HH:mm')}
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
                    className="group absolute z-10 box-border overflow-hidden rounded-md border border-indigo-400/40 bg-indigo-500/20 p-1.5 text-[11px] leading-tight text-indigo-100 hover:z-30"
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    onMouseEnter={(e) => moveTooltip(event, e.clientX, e.clientY)}
                    onMouseMove={(e) => moveTooltip(event, e.clientX, e.clientY)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <div className="flex h-full flex-col overflow-hidden">
                      <p className="truncate font-medium">{event.title}</p>
                      <p className="truncate text-[10px] text-indigo-200/85">{eventTime}</p>
                      <div
                        className="mt-auto hidden group-hover:block"
                        onMouseEnter={() => setTooltip(null)}
                      >
                        <DeleteEventButton event={event} onDeleted={onDeleted} compact />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>

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
