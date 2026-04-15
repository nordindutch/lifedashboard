import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCreateProject, useDeleteProject, useProjects, useUpdateProject } from '../../hooks/useProjects';
import type { Project, ProjectStatus } from '../../types';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const PRESET_COLOURS = ['#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#14b8a6'];

type ProjectsPanelProps = {
  activeProjectId: number | null;
  onProjectSelect: (id: number | null) => void;
};

export function ProjectsPanel({ activeProjectId, onProjectSelect }: ProjectsPanelProps) {
  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [expanded, setExpanded] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('active');

  const [editTitle, setEditTitle] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('active');

  const handleCreate = async (): Promise<void> => {
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    await createProject.mutateAsync({ title, color: newColor, status: newStatus });
    setNewTitle('');
    setNewColor('#8b5cf6');
    setCreating(false);
  };

  const startEdit = (project: Project): void => {
    setEditingId(project.id);
    setEditTitle(project.title);
    setEditColor(project.color);
    setEditStatus(project.status);
  };

  const handleUpdate = async (id: number): Promise<void> => {
    await updateProject.mutateAsync({
      id,
      body: { title: editTitle.trim(), color: editColor, status: editStatus },
    });
    setEditingId(null);
  };

  const handleDelete = async (id: number): Promise<void> => {
    if (!window.confirm('Delete this project? Tasks will remain but lose their project link.')) {
      return;
    }
    await deleteProject.mutateAsync(id);
    if (activeProjectId === id) {
      onProjectSelect(null);
    }
  };

  return (
    <div className="mb-4 rounded-xl border border-codex-border bg-codex-surface">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-slate-100"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Projects
          <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">{projects.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          className="flex items-center gap-1 rounded-md border border-codex-border px-2 py-1 text-xs text-codex-muted transition-colors hover:border-codex-accent/50 hover:text-slate-200"
        >
          <Plus size={12} /> New project
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-codex-border px-4 pb-3 pt-3">
          {isLoading ? (
            <p className="text-xs text-slate-500">Loading...</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onProjectSelect(null)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  activeProjectId === null
                    ? 'border-codex-accent/60 bg-codex-accent/20 text-slate-200'
                    : 'border-codex-border text-slate-500 hover:text-slate-300'
                }`}
              >
                All tasks
              </button>

              {projects.map((project) => (
                <div key={project.id} className="group relative">
                  {editingId === project.id ? (
                    <div className="flex items-center gap-2 rounded-lg border border-codex-accent/30 bg-codex-bg px-2 py-1">
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void handleUpdate(project.id);
                          }
                          if (e.key === 'Escape') {
                            setEditingId(null);
                          }
                        }}
                        className="w-28 bg-transparent text-xs text-slate-100 outline-none"
                      />
                      <div className="flex gap-1">
                        {PRESET_COLOURS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditColor(c)}
                            className={`h-3.5 w-3.5 rounded-full transition-transform ${editColor === c ? 'scale-125 ring-1 ring-white/40' : ''}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
                        className="rounded bg-codex-surface px-1 py-0.5 text-[10px] text-slate-300"
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => void handleUpdate(project.id)} className="text-[10px] text-codex-accent hover:text-indigo-300">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-[10px] text-slate-500 hover:text-slate-300">
                        X
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onProjectSelect(activeProjectId === project.id ? null : project.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                        activeProjectId === project.id
                          ? 'border-transparent text-white'
                          : 'border-codex-border text-slate-400 hover:text-slate-200'
                      }`}
                      style={
                        activeProjectId === project.id
                          ? { backgroundColor: `${project.color}33`, borderColor: `${project.color}80` }
                          : undefined
                      }
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                      {project.title}
                    </button>
                  )}

                  {editingId !== project.id ? (
                    <div className="absolute -right-1 -top-1 hidden items-center gap-0.5 group-hover:flex">
                      <button type="button" onClick={() => startEdit(project)} className="rounded bg-codex-surface p-0.5 text-slate-500 hover:text-slate-200">
                        <Pencil size={9} />
                      </button>
                      <button type="button" onClick={() => void handleDelete(project.id)} className="rounded bg-codex-surface p-0.5 text-slate-500 hover:text-rose-400">
                        <Trash2 size={9} />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {creating ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-codex-accent/30 bg-codex-bg p-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleCreate();
                  }
                  if (e.key === 'Escape') {
                    setCreating(false);
                  }
                }}
                placeholder="Project name..."
                className="flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
              />
              <div className="flex gap-1.5">
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`h-4 w-4 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-1 ring-white/50' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ProjectStatus)}
                className="rounded-md border border-codex-border bg-codex-surface px-2 py-1 text-xs text-slate-300"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={createProject.isPending || !newTitle.trim()}
                className="rounded-md bg-codex-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {createProject.isPending ? 'Creating...' : 'Create'}
              </button>
              <button type="button" onClick={() => setCreating(false)} className="text-xs text-slate-500 hover:text-slate-300">
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
