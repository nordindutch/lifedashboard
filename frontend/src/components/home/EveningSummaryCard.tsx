import { useQueryClient } from '@tanstack/react-query';
import { Moon, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import * as eveningPlanApi from '../../api/eveningPlan';
import type { AIPlan, EveningPlanContent } from '../../types';
import { Card } from '../ui/Card';

interface Props {
  plan: AIPlan | null;
  date?: string;
}

function parseEveningContent(plan: AIPlan): EveningPlanContent | null {
  if (!plan.reflection) {
    return null;
  }
  try {
    const parsed = JSON.parse(plan.reflection);
    if (parsed && typeof parsed === 'object' && 'close_prompt' in parsed) {
      return parsed as EveningPlanContent;
    }
    return null;
  } catch {
    return null;
  }
}

export function eveningPlanHasRenderableContent(plan: AIPlan | null): boolean {
  if (!plan) {
    return false;
  }
  return parseEveningContent(plan) !== null;
}

export function EveningSummaryCard({ plan, date }: Props) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().split('T')[0] ?? '';
  const planDate = date ?? today;
  const content = plan ? parseEveningContent(plan) : null;

  const handleGenerate = async (): Promise<void> => {
    setPending(true);
    setError(null);
    try {
      const res = await eveningPlanApi.getEveningPlan(planDate);
      if (!res.success) {
        setError(res.error.message);
      } else {
        void qc.invalidateQueries({ queryKey: ['evening-plan', planDate] });
        void qc.invalidateQueries({ queryKey: ['briefing'] });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-indigo-500/20 bg-indigo-950/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Moon size={14} className="text-indigo-400" />
          <p className="text-xs font-medium text-indigo-300">Day summary</p>
          {plan?.score != null ? (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
              {plan.score}/100
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-md border border-indigo-500/30 px-2 py-1 text-[11px] text-indigo-400 transition-colors hover:border-indigo-400/60 hover:text-indigo-200 disabled:opacity-50"
        >
          <RefreshCw size={11} className={pending ? 'animate-spin' : ''} />
          {pending ? 'Generating…' : content ? 'Regenerate' : 'Generate summary'}
        </button>
      </div>

      {content ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm leading-relaxed text-slate-300">{content.reflection}</p>
          <p className="text-xs italic text-indigo-300/80">{content.close_prompt}</p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          {pending ? 'Writing your day summary…' : 'Click "Generate summary" to reflect on your day.'}
        </p>
      )}

      {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}
    </Card>
  );
}
