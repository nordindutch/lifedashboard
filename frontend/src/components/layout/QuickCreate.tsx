import { useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarPlus, CheckSquare, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createCalendarEvent } from '../../api/calendar';
import { useProjects } from '../../hooks/useProjects';
import { useCreateTask } from '../../hooks/useTasks';
import { useUiStore } from '../../stores/uiStore';
import type { Priority, TaskStatus } from '../../types';

type Mode = 'task' | 'event';

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 1, label: 'Low', color: 'text-slate-400 border-slate-600' },
  { value: 2, label: 'Medium', color: 'text-blue-400 border-blue-600/50' },
  { value: 3, label: 'High', color: 'text-amber-400 border-amber-600/50' },
  { value: 4, label: 'Urgent', color: 'text-rose-400 border-rose-600/50' },
];

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextRoundHour(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function addHour(time: string): string {
  const parts = time.split(':');
  const h = Number(parts[0] ?? '0');
  const m = Number(parts[1] ?? '0');
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function QuickCreate() {
  const qc = useQueryClient();
  const open = useUiStore((s) => s.quickCreateOpen);
  const openQuickCreate = useUiStore((s) => s.openQuickCreate);
  const closeQuickCreate = useUiStore((s) => s.closeQuickCreate);
  const createTask = useCreateTask();
  const { data: projects = [] } = useProjects({ status: 'active' });

  const [mode, setMode] = useState<Mode>('task');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>(2);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [eventDate, setEventDate] = useState(toDateInputValue(new Date()));
  const [eventEndDate, setEventEndDate] = useState(toDateInputValue(new Date()));
  const [startTime, setStartTime] = useState(nextRoundHour);
  const [endTime, setEndTime] = useState(() => addHour(nextRoundHour()));
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const actionLabel = useMemo(() => {
    if (successMsg !== null) {
      return successMsg;
    }
    if (pending) {
      return 'Creating…';
    }
    return mode === 'task' ? 'Add task' : 'Add event';
  }, [mode, pending, successMsg]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = window.setTimeout(() => {
      titleRef.current?.focus();
    }, 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  const resetForm = (): void => {
    setTitle('');
    setPriority(2);
    setStatus('todo');
    setProjectId(null);
    setDueDate('');
    const today = toDateInputValue(new Date());
    setEventDate(today);
    setEventEndDate(today);
    const rounded = nextRoundHour();
    setStartTime(rounded);
    setEndTime(addHour(rounded));
    setIsAllDay(false);
    setLocation('');
    setError(null);
    setSuccessMsg(null);
    setPending(false);
  };

  const closeAndReset = (): void => {
    closeQuickCreate();
    window.setTimeout(() => {
      resetForm();
    }, 140);
  };

  const handleSubmit = async (): Promise<void> => {
    const t = title.trim();
    if (t === '' || pending) {
      return;
    }

    setPending(true);
    setError(null);

    if (mode === 'task') {
      // Deadlines are due at end-of-day, not start-of-day.
      const dueUnix =
        dueDate !== '' ? Math.floor(new Date(`${dueDate}T23:59:59`).getTime() / 1000) : undefined;
      const res = await createTask.mutateAsync({
        title: t,
        priority,
        status,
        project_id: projectId,
        due_date: dueUnix,
      });
      if (!res.success) {
        setError(res.error.message);
        setPending(false);
        return;
      }
      setSuccessMsg('✓ Task created');
    } else {
      if (eventEndDate < eventDate) {
        setError('End date must be on or after the start date.');
        setPending(false);
        return;
      }
      const startUnix = isAllDay
        ? Math.floor(new Date(`${eventDate}T00:00:00`).getTime() / 1000)
        : Math.floor(new Date(`${eventDate}T${startTime}:00`).getTime() / 1000);
      const endUnix = isAllDay
        ? Math.floor(new Date(`${eventEndDate}T23:59:59`).getTime() / 1000)
        : Math.floor(new Date(`${eventEndDate}T${endTime}:00`).getTime() / 1000);
      if (endUnix <= startUnix) {
        setError('End must be after the start (check dates and times).');
        setPending(false);
        return;
      }

      const res = await createCalendarEvent({
        title: t,
        start_at: startUnix,
        end_at: endUnix,
        is_all_day: isAllDay,
        location: location.trim() || undefined,
      });
      if (!res.success) {
        setError(res.error.message);
        setPending(false);
        return;
      }
      const label = res.data.pushed_to_google ? '✓ Added to Google Calendar' : '✓ Saved locally';
      setSuccessMsg(label);
      void qc.invalidateQueries({ queryKey: ['briefing'] });
    }
    window.setTimeout(() => {
      closeAndReset();
    }, 1200);
  };

  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndReset();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <>
      <div className="fixed bottom-[4.5rem] left-1/2 z-40 -translate-x-1/2 md:bottom-6">
        <button
          type="button"
          onClick={openQuickCreate}
          className="flex items-center gap-2 rounded-full border border-codex-border bg-codex-surface/95 px-4 py-2 text-sm text-slate-300 shadow-lg backdrop-blur transition-colors hover:border-codex-accent/50 hover:text-slate-100"
        >
          <Plus size={15} className="text-codex-accent" />
          Quick create
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 md:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeAndReset();
              }
            }}
          >
            <motion.div
              className="w-full max-w-md rounded-xl border border-codex-border bg-codex-surface p-4 shadow-xl"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onKeyDown={handleKeyDown}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Quick create</h2>
                <button
                  type="button"
                  onClick={closeAndReset}
                  className="rounded-lg p-1 text-slate-500 hover:text-slate-200"
                  aria-label="Close quick create"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-4 flex gap-1 rounded-lg border border-codex-border bg-codex-bg p-1">
                <button
                  type="button"
                  onClick={() => setMode('task')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm transition-colors ${
                    mode === 'task'
                      ? 'bg-codex-surface text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <CheckSquare size={14} />
                  Task
                </button>
                <button
                  type="button"
                  onClick={() => setMode('event')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm transition-colors ${
                    mode === 'event'
                      ? 'bg-codex-surface text-slate-100'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <CalendarPlus size={14} />
                  Calendar event
                </button>
              </div>

              <input
                ref={titleRef}
                autoFocus
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={mode === 'task' ? 'Task title…' : 'Event title…'}
                className="mb-3 w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-codex-accent"
              />

              {mode === 'task' ? (
                <div className="space-y-3">
                  <div className="flex gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={`flex-1 rounded-md border py-1 text-xs transition-colors ${
                          priority === p.value
                            ? `${p.color} bg-white/5`
                            : 'border-codex-border text-slate-500 hover:border-codex-border/80'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                    className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                  </select>

                  <select
                    value={projectId ?? ''}
                    onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="quick-create-event-start" className="mb-1 block text-xs text-slate-500">
                        Start date
                      </label>
                      <input
                        id="quick-create-event-start"
                        type="date"
                        value={eventDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEventDate(v);
                          setEventEndDate((prev) => (prev < v ? v : prev));
                        }}
                        className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200"
                      />
                    </div>
                    <div>
                      <label htmlFor="quick-create-event-end" className="mb-1 block text-xs text-slate-500">
                        End date
                      </label>
                      <input
                        id="quick-create-event-end"
                        type="date"
                        value={eventEndDate}
                        min={eventDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                        className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-400">
                    <input
                      type="checkbox"
                      checked={isAllDay}
                      onChange={(e) => setIsAllDay(e.target.checked)}
                      className="rounded border-codex-border"
                    />
                    All day
                  </label>

                  {!isAllDay ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setEndTime(addHour(e.target.value));
                        }}
                        className="flex-1 rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200"
                      />
                      <span className="text-slate-600">→</span>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="flex-1 rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200"
                      />
                    </div>
                  ) : null}

                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Location (optional)"
                    className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-codex-accent"
                  />
                </div>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                {error ? <p className="text-xs text-rose-400">{error}</p> : <span />}
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={pending || title.trim() === ''}
                  className="flex items-center gap-2 rounded-lg bg-codex-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {actionLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
