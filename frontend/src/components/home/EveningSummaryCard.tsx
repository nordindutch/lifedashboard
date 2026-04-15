import { Moon } from 'lucide-react';
import type { AIPlan, EveningPlanContent } from '../../types';
import { Card } from '../ui/Card';

interface Props {
  plan: AIPlan | null;
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

export function EveningSummaryCard({ plan }: Props) {
  if (!plan) {
    return null;
  }

  const content = parseEveningContent(plan);
  if (!content) {
    return null;
  }

  return (
    <Card className="border-indigo-500/20 bg-indigo-950/30">
      <div className="flex items-start gap-2.5">
        <Moon size={15} className="mt-0.5 shrink-0 text-indigo-400" />
        <div className="space-y-2">
          <p className="text-xs font-medium text-indigo-300">End of day</p>
          <p className="text-sm leading-relaxed text-slate-300">{content.reflection}</p>
          <p className="text-xs italic text-indigo-300/80">{content.close_prompt}</p>
          {plan.score != null ? (
            <p className="text-[11px] text-slate-500">Day score: {plan.score}/100</p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
