import { ChevronRight, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth, useLogout } from '../hooks/useAuth';
import { navItems } from '../modules/registry';
import { useActiveModules } from '../modules/useModules';

/** Mobiel "Meer"-scherm: alles wat niet in de tabbalk past, uit de moduleregistry. */
export function MorePage() {
  const modules = useActiveModules();
  const items = [...navItems(modules, 'secondary'), ...navItems(modules, 'more')];
  const { data: user } = useAuth();
  const logoutMutation = useLogout();

  return (
    <div className="mx-auto max-w-lg p-4">
      <h1 className="px-1 pb-4 pt-2 text-[22px] font-extrabold tracking-tight">Meer</h1>
      <ul className="overflow-hidden rounded-card border border-codex-border bg-codex-surface">
        {items.map((t, i) => {
          const Icon = t.icon;
          return (
            <li key={`${t.moduleId}:${t.id}`} className={i > 0 ? 'border-t border-codex-border-soft' : ''}>
              <Link to={t.path} className="flex min-h-row items-center gap-3 px-4 text-[15px] font-semibold hover:bg-white/5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1d2130]">
                  <Icon className="h-[18px] w-[18px] text-[#c8ccd6]" aria-hidden />
                </span>
                <span className="flex-1">{t.label}</span>
                <ChevronRight className="h-5 w-5 text-codex-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
      {user ? (
        <div className="mt-6 flex items-center justify-between gap-3 px-1">
          <span className="truncate text-sm text-codex-muted">Ingelogd als {user.name}</span>
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            className="flex min-h-touch items-center gap-2 rounded-xl border border-codex-border px-4 text-sm font-semibold text-codex-muted hover:text-codex-risk"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Uitloggen
          </button>
        </div>
      ) : null}
    </div>
  );
}
