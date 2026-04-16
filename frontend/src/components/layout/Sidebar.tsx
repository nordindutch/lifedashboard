import { Calendar, Home, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, PiggyBank, Settings, StickyNote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useLogout } from '../../hooks/useAuth';
import { tabToPath } from '../../lib/routes';
import { useUiStore, type AppTab } from '../../stores/uiStore';

const tabs: { id: AppTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tasks', label: 'Tasks', icon: LayoutGrid },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'diary', label: 'Diary', icon: Calendar },
  { id: 'budget', label: 'Budget', icon: PiggyBank },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const navigate = useNavigate();
  const active = useUiStore((s) => s.activeTab);
  const expanded = useUiStore((s) => s.sidebarExpanded);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { data: user } = useAuth();
  const logoutMutation = useLogout();

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
      {user ? (
        <div className="mt-auto border-t border-codex-border p-2">
          <div className={`flex items-center gap-3 px-3 py-2 ${expanded ? '' : 'justify-center'}`}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="h-6 w-6 rounded-full" />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-codex-accent/20 text-xs text-codex-accent">
                {user.name[0]}
              </div>
            )}
            {expanded ? <span className="min-w-0 flex-1 truncate text-xs text-codex-muted">{user.name}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            title="Sign out"
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-white/5 hover:text-rose-400 ${expanded ? '' : 'justify-center'}`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {expanded ? <span>Sign out</span> : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
