import { Brain, Calendar, Clock, Coffee, RefreshCw, Train } from 'lucide-react';
import { useGenerateAiPlan } from '../../hooks/useAiPlan';
import type { AIPlan, ScheduleBlock } from '../../types';
import { Card } from '../ui/Card';

type Props = {
  plan: AIPlan | null;
  className?: string;
};

type Block = ScheduleBlock & { is_transit?: boolean; is_calendar?: boolean; estimated_mins?: number };

function blockStyle(block: Block): string {
  if (block.is_break) return 'border-l-2 border-slate-600 bg-slate-800/40 text-slate-400';
  if (block.is_transit) return 'border-l-2 border-amber-500/60 bg-amber-900/20 text-amber-200';
  if (block.is_calendar) return 'border-l-2 border-sky-500/50 bg-sky-950/30 text-sky-100';
  return 'border-l-2 border-codex-accent/60 bg-indigo-900/20 text-slate-200';
}

function blockIcon(block: Block) {
  if (block.is_break) return <Coffee size={11} className="shrink-0 text-slate-500" />;
  if (block.is_transit) return <Train size={11} className="shrink-0 text-amber-400" />;
  if (block.is_calendar) return <Calendar size={11} className="shrink-0 text-sky-300" />;
  return <Clock size={11} className="shrink-0 text-codex-accent" />;
}

export function AiPlanCard({ plan, className }: Props) {
  const generate = useGenerateAiPlan();
  const blocks = (plan?.parsed_schedule ?? []) as Block[];

  const handleGenerate = () => {
    generate.mutate({
      plan_type: 'adhoc',
      plan_date: new Date().toISOString().split('T')[0],
      force_regenerate: plan !== null,
    });
  };

  return (
    <Card className={`flex flex-col gap-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-codex-accent" />
          <h3 className="text-sm font-medium text-slate-300">Day plan</h3>
          {plan?.score ? (
            <span className="rounded-full bg-codex-accent/20 px-2 py-0.5 text-xs font-medium text-codex-accent">
              {plan.score}/100
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 rounded-md border border-codex-border px-2 py-1 text-xs text-codex-muted hover:text-slate-200 disabled:opacity-50"
        >
          <RefreshCw size={12} className={generate.isPending ? 'animate-spin' : ''} />
          {generate.isPending ? 'Planning…' : plan ? 'Regenerate' : 'Generate plan'}
        </button>
      </div>

      {plan?.reflection ? <p className="text-xs leading-relaxed text-slate-400">{plan.reflection}</p> : null}

      {blocks.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          {blocks.map((block, i) => (
            <div key={i} className={`rounded-md px-2.5 py-2 text-xs ${blockStyle(block)}`}>
              <div className="flex items-center gap-1.5">
                {blockIcon(block)}
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {block.start_time}–{block.end_time}
                </span>
                <span className="truncate font-medium">{block.task_title}</span>
                {block.estimated_mins ? (
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">{block.estimated_mins}m</span>
                ) : null}
              </div>
              {block.notes ? <p className="mt-0.5 pl-5 text-[10px] leading-snug text-slate-500">{block.notes}</p> : null}
            </div>
          ))}
        </div>
      ) : !generate.isPending ? (
        <p className="text-xs text-slate-500">
          {plan ? 'No schedule blocks generated.' : 'Click "Generate plan" to create a block schedule for today.'}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-codex-border/40" />
          ))}
        </div>
      )}

      {generate.isError ? (
        <p className="text-xs text-rose-400">
          {generate.error instanceof Error ? generate.error.message : 'Generation failed'}
        </p>
      ) : null}
    </Card>
  );
}
