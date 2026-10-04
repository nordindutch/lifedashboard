import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth, useLogout } from '../../hooks/useAuth';
import { isNavItemActive, navItems, type ResolvedNavItem } from '../../modules/registry';
import { useActiveModules } from '../../modules/useModules';
import { useUiStore } from '../../stores/uiStore';
import { QuickCreateSidebarTrigger } from './QuickCreate';

function NavGroup({ items, expanded, pathname }: { items: ResolvedNavItem[]; expanded: boolean; pathname: string }) {
  return (
    <>
      {items.map((t) => {
        const Icon = t.icon;
        const on = isNavItemActive(t, pathname);
        return (
          <NavLink
            key={`${t.moduleId}:${t.id}`}
            to={t.path}
            title={t.label}
            aria-current={on ? 'page' : undefined}
            className={`flex min-h-touch items-center gap-3 rounded-xl px-3.5 text-left text-sm font-semibold ${
              on ? 'bg-[#1d2130] text-codex-accent' : 'text-codex-muted hover:bg-white/5 hover:text-codex-text'
            } ${expanded ? '' : 'justify-center px-0'}`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            {expanded ? <span>{t.label}</span> : null}
          </NavLink>
        );
      })}
    </>
  );
}

/**
 * Desktop-zijbalk (240 px). Groepen komen uit de moduleregistry:
 * primair bovenaan, daaronder secundair en overig.
 */
export function Sidebar() {
  const { pathname } = useLocation();
  const modules = useActiveModules();
  const expanded = useUiStore((s) => s.sidebarExpanded);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { data: user } = useAuth();
  const logoutMutation = useLogout();

  const primary = navItems(modules, 'primary');
  const secondary = [...navItems(modules, 'secondary'), ...navItems(modules, 'more')].sort((a, b) => a.order - b.order);

  return (
    <aside
      className={`hidden shrink-0 border-r border-codex-border bg-[#0d0e14] md:sticky md:top-0 md:z-30 md:flex md:h-screen md:min-h-0 md:max-h-full md:flex-col md:overflow-y-auto ${
        expanded ? 'w-60' : 'w-16'
      }`}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-3">
        {expanded ? <span className="truncate px-1 text-lg font-extrabold tracking-tight">Codex</span> : null}
        <button
          type="button"
          onClick={toggle}
          className="flex min-h-touch min-w-touch items-center justify-center rounded-xl text-codex-muted hover:bg-white/5 hover:text-codex-text"
          aria-label={expanded ? 'Zijbalk inklappen' : 'Zijbalk uitklappen'}
          aria-expanded={expanded}
        >
          {expanded ? <PanelLeftClose className="h-5 w-5" aria-hidden /> : <PanelLeftOpen className="h-5 w-5" aria-hidden />}
        </button>
      </div>
      <nav className="flex flex-1 flex-col gap-1.5 p-2" aria-label="Hoofdnavigatie">
        <NavGroup items={primary} expanded={expanded} pathname={pathname} />
        {secondary.length > 0 ? <div className="my-3 h-px bg-codex-border" role="separator" /> : null}
        <NavGroup items={secondary} expanded={expanded} pathname={pathname} />
      </nav>
      <div className="px-2 pb-2">
        <QuickCreateSidebarTrigger />
      </div>
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
            title="Uitloggen"
            className={`flex min-h-touch w-full items-center gap-3 rounded-xl px-3 text-sm text-codex-muted hover:bg-white/5 hover:text-codex-risk ${expanded ? '' : 'justify-center px-0'}`}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            {expanded ? <span>Uitloggen</span> : null}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
