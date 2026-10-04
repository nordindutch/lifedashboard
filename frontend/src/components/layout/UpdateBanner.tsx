import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { checkForUpdate, type AvailableUpdate } from '../../lib/updater';
import { isNative } from '../../lib/platform';

const DISMISS_KEY = 'codex_update_dismissed';

/** Nette melding bij het opstarten als er een nieuwe versie is (desktop en Android). */
export function UpdateBanner() {
  const [update, setUpdate] = useState<AvailableUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNative) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void checkForUpdate().then((u) => {
        if (cancelled || !u) {
          return;
        }
        let dismissed: string | null = null;
        try {
          dismissed = sessionStorage.getItem(DISMISS_KEY);
        } catch {
          dismissed = null;
        }
        if (dismissed !== u.version) {
          setUpdate(u);
        }
      });
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (!update) {
    return null;
  }

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, update.version);
    } catch {
      // niet kritiek
    }
    setUpdate(null);
  };

  const install = async () => {
    if (update.kind !== 'desktop') {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await update.install();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bijwerken mislukt');
      setBusy(false);
    }
  };

  const openAndroidDownload = async () => {
    const url = update.kind === 'android' ? update.downloadUrl ?? update.releaseUrl : null;
    if (!url) {
      return;
    }
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
    } catch {
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <div
      role="status"
      className="relative z-40 flex flex-wrap items-center gap-3 border-b border-codex-accent/40 bg-codex-accent/10 px-4 py-2.5 text-sm"
    >
      <Download className="h-4 w-4 shrink-0 text-codex-accent" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-bold">Versie {update.version} is beschikbaar</span>
        <span className="text-codex-muted"> (je gebruikt {update.currentVersion}).</span>{' '}
        {update.kind === 'desktop' ? 'De app wordt na het bijwerken opnieuw gestart.' : 'Download de nieuwe APK en installeer hem over de huidige app heen.'}
      </p>
      {error ? <span className="w-full text-xs text-codex-risk">{error}</span> : null}
      {update.kind === 'desktop' ? (
        <button
          type="button"
          onClick={() => void install()}
          disabled={busy}
          className="h-10 rounded-xl bg-codex-accent px-4 text-sm font-extrabold text-codex-accent-ink disabled:opacity-60"
        >
          {busy ? 'Bijwerken...' : 'Nu bijwerken'}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void openAndroidDownload()}
          className="h-10 rounded-xl bg-codex-accent px-4 text-sm font-extrabold text-codex-accent-ink"
        >
          Download
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-codex-muted hover:text-codex-text"
        aria-label="Melding sluiten"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
