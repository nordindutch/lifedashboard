import { useSettings } from '../hooks/useSettings';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

export function SettingsPage() {
  const q = useSettings();
  if (q.isLoading) {
    return <p className="p-4 text-sm text-slate-400">Loading settings…</p>;
  }
  if (q.isError) {
    return (
      <EmptyState
        title="Could not load settings"
        description={q.error instanceof Error ? q.error.message : 'API error'}
      />
    );
  }
  const s = q.data;
  if (!s) {
    return <EmptyState title="No settings" />;
  }
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Card>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">App</dt>
            <dd className="text-slate-200">{s.app_name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">Timezone</dt>
            <dd className="text-slate-200">{s.timezone}</dd>
          </div>
        </dl>
      </Card>
      <p className="text-xs text-slate-500">
        API keys and integrations will be configured here. External API wiring comes later.
      </p>
    </div>
  );
}
