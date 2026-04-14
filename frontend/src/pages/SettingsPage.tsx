import { useEffect, useState } from 'react';
import { getGoogleAuth, getIntegrationStatus, revokeGoogle, syncCalendar, syncGmail, testWeather } from '../api/settings';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useSettings } from '../hooks/useSettings';
import type { WeatherData } from '../types';

export function SettingsPage() {
  const { settings, isLoading, updateSettings, isPending } = useSettings();
  const [apiKey, setApiKey] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<WeatherData | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(true);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [googlePending, setGooglePending] = useState<boolean>(false);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setApiKey(settings.openweather_api_key ?? '');
    setLat(settings.openweather_lat ?? '');
    setLon(settings.openweather_lon ?? '');
  }, [settings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    const reason = params.get('reason');
    if (google === 'connected') {
      setGoogleMessage('Google account connected. You can sync calendar now.');
    } else if (google === 'error') {
      setGoogleError(reason ? `Google connect failed: ${reason}` : 'Google connect failed.');
    }
  }, []);

  useEffect(() => {
    const load = async (): Promise<void> => {
      setGoogleLoading(true);
      try {
        const res = await getIntegrationStatus();
        if (res.success) {
          setGoogleConnected(res.data.google);
        } else {
          setGoogleError(res.error.message);
        }
      } catch (e: unknown) {
        setGoogleError(e instanceof Error ? e.message : 'Failed to load integration status');
      } finally {
        setGoogleLoading(false);
      }
    };
    void load();
  }, []);

  if (isLoading) {
    return <p className="p-4 text-sm text-codex-muted">Loading settings…</p>;
  }
  if (!settings) {
    return (
      <EmptyState
        title="Could not load settings"
        description="API error"
      />
    );
  }

  const handleSave = async (): Promise<void> => {
    setSaveError(null);
    setSaveOk(null);
    try {
      await updateSettings({
        openweather_api_key: apiKey.trim(),
        openweather_lat: lat.trim(),
        openweather_lon: lon.trim(),
      });
      setSaveOk('Weather settings saved.');
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save settings');
    }
  };

  const handleTest = async (): Promise<void> => {
    setIsTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const res = await testWeather();
      if (!res.success) {
        const code = res.error.code;
        if (code === 'not_configured') {
          setTestError('OpenWeather is not configured. Add API key, latitude, and longitude, then save first.');
        } else if (code === 'EXTERNAL_API_ERROR') {
          setTestError(
            'OpenWeather request failed. Check API key validity, ensure the key is activated, and verify coordinates.',
          );
        } else {
          setTestError(res.error.message);
        }
      } else {
        setTestResult(res.data);
      }
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : 'Weather test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleGoogleConnect = (): void => {
    setGoogleError(null);
    setGoogleMessage(null);
    void getGoogleAuth();
  };

  const handleGoogleDisconnect = async (): Promise<void> => {
    setGooglePending(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      const res = await revokeGoogle();
      if (!res.success) {
        setGoogleError(res.error.message);
        return;
      }
      setGoogleConnected(false);
      setGoogleMessage('Google disconnected.');
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Failed to disconnect Google');
    } finally {
      setGooglePending(false);
    }
  };

  const handleCalendarSync = async (): Promise<void> => {
    setGooglePending(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      const res = await syncCalendar();
      if (!res.success) {
        setGoogleError(res.error.message);
        return;
      }
      setGoogleConnected(true);
      setGoogleMessage(`Calendar synced: ${res.data.events} event(s) cached.`);
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Calendar sync failed');
    } finally {
      setGooglePending(false);
    }
  };

  const handleGmailSync = async (): Promise<void> => {
    setGooglePending(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      const res = await syncGmail();
      if (!res.success) {
        setGoogleError(res.error.message);
        return;
      }
      setGoogleConnected(true);
      setGoogleMessage(`Gmail synced: ${res.data.emails} unread cached.`);
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Gmail sync failed');
    } finally {
      setGooglePending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-100">Settings</h1>
      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">OpenWeather</h2>
            <p className="mt-1 text-xs text-codex-muted">
              Configure API key and coordinates used for the Home weather card.
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-codex-muted">API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200 outline-none ring-codex-accent focus:ring-2"
              placeholder="openweather_api_key"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-codex-muted">Latitude</span>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200 outline-none ring-codex-accent focus:ring-2"
                placeholder="52.07"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-codex-muted">Longitude</span>
              <input
                type="text"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200 outline-none ring-codex-accent focus:ring-2"
                placeholder="4.30"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={handleTest} disabled={isTesting}>
              {isTesting ? 'Testing…' : 'Test Connection'}
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>

          {testResult ? (
            <p className="text-sm text-emerald-400">
              Connected: {testResult.city}, {testResult.country} — {Math.round(testResult.temp_c)}°C
            </p>
          ) : null}
          {testError ? <p className="text-sm text-rose-400">{testError}</p> : null}
          {saveOk ? <p className="text-sm text-emerald-400">{saveOk}</p> : null}
          {saveError ? <p className="text-sm text-rose-400">{saveError}</p> : null}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">Google Calendar</h2>
            <p className="mt-1 text-xs text-codex-muted">
              Connect your Google account, then sync upcoming events into the briefing cache.
            </p>
            <p className="mt-2 text-xs text-codex-muted">
              Status:{' '}
              <span className={googleConnected ? 'text-emerald-400' : 'text-codex-muted'}>
                {googleLoading ? 'checking…' : googleConnected ? 'connected' : 'not connected'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={handleGoogleConnect} disabled={googlePending}>
              Connect Google
            </Button>
            <Button type="button" variant="ghost" onClick={handleCalendarSync} disabled={googlePending}>
              {googlePending ? 'Working…' : 'Sync Calendar'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleGmailSync} disabled={googlePending}>
              {googlePending ? 'Working…' : 'Sync Gmail'}
            </Button>
            <Button type="button" variant="danger" onClick={handleGoogleDisconnect} disabled={googlePending}>
              Disconnect
            </Button>
          </div>
          <p className="text-xs text-amber-400/80">
            Note: If you connected before adding Gmail, disconnect and reconnect to grant inbox access.
          </p>

          {googleMessage ? <p className="text-sm text-emerald-400">{googleMessage}</p> : null}
          {googleError ? <p className="text-sm text-rose-400">{googleError}</p> : null}
        </div>
      </Card>
    </div>
  );
}
