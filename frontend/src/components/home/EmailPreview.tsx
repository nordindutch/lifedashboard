import { format, fromUnixTime } from 'date-fns';
import { ExternalLink, Paperclip, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { createTask } from '../../api/tasks';
import type { EmailSummary } from '../../types';
import { Card } from '../ui/Card';

function gmailUrl(m: EmailSummary): string {
  if (m.thread_id) {
    return `https://mail.google.com/mail/u/0/#inbox/${m.thread_id}`;
  }
  return `https://mail.google.com/mail/u/0/#search/rfc822msgid:${m.external_id}`;
}

interface EmailPreviewProps {
  emails: EmailSummary[];
  onSync?: () => void;
  isSyncing?: boolean;
  className?: string;
}

export function EmailPreview({ emails, onSync, isSyncing = false, className }: EmailPreviewProps) {
  const list = emails.slice(0, 5);
  const [taskStates, setTaskStates] = useState<Record<string, 'idle' | 'creating' | 'created' | 'error'>>({});

  const handleCreateTask = async (m: EmailSummary): Promise<void> => {
    setTaskStates((s) => ({ ...s, [m.external_id]: 'creating' }));
    const title = m.subject ?? `Email from ${m.sender_name ?? m.sender_email ?? 'Unknown'}`;
    const description = [
      m.sender_name || m.sender_email
        ? `From: ${m.sender_name ?? ''}${m.sender_email ? ` <${m.sender_email}>` : ''}`
        : null,
      m.snippet ?? null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const res = await createTask({ title, description: description || null, status: 'todo' });
    if (res.success) {
      setTaskStates((s) => ({ ...s, [m.external_id]: 'created' }));
      setTimeout(() => setTaskStates((s) => ({ ...s, [m.external_id]: 'idle' })), 2000);
    } else {
      setTaskStates((s) => ({ ...s, [m.external_id]: 'error' }));
      setTimeout(() => setTaskStates((s) => ({ ...s, [m.external_id]: 'idle' })), 3000);
    }
  };

  return (
    <Card className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-slate-300">Inbox</h3>
        <button
          type="button"
          onClick={onSync}
          disabled={!onSync || isSyncing}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-codex-border px-2 py-1 text-xs text-codex-muted hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Sync email"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">No recent mail.</p>
      ) : (
        <div className="max-h-[400px] overflow-y-auto lg:max-h-none">
          <ul className="space-y-2">
            {list.map((m) => {
              const state = taskStates[m.external_id] ?? 'idle';
              return (
                <li key={m.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`min-w-0 truncate ${m.is_unread ? 'font-medium text-slate-200' : 'text-slate-400'}`}>
                      {m.subject ?? '(no subject)'}
                    </p>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      {m.has_attachment ? <Paperclip size={12} /> : null}
                      <span>{format(fromUnixTime(m.received_at), 'MMM d, HH:mm')}</span>
                      <a
                        href={gmailUrl(m)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-codex-accent hover:text-indigo-300"
                        aria-label="Open in Gmail"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                  <p className="truncate text-xs text-slate-500">{m.sender_name ?? m.sender_email ?? 'Unknown sender'}</p>
                  <p className="truncate text-slate-500">{m.snippet}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleCreateTask(m)}
                      disabled={state === 'creating'}
                      className="flex min-h-[44px] items-center gap-1 text-xs text-codex-accent hover:text-indigo-300 disabled:opacity-50"
                    >
                      <Plus size={11} />
                      {state === 'creating'
                        ? 'Creating…'
                        : state === 'created'
                          ? 'Task created \u2713'
                          : state === 'error'
                            ? 'Failed'
                            : 'Create task'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
