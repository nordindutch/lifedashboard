import { Calendar, Home, LayoutGrid, NotebookPen, Settings } from 'lucide-react';
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

export function BottomNav() {
  const navigate = useNavigate();
  const active = useUiStore((s) => s.activeTab);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-codex-border bg-codex-bg/95 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 py-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = active === t.id;
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(tabToPath(t.id))}
                title={t.label}
                className={`flex w-full flex-col items-center gap-0.5 rounded-lg py-2 text-[11px] ${
                  on ? 'text-codex-accent' : 'text-slate-500'
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={on ? 2.25 : 1.75} />
                <span>{t.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
