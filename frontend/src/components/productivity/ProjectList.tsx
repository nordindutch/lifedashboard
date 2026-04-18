import type { Project } from '../../types';
import { Card } from '../ui/Card';

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-slate-500">Geen projecten.</p>;
  }
  return (
    <ul className="space-y-2">
      {projects.map((p) => (
        <li key={p.id}>
          <Card className="p-3">
            <p className="font-medium text-slate-100">{p.title}</p>
            {p.description ? <p className="text-xs text-slate-500">{p.description}</p> : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
