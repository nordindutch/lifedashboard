import { Brain, Coffee, RefreshCw, Train, Clock } from 'lucide-react';
import { useState } from 'react';
import { useGenerateAiPlan } from '../../hooks/useAiPlan';
import type { AIPlan, ScheduleBlock } from '../../types';
import { Card } from '../ui/Card';

const END_TIME_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  [`${String(h).padStart(2, '0')}:00`, `${String(h).padStart(2, '0')}:30`]
).flat().filter(t => t >= '12:00');

type Block = ScheduleBlock & { is_transit?: boolean; estimated_mins?: number };

function blockClasses(block: Block): string {
  if (block.is_break) {
    return 'border-l-2 border-slate-600 bg-slate-800/40';
  }
  if (block.is_transit) {
    return 'border-l-2 border-amber-500/60 bg-amber-900/20';
  }
  return 'border-l-2 border-indigo-500/60 bg-indigo-900/20';
}

function BlockIcon({ block }: { block: Block }) {
  if (block.is_break)   return <Coffee   size={11} className="mt-0.5 shrink-0 text-slate-500" />;
  if (block.is_transit) return <Train    size={11} className="mt-0.5 shrink-0 text-amber-400" />;
  return                       <Clock    size={11} className="mt-0.5 shrink-0 text-indigo-400" />;
}

type Props = {
  plan: AIPlan | null;
  className?: string;
};

export function AiPlanCard({ plan, className }: Props) {
  const generate = useGenerateAiPlan();
  const blocks   = (plan?.parsed_schedule ?? []) as Block[];
  const [endTime, setEndTime] = useState('18:00');

  const handleGenerate = () => {
    generate.mutate({
      plan_type: 'adhoc',
      plan_date: new Date().toISOString().split('T')[0],
      force_regenerate: plan !== null,
      end_time: endTime,
    });
  };

  return (
    <Card className={`flex flex-col gap-3 ${className ?? ''}`}>

      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-indigo-400" />
          <h3 className="text-sm font-medium text-slate-300">Dagplan</h3>
          {plan?.score != null ? (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
              {plan.score}/100
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            disabled={generate.isPending}
            className="rounded-md border border-codex-border bg-transparent px-1.5 py-1 text-xs text-codex-muted disabled:opacity-50 focus:outline-none"
          >
            {END_TIME_OPTIONS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="flex items-center gap-1.5 rounded-md border border-codex-border px-2 py-1 text-xs text-codex-muted hover:text-slate-200 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={generate.isPending ? 'animate-spin' : ''} />
            {generate.isPending ? 'Plannen…' : plan ? 'Opnieuw' : 'Plan maken'}
          </button>
        </div>
      </div>

      {/* Reflection */}
      {plan?.reflection ? (
        <p className="text-xs leading-relaxed text-slate-400">{plan.reflection}</p>
      ) : null}

      {/* Schedule block list */}
      {generate.isPending ? (
        <div className="flex flex-col gap-1.5">
          {[80, 60, 72, 55].map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-codex-border/30 p-2 animate-pulse">
              <div className="h-3 w-10 rounded bg-codex-border/60" />
              <div className={`h-3 rounded bg-codex-border/60`} style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      ) : blocks.length > 0 ? (
        <div className="flex flex-col gap-1">
          {blocks.map((block, i) => (
            <div key={i} className={`rounded-md px-2.5 py-2 ${blockClasses(block)}`}>
              <div className="flex items-start gap-1.5">
                <BlockIcon block={block} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`truncate text-xs font-medium ${
                      block.is_break   ? 'text-slate-500' :
                      block.is_transit ? 'text-amber-200' :
                                         'text-slate-200'
                    }`}>
                      {block.task_title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">
                      {block.start_time}–{block.end_time}
                    </span>
                  </div>
                  {block.notes ? (
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                      {block.notes}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {plan
            ? 'Geen tijdsblokken in dit plan.'
            : 'Klik op «Plan maken» voor een blokschema voor vandaag.'}
        </p>
      )}

      {/* Error */}
      {generate.isError ? (
        <p className="text-xs text-rose-400">
          {generate.error instanceof Error ? generate.error.message : 'Genereren mislukt. Controleer je API-sleutel.'}
        </p>
      ) : null}

    </Card>
  );
}
