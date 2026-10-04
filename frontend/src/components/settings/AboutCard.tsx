import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { getServerVersion } from '../../api/version';
import { APP_BUILD, APP_VERSION, isCapacitor, isTauri } from '../../lib/platform';

/** Versie-informatie: deze app, de server en waar updates vandaan komen. */
export function AboutCard() {
  const q = useQuery({
    queryKey: ['server-version'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const res = await getServerVersion();
      if (!res.success) {
        throw new Error(res.error.message);
      }
      return res.data;
    },
  });
  const platform = isTauri ? 'Desktop (Tauri)' : isCapacitor ? 'Android (Capacitor)' : 'Web';
  const mismatch = q.data && q.data.version !== APP_VERSION;

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Over Codex</h2>
          <p className="mt-1 text-xs text-codex-muted">Versies en updates.</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-codex-muted">App</dt>
          <dd>
            {APP_VERSION} <span className="text-codex-muted">({platform}, build {APP_BUILD})</span>
          </dd>
          <dt className="text-codex-muted">Server</dt>
          <dd>
            {q.isLoading ? 'Laden...' : q.data ? `${q.data.version}${q.data.build ? ` (build ${q.data.build})` : ''}` : 'Niet bereikbaar'}
          </dd>
        </dl>
        {mismatch && (isTauri || isCapacitor) ? (
          <p className="text-xs text-codex-accent">
            De server draait versie {q.data?.version}. Bij het opstarten controleert de app op een update.
          </p>
        ) : null}
        {q.data?.desktop.release_url ? (
          <a href={q.data.desktop.release_url} target="_blank" rel="noreferrer" className="inline-block text-xs font-bold text-codex-accent underline-offset-2 hover:underline">
            Releases bekijken
          </a>
        ) : null}
      </div>
    </Card>
  );
}
