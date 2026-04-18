import { ChevronDown, ChevronRight, Pin, PinOff, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useDeleteNote, useCreateNote, useNotes, useUpdateNote } from '../hooks/useNotes';
import { useProjects } from '../hooks/useProjects';
import { useTasks } from '../hooks/useTasks';
import type { Label, Note } from '../types';
import { RichEditor } from '../components/notes/RichEditor';

function notePreview(note: Note): string {
  const plain = note.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.slice(0, 90);
}

function makeTempLabel(name: string): Label {
  return {
    id: -Math.floor(Math.random() * 1000000000),
    name,
    color: '#94a3b8',
  };
}

export function NotesPage() {
  const [search, setSearch] = useState('');
  const [labelFilterId, setLabelFilterId] = useState<number | null>(null);
  /** Section id `none` or project id string → expanded */
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [projectId, setProjectId] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const notesQuery = useNotes({
    search: search.trim() || undefined,
    label_id: labelFilterId ?? undefined,
    page: 1,
    per_page: 200,
  });
  const labelsSourceQuery = useNotes({ page: 1, per_page: 200 });
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const projectsQuery = useProjects({ status: 'active' });
  const tasksQuery = useTasks();

  const notes = notesQuery.data?.items ?? [];
  const labelSourceNotes = labelsSourceQuery.data?.items ?? [];
  const projects = projectsQuery.data ?? [];
  const openTasks = (tasksQuery.data ?? []).filter((task) => task.status !== 'done' && task.status !== 'cancelled');

  const selectedNote = useMemo(
    () => notes.find((item) => item.id === selectedId) ?? null,
    [notes, selectedId],
  );

  const knownLabels = useMemo(() => {
    const map = new Map<string, Label>();
    for (const note of labelSourceNotes) {
      for (const label of note.labels) {
        map.set(label.name.toLowerCase(), label);
      }
    }
    for (const label of labels) {
      map.set(label.name.toLowerCase(), label);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [labelSourceNotes, labels]);

  const projectById = useMemo(() => {
    const map = new Map<number, string>();
    for (const project of projects) {
      map.set(project.id, project.title);
    }
    return map;
  }, [projects]);

  const noteSections = useMemo(() => {
    const byKey = new Map<string, Note[]>();
    for (const note of notes) {
      const key = note.project_id === null ? 'none' : String(note.project_id);
      const bucket = byKey.get(key);
      if (bucket) {
        bucket.push(note);
      } else {
        byKey.set(key, [note]);
      }
    }
    for (const list of byKey.values()) {
      list.sort((a, b) => {
        const pin = (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
        if (pin !== 0) {
          return pin;
        }
        return b.updated_at - a.updated_at;
      });
    }

    const sections: { id: string; title: string; notes: Note[] }[] = [];
    const noneNotes = byKey.get('none');
    if (noneNotes && noneNotes.length > 0) {
      sections.push({ id: 'none', title: 'Geen project', notes: noneNotes });
    }
    byKey.delete('none');

    const projectKeys = [...byKey.keys()].sort((a, b) => {
      const ta = projectById.get(Number(a)) ?? `Project #${a}`;
      const tb = projectById.get(Number(b)) ?? `Project #${b}`;
      return ta.localeCompare(tb);
    });
    for (const key of projectKeys) {
      const list = byKey.get(key);
      if (list && list.length > 0) {
        const pid = Number(key);
        sections.push({
          id: key,
          title: projectById.get(pid) ?? `Project #${pid}`,
          notes: list,
        });
      }
    }
    return sections;
  }, [notes, projectById]);

  useEffect(() => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      for (const s of noteSections) {
        if (!(s.id in next)) {
          next[s.id] = true;
        }
      }
      return next;
    });
  }, [noteSections]);

  const flatOrderedNotes = useMemo(() => noteSections.flatMap((s) => s.notes), [noteSections]);

  useEffect(() => {
    if (!selectedId && flatOrderedNotes.length > 0) {
      const first = flatOrderedNotes[0];
      if (first) {
        setSelectedId(first.id);
      }
    }
  }, [flatOrderedNotes, selectedId]);

  useEffect(() => {
    if (selectedId === null || notes.length === 0) {
      return;
    }
    if (!notes.some((n) => n.id === selectedId)) {
      setSelectedId(null);
    }
  }, [notes, selectedId]);

  useEffect(() => {
    if (!selectedNote) {
      setTitle('');
      setBody('');
      setProjectId(null);
      setTaskId(null);
      setIsPinned(false);
      setLabels([]);
      setIsDirty(false);
      return;
    }
    setTitle(selectedNote.title ?? '');
    setBody(selectedNote.body);
    setProjectId(selectedNote.project_id);
    setTaskId(selectedNote.task_id);
    setIsPinned(selectedNote.is_pinned);
    setLabels(selectedNote.labels);
    setIsDirty(false);
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedId || !isDirty) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const labelIds = labels.filter((label) => label.id > 0).map((label) => label.id);
      const labelNames = labels.filter((label) => label.id <= 0).map((label) => label.name);
      void updateNote.mutateAsync({
        id: selectedId,
        body: {
          title: title.trim() === '' ? null : title.trim(),
          body,
          body_format: 'html',
          project_id: projectId,
          task_id: taskId,
          is_pinned: isPinned,
          label_ids: labelIds,
          label_names: labelNames,
        },
      }).then((result) => {
        if (result.success) {
          setIsDirty(false);
        }
      });
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [body, isDirty, isPinned, labels, projectId, selectedId, taskId, title, updateNote]);

  const createNewNote = async () => {
    const result = await createNote.mutateAsync({
      title: 'Naamloze notitie',
      body: '',
      body_format: 'html',
      is_pinned: false,
    });
    if (result.success) {
      setSelectedId(result.data.id);
    }
  };

  const removeNote = async () => {
    if (!selectedNote || !window.confirm('Deze notitie verwijderen?')) {
      return;
    }
    const result = await deleteNote.mutateAsync(selectedNote.id);
    if (result.success) {
      setSelectedId(null);
    }
  };

  const addLabel = (rawName: string) => {
    const name = rawName.trim();
    if (!name) {
      return;
    }
    if (labels.some((label) => label.name.toLowerCase() === name.toLowerCase())) {
      setLabelInput('');
      return;
    }
    const existing = knownLabels.find((label) => label.name.toLowerCase() === name.toLowerCase());
    setLabels((prev) => [...prev, existing ?? makeTempLabel(name)]);
    setLabelInput('');
    setIsDirty(true);
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
        <aside className="flex min-h-0 flex-col rounded-xl border border-codex-border bg-codex-surface">
          <div className="space-y-3 border-b border-codex-border p-3">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-slate-100">Notities</h1>
              <button
                type="button"
                onClick={() => void createNewNote()}
                className="inline-flex items-center gap-1 rounded-md bg-codex-accent px-2.5 py-1.5 text-xs font-medium text-white"
              >
                <Plus size={13} />
                Nieuw
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-2 top-2.5 text-codex-muted" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Notities zoeken…"
                className="w-full rounded-md border border-codex-border bg-codex-bg py-2 pl-8 pr-2 text-sm text-slate-200 outline-none focus:border-codex-accent"
              />
            </div>
            <div className="relative">
              <select
                value={labelFilterId ?? ''}
                onChange={(event) => setLabelFilterId(event.target.value ? Number(event.target.value) : null)}
                className="w-full appearance-none rounded-md border border-codex-border bg-codex-bg py-2 pl-2 pr-10 text-xs text-slate-200"
              >
                <option value="">Alle labels</option>
                {knownLabels.map((label) => (
                  <option key={label.id} value={label.id}>
                    #{label.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-codex-muted" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {noteSections.map((section) => {
              const open = expandedSections[section.id] !== false;
              return (
                <div key={section.id} className="border-b border-codex-border/70">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        [section.id]: prev[section.id] === false,
                      }))
                    }
                    className="flex w-full items-center gap-3 bg-codex-bg/40 py-2 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wide text-codex-muted hover:bg-white/5"
                  >
                    {open ? (
                      <ChevronDown size={14} className="mr-2 shrink-0" />
                    ) : (
                      <ChevronRight size={14} className="shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-slate-300 normal-case tracking-normal">
                      {section.title}
                    </span>
                    <span className="shrink-0 tabular-nums text-codex-muted/80">{section.notes.length}</span>
                  </button>
                  {open
                    ? section.notes.map((note) => (
                        <button
                          key={note.id}
                          type="button"
                          onClick={() => setSelectedId(note.id)}
                          className={`w-full border-t border-codex-border/40 px-3 py-2.5 text-left transition-colors ${
                            note.id === selectedId ? 'bg-codex-accent/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-slate-100">{note.title ?? 'Naamloze notitie'}</p>
                            {note.is_pinned ? <Pin size={12} className="shrink-0 text-codex-accent" /> : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-codex-muted">{notePreview(note) || 'Lege notitie'}</p>
                          {note.labels.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {note.labels.slice(0, 3).map((label) => (
                                <span
                                  key={`${note.id}-${label.id}`}
                                  className="rounded px-1.5 py-0.5 text-[10px]"
                                  style={{ backgroundColor: `${label.color}33`, color: label.color }}
                                >
                                  #{label.name}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </button>
                      ))
                    : null}
                </div>
              );
            })}
            {notes.length === 0 && !notesQuery.isLoading ? (
              <p className="p-3 text-sm text-codex-muted">Geen notities gevonden.</p>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-xl border border-codex-border bg-codex-surface">
          {selectedId ? (
            <>
              <div className="space-y-3 border-b border-codex-border p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={title}
                    onChange={(event) => {
                      setTitle(event.target.value);
                      setIsDirty(true);
                    }}
                    placeholder="Titel"
                    className="min-w-0 flex-1 rounded-md border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-100 outline-none focus:border-codex-accent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsPinned((prev) => !prev);
                      setIsDirty(true);
                    }}
                    className={`rounded-md border px-2 py-2 ${
                      isPinned ? 'border-codex-accent text-codex-accent' : 'border-codex-border text-codex-muted'
                    }`}
                    title="Notitie vastzetten"
                  >
                    {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeNote()}
                    className="rounded-md border border-rose-500/40 px-2 py-2 text-rose-300 hover:bg-rose-500/10"
                    title="Notitie verwijderen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {labels.map((label) => (
                    <span
                      key={`${label.id}-${label.name}`}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
                      style={{ backgroundColor: `${label.color}22`, color: label.color }}
                    >
                      <Tag size={10} />
                      {label.name}
                      <button
                        type="button"
                        onClick={() => {
                          setLabels((prev) => prev.filter((item) => item.name !== label.name));
                          setIsDirty(true);
                        }}
                        className="text-[10px] opacity-80 hover:opacity-100"
                      >
                        x
                      </button>
                    </span>
                  ))}
                  <input
                    value={labelInput}
                    onChange={(event) => setLabelInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addLabel(labelInput);
                      }
                    }}
                    placeholder="+ Label toevoegen"
                    className="min-w-[120px] rounded-md border border-codex-border bg-codex-bg px-2 py-1 text-xs text-slate-200 outline-none focus:border-codex-accent"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="relative">
                    <select
                      value={projectId ?? ''}
                      onChange={(event) => {
                        setProjectId(event.target.value ? Number(event.target.value) : null);
                        setIsDirty(true);
                      }}
                      className="w-full appearance-none rounded-md border border-codex-border bg-codex-bg py-2 pl-2 pr-10 text-sm text-slate-200"
                    >
                      <option value="">Geen project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-codex-muted" />
                  </div>
                  <div className="relative">
                    <select
                      value={taskId ?? ''}
                      onChange={(event) => {
                        setTaskId(event.target.value ? Number(event.target.value) : null);
                        setIsDirty(true);
                      }}
                      className="w-full appearance-none rounded-md border border-codex-border bg-codex-bg py-2 pl-2 pr-10 text-sm text-slate-200"
                    >
                      <option value="">Geen taak</option>
                      {openTasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.title}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-codex-muted" />
                  </div>
                </div>
              </div>

              <RichEditor
                content={body}
                onChange={(html) => {
                  setBody(html);
                  setIsDirty(true);
                }}
                className="min-h-0 flex-1"
              />
            </>
          ) : (
            <div className="flex min-h-[12rem] items-center justify-center py-12 text-sm text-codex-muted">
              Selecteer een notitie of maak een nieuwe.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
