import { MoreHorizontal } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { isNavItemActive, navItems } from '../../modules/registry';
import { useActiveModules } from '../../modules/useModules';

/**
 * Mobiele tabbalk: primaire items uit de moduleregistry plus "Meer" wanneer er
 * secundaire of overige items zijn.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const modules = useActiveModules();
  const primary = navItems(modules, 'primary');
  const hasMore = navItems(modules, 'secondary').length + navItems(modules, 'more').length > 0;
  const moreActive = pathname === '/more' || pathname.startsWith('/more/');

  const linkClass = (on: boolean) =>
    `flex min-h-touch w-full flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold ${
      on ? 'text-codex-accent' : 'text-codex-muted'
    }`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 min-h-[var(--codex-bottom-nav-height)] border-t border-codex-border bg-[#0d0e14]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Hoofdnavigatie"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 pb-2 pt-1.5">
        {primary.map((t) => {
          const Icon = t.icon;
          const on = isNavItemActive(t, pathname);
          return (
            <li key={`${t.moduleId}:${t.id}`} className="flex-1">
              <NavLink to={t.path} className={linkClass(on)} aria-current={on ? 'page' : undefined}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={on ? 2.25 : 1.9} aria-hidden />
                <span>{t.shortLabel ?? t.label}</span>
              </NavLink>
            </li>
          );
        })}
        {hasMore ? (
          <li className="flex-1">
            <NavLink to="/more" className={linkClass(moreActive)} aria-current={moreActive ? 'page' : undefined}>
              <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={moreActive ? 2.25 : 1.9} aria-hidden />
              <span>Meer</span>
            </NavLink>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
