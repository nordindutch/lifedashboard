import { Calendar, Home, LayoutGrid, NotebookPen, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { tabToPath } from '../../lib/routes';
import { useUiStore, type AppTab } from '../../stores/uiStore';

const tabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tasks', label: 'Tasks', icon: LayoutGrid },
  { id: 'canvas', label: 'Canvas', icon: NotebookPen },
  { id: 'diary', label: 'Diary', icon: Calendar },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const navigate = useNavigate();
  const active = useUiStore((s) => s.activeTab);
  const expanded = useUiStore((s) => s.sidebarExpanded);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`hidden shrink-0 border-r border-codex-border bg-codex-surface md:flex md:flex-col ${
        expanded ? 'w-60' : 'w-16'
      }`}
    >
      <div className="flex h-14 items-center justify-between gap-2 border-b border-codex-border px-3">
        {expanded ? <span className="truncate text-sm font-semibold">Project Codex</span> : null}
        <button
          type="button"
          onClick={toggle}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200"
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(tabToPath(t.id))}
              title={t.label}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                on ? 'bg-white/10 text-codex-accent' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded ? <span>{t.label}</span> : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
