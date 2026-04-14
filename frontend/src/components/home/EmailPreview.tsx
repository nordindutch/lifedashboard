import { format, fromUnixTime } from 'date-fns';
import { Paperclip } from 'lucide-react';
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
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate ${m.is_unread ? 'font-medium text-slate-200' : 'text-slate-400'}`}>
                  {m.subject ?? '(no subject)'}
                </p>
                <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                  {m.has_attachment ? <Paperclip size={12} /> : null}
                  <span>{format(fromUnixTime(m.received_at), 'MMM d, HH:mm')}</span>
                </div>
              </div>
              <p className="truncate text-xs text-slate-500">{m.sender_name ?? m.sender_email ?? 'Unknown sender'}</p>
              <p className="truncate text-slate-500">{m.snippet}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
