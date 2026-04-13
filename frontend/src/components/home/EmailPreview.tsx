import type { EmailSummary } from '../../types';
import { Card } from '../ui/Card';

export function EmailPreview({ emails }: { emails: EmailSummary[] }) {
  const list = emails.slice(0, 5);
  return (
    <Card>
      <h3 className="mb-2 text-sm font-medium text-slate-300">Inbox</h3>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">No recent mail.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((m) => (
            <li key={m.id} className="text-sm">
              <p className="truncate font-medium text-slate-200">{m.subject ?? '(no subject)'}</p>
              <p className="truncate text-slate-500">{m.snippet}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
