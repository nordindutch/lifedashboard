import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCreateNote, useNotes } from '../../hooks/useNotes';

interface Props {
  taskId: number;
}

export function TaskNotesList({ taskId }: Props) {
  const navigate = useNavigate();
  const notesQuery = useNotes({ task_id: taskId, page: 1, per_page: 20 });
  const createNote = useCreateNote();

  const notes = notesQuery.data?.items ?? [];

  const handleQuickCreate = async () => {
    const res = await createNote.mutateAsync({
      task_id: taskId,
      title: 'Task note',
      body: '',
      body_format: 'html',
    });
    if (res.success) {
      navigate('/notes');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-200">Task notes</p>
        <button
          type="button"
          onClick={() => void handleQuickCreate()}
          className="inline-flex items-center gap-1 rounded-md border border-codex-border px-2 py-1 text-xs text-slate-300 hover:border-codex-accent/50"
        >
          <Plus size={12} />
          New note
        </button>
      </div>
      {notes.map((note) => (
        <div key={note.id} className="rounded-md border border-codex-border bg-codex-bg px-2.5 py-2">
          <p className="text-sm text-slate-100">{note.title ?? 'Untitled note'}</p>
          <p className="mt-1 text-xs text-codex-muted">{note.body.replace(/<[^>]+>/g, ' ').slice(0, 90) || 'Empty note'}</p>
        </div>
      ))}
      {notes.length === 0 && !notesQuery.isLoading ? (
        <p className="text-xs text-codex-muted">No notes linked to this task.</p>
      ) : null}
    </div>
  );
}
