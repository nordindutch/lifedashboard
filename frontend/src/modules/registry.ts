import type { ModuleManifest, ModuleNavItem, NavPlacement } from './types';
import { budgetModule } from './budget/manifest';
import { diaryModule } from './diary/manifest';
import { helloModule } from './hello/manifest';
import { homeModule } from './home/manifest';
import { notesModule } from './notes/manifest';
import { settingsModule } from './settings/manifest';
import { tasksModule } from './tasks/manifest';

/**
 * Centrale lijst van modules. Een nieuwe module toevoegen = manifest importeren en
 * hier in de lijst zetten. Routes, tabbalk, zijbalk en het Meer-scherm volgen vanzelf.
 */
export const ALL_MODULES: readonly ModuleManifest[] = [
  budgetModule,
  tasksModule,
  notesModule,
  diaryModule,
  homeModule,
  settingsModule,
  helloModule,
].sort((a, b) => a.order - b.order);

/** Pad waar de app na inloggen en bij onbekende routes naartoe gaat. */
export const DEFAULT_PATH = '/budget';

function featureFlagEnabled(flag: string | undefined): boolean {
  if (flag === undefined) {
    return true;
  }
  const env = import.meta.env as Record<string, string | boolean | undefined>;
  const value = env[`VITE_FLAG_${flag.toUpperCase()}`];
  return value === 'true' || value === true;
}

/** Modules waarvan de feature flag aan staat (los van gebruikersinstellingen). */
export function availableModules(): ModuleManifest[] {
  return ALL_MODULES.filter((m) => featureFlagEnabled(m.featureFlag));
}

/** Modules die de gebruiker aan heeft staan. Kernmodules staan altijd aan. */
export function activeModules(disabledIds: readonly string[]): ModuleManifest[] {
  const disabled = new Set(disabledIds);
  return availableModules().filter((m) => m.core === true || !disabled.has(m.id));
}

export interface ResolvedNavItem extends ModuleNavItem {
  moduleId: string;
}

export function navItems(modules: readonly ModuleManifest[], placement: NavPlacement): ResolvedNavItem[] {
  const out: ResolvedNavItem[] = [];
  for (const m of modules) {
    for (const item of m.nav) {
      if (item.placement === placement) {
        out.push({ ...item, moduleId: m.id });
      }
    }
  }
  return out.sort((a, b) => a.order - b.order);
}

export function isNavItemActive(item: ModuleNavItem, pathname: string): boolean {
  const patterns = item.match ?? [item.path];
  return patterns.some((p) => {
    if (item.exact || p === '/') {
      return pathname === p || pathname === `${p}/`;
    }
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}
