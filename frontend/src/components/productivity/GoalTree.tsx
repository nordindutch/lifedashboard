import type { Goal } from '../../types';
import { Card } from '../ui/Card';

export function GoalTree({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) {
    return <p className="text-sm text-slate-500">Nog geen doelen.</p>;
  }
  return (
    <ul className="space-y-2">
      {goals.map((g) => (
        <li key={g.id}>
          <Card className="border-l-4 p-3" style={{ borderLeftColor: g.color }}>
            <p className="font-medium text-slate-100">{g.title}</p>
            {g.description ? <p className="text-xs text-slate-500">{g.description}</p> : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
