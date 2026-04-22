import { ChevronLeft, ChevronRight, Flame, Loader2, Search, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { searchFood, type OffProduct } from '../api/calories';
import { useAddCalorieLog, useCalories, useDeleteCalorieLog } from '../hooks/useCalories';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(date: string, delta: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

export function CaloriesPage() {
  const [date, setDate] = useState(todayKey);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<OffProduct[]>([]);
  const [selected, setSelected] = useState<OffProduct | null>(null);
  const [amountG, setAmountG] = useState('100');
  const searchRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 400);
  const dayData = useCalories(date);
  const addLog = useAddCalorieLog(date);
  const deleteLog = useDeleteCalorieLog(date);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchFood(debouncedQuery).then((r) => {
      if (!cancelled) {
        setResults(r);
        setSearching(false);
      }
    }).catch(() => {
      if (!cancelled) setSearching(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const computedKcal = selected
    ? Math.round((selected.kcal_per_100g * Number(amountG || 0)) / 100)
    : 0;

  const handleAdd = async () => {
    if (!selected || !amountG) return;
    await addLog.mutateAsync({
      log_date: date,
      food_name: selected.product_name,
      food_brand: selected.brands || undefined,
      amount_g: Number(amountG),
      kcal_per_100g: selected.kcal_per_100g,
    });
    setSelected(null);
    setQuery('');
    setResults([]);
    setAmountG('100');
  };

  const logs = dayData.data?.logs ?? [];
  const totalKcal = dayData.data?.total_kcal ?? 0;
  const isToday = date === todayKey();

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-orange-400" />
          <h1 className="text-xl font-semibold text-slate-100">Calorieën</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDate((d) => shiftDay(d, -1))}
            className="rounded border border-codex-border p-1.5 text-slate-400 hover:text-slate-100"
            aria-label="Vorige dag"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setDate(todayKey())}
            className={`rounded px-2 py-1 text-xs ${isToday ? 'text-codex-accent' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {isToday ? 'Vandaag' : formatDate(date)}
          </button>
          <button
            type="button"
            onClick={() => setDate((d) => shiftDay(d, 1))}
            className="rounded border border-codex-border p-1.5 text-slate-400 hover:text-slate-100"
            aria-label="Volgende dag"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Daily total */}
      <div className="mb-6 flex items-baseline gap-2 rounded-xl border border-codex-border bg-codex-surface px-4 py-4">
        <span className="text-2xl font-bold text-orange-400">{Math.round(totalKcal)}</span>
        <span className="text-sm text-codex-muted">kcal vandaag</span>
      </div>

      {/* Search */}
      <div ref={searchRef} className="relative mb-4">
        <div className="flex items-center gap-2 rounded-xl border border-codex-border bg-codex-surface px-3 py-2">
          {searching
            ? <Loader2 size={15} className="shrink-0 animate-spin text-codex-muted" />
            : <Search size={15} className="shrink-0 text-codex-muted" />
          }
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            placeholder="Zoek voedingsmiddel…"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-200 placeholder:text-codex-muted focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults([]); setSelected(null); }}>
              <X size={14} className="text-codex-muted hover:text-slate-300" />
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {results.length > 0 && !selected && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-codex-border bg-codex-surface shadow-lg">
            {results.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => { setSelected(p); setResults([]); setAmountG('100'); }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-200">{p.product_name}</p>
                    {p.brands && <p className="truncate text-xs text-codex-muted">{p.brands}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-orange-400">{p.kcal_per_100g} kcal/100g</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add form — shown when a product is selected */}
      {selected && (
        <div className="mb-5 rounded-xl border border-codex-border bg-codex-surface p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">{selected.product_name}</p>
              {selected.brands && <p className="truncate text-xs text-codex-muted">{selected.brands}</p>}
            </div>
            <button type="button" onClick={() => setSelected(null)}>
              <X size={14} className="text-codex-muted hover:text-slate-300" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2">
              <input
                type="number"
                min="1"
                value={amountG}
                onChange={(e) => setAmountG(e.target.value)}
                className="w-20 rounded border border-codex-border bg-codex-bg px-2 py-1.5 text-right text-sm text-slate-200 focus:outline-none"
              />
              <span className="text-sm text-codex-muted">g</span>
              <span className="ml-auto text-sm font-semibold text-orange-400">{computedKcal} kcal</span>
            </div>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={addLog.isPending || !amountG || Number(amountG) <= 0}
              className="shrink-0 rounded-lg bg-orange-500/20 px-3 py-1.5 text-sm font-medium text-orange-300 hover:bg-orange-500/30 disabled:opacity-50 transition-colors"
            >
              {addLog.isPending ? 'Toevoegen…' : 'Toevoegen'}
            </button>
          </div>
        </div>
      )}

      {/* Log list */}
      {dayData.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl border border-codex-border bg-codex-surface" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-sm text-codex-muted">Nog niets gelogd vandaag.</p>
      ) : (
        <ul className="space-y-1.5">
          {logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center gap-3 rounded-xl border border-codex-border bg-codex-surface px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-200">{log.food_name}</p>
                <p className="text-xs text-codex-muted">
                  {log.amount_g}g
                  {log.food_brand ? ` · ${log.food_brand}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-orange-400">
                {Math.round(log.kcal_total)} kcal
              </span>
              <button
                type="button"
                onClick={() => deleteLog.mutate(log.id)}
                disabled={deleteLog.isPending}
                className="shrink-0 rounded p-1 text-slate-500 hover:text-rose-400 disabled:opacity-40 transition-colors"
                aria-label="Verwijderen"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
