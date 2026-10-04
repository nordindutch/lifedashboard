import { useState } from 'react';
import { Card } from '../ui/Card';
import { useSettings } from '../../hooks/useSettings';
import { availableModules } from '../../modules/registry';
import { useDisabledModuleIds } from '../../modules/useModules';

/**
 * Modules aan of uit zetten per gebruiker. Bewaard in de instelling `disabled_modules`.
 * Kernmodules (budget, instellingen) staan altijd aan.
 */
export function ModulesCard() {
  const { updateSettings, isPending } = useSettings();
  const disabled = useDisabledModuleIds();
  const [error, setError] = useState<string | null>(null);
  const modules = availableModules();

  const toggle = async (id: string, enable: boolean): Promise<void> => {
    setError(null);
    const next = enable ? disabled.filter((d) => d !== id) : [...disabled.filter((d) => d !== id), id];
    try {
      await updateSettings({ disabled_modules: next });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Modules</h2>
          <p className="mt-1 text-xs text-codex-muted">
            Zet onderdelen aan of uit. Uitgeschakelde modules verdwijnen uit de navigatie, de gegevens blijven bewaard.
          </p>
        </div>
        <ul className="divide-y divide-codex-border-soft">
          {modules.map((m) => {
            const Icon = m.icon;
            const on = m.core === true || !disabled.includes(m.id);
            const inputId = `module-${m.id}`;
            return (
              <li key={m.id} className="flex min-h-row items-center gap-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1d2130]">
                  <Icon className="h-[18px] w-[18px] text-[#c8ccd6]" aria-hidden />
                </span>
                <label htmlFor={inputId} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-[15px] font-semibold text-codex-text">{m.label}</span>
                  {m.description ? <span className="block text-xs text-codex-muted">{m.description}</span> : null}
                  {m.core ? <span className="block text-xs text-codex-muted">Altijd aan</span> : null}
                </label>
                <input
                  id={inputId}
                  type="checkbox"
                  role="switch"
                  aria-checked={on}
                  checked={on}
                  disabled={m.core === true || isPending}
                  onChange={(e) => void toggle(m.id, e.target.checked)}
                  className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-[#2c303b] transition-colors before:block before:h-5 before:w-5 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-codex-muted before:transition-transform checked:bg-codex-accent checked:before:translate-x-[22px] checked:before:bg-codex-accent-ink disabled:cursor-not-allowed disabled:opacity-60"
                />
              </li>
            );
          })}
        </ul>
        {error ? <p className="text-xs text-codex-risk">{error}</p> : null}
      </div>
    </Card>
  );
}
