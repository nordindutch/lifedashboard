import type { AIPlan } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

type Props = {
  plan: AIPlan | null;
  onGenerate?: () => void;
  className?: string;
};

export function AiPlanCard({ plan, onGenerate, className }: Props) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-slate-300">AI plan</h3>
          {plan?.reflection ? (
            <p className="mt-2 text-sm text-slate-400">{plan.reflection}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No plan for this window yet.</p>
          )}
        </div>
        {onGenerate ? (
          <Button type="button" variant="primary" className="shrink-0" onClick={onGenerate}>
            Generate
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
