import { useEffect, useState } from 'react';
import { getGoogleOAuthUrl, getIntegrationStatus, revokeGoogle, syncCalendar, syncGmail, testWeather } from '../api/settings';
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
  const [anthropicKey, setAnthropicKey] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [weatherSaveOk, setWeatherSaveOk] = useState<string | null>(null);
  const [weatherSaveError, setWeatherSaveError] = useState<string | null>(null);
  const [timezoneSaveOk, setTimezoneSaveOk] = useState<string | null>(null);
  const [timezoneSaveError, setTimezoneSaveError] = useState<string | null>(null);
  const [anthropicSaveOk, setAnthropicSaveOk] = useState<string | null>(null);
  const [anthropicSaveError, setAnthropicSaveError] = useState<string | null>(null);

  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<WeatherData | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean>(false);
  const [googleLoading, setGoogleLoading] = useState<boolean>(true);
  const [googleConnectPending, setGoogleConnectPending] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [calendarPending, setCalendarPending] = useState(false);
  const [gmailPending, setGmailPending] = useState(false);
  const [disconnectPending, setDisconnectPending] = useState(false);

  useEffect(() => {
    if (!settings) {
      return;
    }
    setApiKey(settings.openweather_api_key ?? '');
    setLat(settings.openweather_lat ?? '');
    setLon(settings.openweather_lon ?? '');
    setAnthropicKey(settings.anthropic_api_key ?? '');
    setTimezone(settings.timezone ?? 'UTC');
  }, [settings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    const reason = params.get('reason');
    if (google === 'connected') {
      setGoogleMessage('Google-account gekoppeld. Je kunt nu de agenda synchroniseren.');
    } else if (google === 'error') {
      setGoogleError(reason ? `Google-koppeling mislukt: ${reason}` : 'Google-koppeling mislukt.');
    }
  }, []);

  const loadGoogleStatus = async (): Promise<void> => {
    setGoogleLoading(true);
    try {
      const res = await getIntegrationStatus();
      if (res.success) {
        setGoogleConnected(res.data.google);
      } else {
        setGoogleError(res.error.message);
      }
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Integratiestatus laden mislukt');
    } finally {
      setGoogleLoading(false);
    }
  };

  useEffect(() => {
    void loadGoogleStatus();
  }, []);

  // Re-check status when app returns to foreground (e.g. after completing OAuth in external browser)
  useEffect(() => {
    const handleVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void loadGoogleStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  if (isLoading) {
    return <p className="p-4 text-sm text-codex-muted">Instellingen laden…</p>;
  }
  if (!settings) {
    return (
      <EmptyState
        title="Instellingen laden mislukt"
        description="API-fout"
      />
    );
  }

  const handleSave = async (): Promise<void> => {
    setWeatherSaveError(null);
    setWeatherSaveOk(null);
    try {
      await updateSettings({
        openweather_api_key: apiKey.trim(),
        openweather_lat: lat.trim(),
        openweather_lon: lon.trim(),
      });
      setWeatherSaveOk('Weerinstellingen opgeslagen.');
    } catch (e: unknown) {
      setWeatherSaveError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const handleSaveAnthropic = async (): Promise<void> => {
    setAnthropicSaveError(null);
    setAnthropicSaveOk(null);
    try {
      await updateSettings({
        anthropic_api_key: anthropicKey.trim(),
      });
      setAnthropicSaveOk('Anthropic API-sleutel opgeslagen.');
    } catch (e: unknown) {
      setAnthropicSaveError(e instanceof Error ? e.message : 'Opslaan mislukt');
    }
  };

  const handleSaveTimezone = async (): Promise<void> => {
    setTimezoneSaveError(null);
    setTimezoneSaveOk(null);
    try {
      await updateSettings({
        timezone: timezone.trim() || 'UTC',
      });
      setTimezoneSaveOk('Tijdzone opgeslagen.');
    } catch (e: unknown) {
      setTimezoneSaveError(e instanceof Error ? e.message : 'Opslaan mislukt');
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
          setTestError('OpenWeather is niet geconfigureerd. Voeg API-sleutel, breedte- en lengtegraad toe en sla eerst op.');
        } else if (code === 'EXTERNAL_API_ERROR') {
          setTestError(
            'OpenWeather-verzoek mislukt. Controleer de API-sleutel, of die geactiveerd is, en de coördinaten.',
          );
        } else {
          setTestError(res.error.message);
        }
      } else {
        setTestResult(res.data);
      }
    } catch (e: unknown) {
      setTestError(e instanceof Error ? e.message : 'Weertest mislukt');
    } finally {
      setIsTesting(false);
    }
  };

  const handleGoogleConnect = async (): Promise<void> => {
    setGoogleError(null);
    setGoogleMessage(null);
    setGoogleConnectPending(true);
    try {
      const res = await getGoogleOAuthUrl();
      if (!res.success || !res.data?.url) {
        setGoogleError(res.success ? 'Google-koppeling starten mislukt' : res.error.message);
        return;
      }
      const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
      const isCapacitor =
        typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';
      if (isTauri) {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(res.data.url);
        return;
      }
      if (isCapacitor) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: res.data.url });
        return;
      }
      window.location.href = res.data.url;
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Google-koppeling starten mislukt');
    } finally {
      setGoogleConnectPending(false);
    }
  };

  const handleGoogleDisconnect = async (): Promise<void> => {
    setDisconnectPending(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      const res = await revokeGoogle();
      if (!res.success) {
        setGoogleError(res.error.message);
        return;
      }
      setGoogleConnected(false);
      setGoogleMessage('Google losgekoppeld.');
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Google loskoppelen mislukt');
    } finally {
      setDisconnectPending(false);
    }
  };

  const handleCalendarSync = async (): Promise<void> => {
    setCalendarPending(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      const res = await syncCalendar();
      if (!res.success) {
        setGoogleError(res.error.message);
        return;
      }
      setGoogleConnected(true);
      setGoogleMessage(`Agenda gesynchroniseerd: ${res.data.events} gebeurtenis(sen) in cache.`);
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Agenda-sync mislukt');
    } finally {
      setCalendarPending(false);
    }
  };

  const handleGmailSync = async (): Promise<void> => {
    setGmailPending(true);
    setGoogleError(null);
    setGoogleMessage(null);
    try {
      const res = await syncGmail();
      if (!res.success) {
        setGoogleError(res.error.message);
        return;
      }
      setGoogleConnected(true);
      setGoogleMessage(`Gmail gesynchroniseerd: ${res.data.emails} ongelezen in cache.`);
    } catch (e: unknown) {
      setGoogleError(e instanceof Error ? e.message : 'Gmail-sync mislukt');
    } finally {
      setGmailPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-slate-100">Instellingen</h1>
      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">OpenWeather</h2>
            <p className="mt-1 text-xs text-codex-muted">
              API-sleutel en coördinaten voor het weer op Start.
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-codex-muted">API-sleutel</span>
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
              <span className="text-xs text-codex-muted">Breedtegraad</span>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200 outline-none ring-codex-accent focus:ring-2"
                placeholder="52.07"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-codex-muted">Lengtegraad</span>
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
              {isTesting ? 'Testen…' : 'Verbinding testen'}
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </div>

          {testResult ? (
            <p className="text-sm text-emerald-400">
              Verbonden: {testResult.city}, {testResult.country} — {Math.round(testResult.temp_c)}°C
            </p>
          ) : null}
          {testError ? <p className="text-sm text-rose-400">{testError}</p> : null}
          {weatherSaveOk ? <p className="text-sm text-emerald-400">{weatherSaveOk}</p> : null}
          {weatherSaveError ? <p className="text-sm text-rose-400">{weatherSaveError}</p> : null}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">Tijdzone</h2>
            <p className="mt-1 text-xs text-codex-muted">
              Gebruikt voor AI-planning en kalenderdaggrenzen.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-codex-muted">IANA-tijdzone</span>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200 outline-none ring-codex-accent focus:ring-2"
            >
              {[
                'UTC',
                'Europe/Amsterdam',
                'Europe/Brussels',
                'Europe/Paris',
                'Europe/London',
                'America/New_York',
                'America/Los_Angeles',
                'Asia/Dubai',
                'Asia/Singapore',
                'Asia/Tokyo',
                'Australia/Sydney',
              ].map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="primary" onClick={handleSaveTimezone} disabled={isPending}>
            {isPending ? 'Opslaan…' : 'Opslaan'}
          </Button>
          {timezoneSaveOk ? <p className="text-sm text-emerald-400">{timezoneSaveOk}</p> : null}
          {timezoneSaveError ? <p className="text-sm text-rose-400">{timezoneSaveError}</p> : null}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">AI-planning (Claude)</h2>
            <p className="mt-1 text-xs text-codex-muted">
              Anthropic API-sleutel voor je dagelijkse blokken. Vraag er een aan op console.anthropic.com.
            </p>
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-codex-muted">API-sleutel</span>
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="w-full rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-sm text-slate-200 outline-none ring-codex-accent focus:ring-2"
              placeholder="sk-ant-..."
            />
          </label>
          <Button type="button" variant="primary" onClick={handleSaveAnthropic} disabled={isPending}>
            {isPending ? 'Opslaan…' : 'Opslaan'}
          </Button>
          {anthropicSaveOk ? <p className="text-sm text-emerald-400">{anthropicSaveOk}</p> : null}
          {anthropicSaveError ? <p className="text-sm text-rose-400">{anthropicSaveError}</p> : null}
        </div>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-slate-200">Google Agenda</h2>
            <p className="mt-1 text-xs text-codex-muted">
              Koppel je Google-account en synchroniseer aankomende gebeurtenissen naar de briefing-cache.
            </p>
            <p className="mt-2 text-xs text-codex-muted">
              Status:{' '}
              <span className={googleConnected ? 'text-emerald-400' : 'text-codex-muted'}>
                {googleLoading ? 'controleren…' : googleConnected ? 'verbonden' : 'niet verbonden'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleGoogleConnect()}
              disabled={calendarPending || gmailPending || disconnectPending || googleConnectPending}
            >
              {googleConnectPending ? 'Openen…' : 'Google koppelen'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleCalendarSync} disabled={calendarPending}>
              {calendarPending ? 'Synchroniseren…' : 'Agenda syncen'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleGmailSync} disabled={gmailPending}>
              {gmailPending ? 'Synchroniseren…' : 'Gmail syncen'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleGoogleDisconnect}
              disabled={calendarPending || gmailPending || disconnectPending}
            >
              Loskoppelen
            </Button>
          </div>
          <p className="text-xs text-amber-400/80">
            Tip: als je al verbonden was vóór Gmail, koppel los en opnieuw voor inbox-toegang.
          </p>

          {googleMessage ? <p className="text-sm text-emerald-400">{googleMessage}</p> : null}
          {googleError ? <p className="text-sm text-rose-400">{googleError}</p> : null}
        </div>
      </Card>
    </div>
  );
}
