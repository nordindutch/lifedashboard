import { useMemo } from 'react';
import { useSettings } from '../hooks/useSettings';
import { activeModules, availableModules } from './registry';
import type { ModuleManifest } from './types';

function readDisabled(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((v): v is string => typeof v === 'string');
}

/**
 * Actieve modules voor de ingelogde gebruiker. Zolang instellingen laden
 * gelden alle beschikbare modules, zodat routes nooit even verdwijnen.
 */
export function useActiveModules(): ModuleManifest[] {
  const { settings } = useSettings();
  const disabled = readDisabled((settings as { disabled_modules?: unknown } | undefined)?.disabled_modules);
  const key = disabled.join('|');
  return useMemo(() => (settings === undefined ? availableModules() : activeModules(disabled)), [key, settings === undefined]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useDisabledModuleIds(): string[] {
  const { settings } = useSettings();
  return readDisabled((settings as { disabled_modules?: unknown } | undefined)?.disabled_modules);
}
