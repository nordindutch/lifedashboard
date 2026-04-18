import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimPendingNativeSession } from '../api/auth';
import { TitleBar } from '../components/layout/TitleBar';
import { useAuth } from '../hooks/useAuth';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const isCapacitor =
  typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';
const isNative = isTauri || isCapacitor;
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '').trim();

/** Public origin for API routes (prod site or VITE_API_BASE_URL / window.location). */
function apiPublicOrigin(): string {
  if (API_BASE !== '') {
    return API_BASE.replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin.replace(/\/$/, '') : '';
}

/**
 * App + Tauri: OAuth in the system browser. Session returns via
 * `com.codex.life://login-success?token=...` (`useNativeOAuthDeepLink`).
 *
 * Capacitor `Browser.open` and Tauri `shell.open` require a full https URL — a path like
 * `/api/auth/google?...` is invalid and fails silently on Android / misroutes on Windows.
 */
async function openOAuthInExternalBrowser(url: string): Promise<void> {
  if (isTauri) {
    const { open } = await import('@tauri-apps/plugin-shell');
    await open(url);
    return;
  }
  if (isCapacitor) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }
  window.location.href = url;
}

function buildLoginUrl(): string {
  const origin = apiPublicOrigin();
  const redirectUri = `${origin}/api/auth/google/callback`;
  const appParam = isNative ? '&app=1' : '';
  const query = `redirect_uri=${encodeURIComponent(redirectUri)}${appParam}`;
  const path = `/api/auth/google?${query}`;
  // Native external browsers + optional explicit API host: must be absolute.
  if (isNative || API_BASE !== '') {
    return `${origin}${path}`;
  }
  return path;
}

const AUTH_ME_KEY = ['auth', 'me'] as const;

export function LoginPage() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error') ?? params.get('reason');
    if (err) setError(`Login failed: ${err.replace(/_/g, ' ')}`);
  }, []);

  // Fallback when com.codex.life:// never reaches the native shell (Tauri/Android): backend stores
  // a one-time token; we poll until Google OAuth completes and claim succeeds.
  useEffect(() => {
    if (!waiting || !isNative) {
      return;
    }
    let cancelled = false;
    const tryClaim = async (): Promise<void> => {
      if (cancelled) {
        return;
      }
      const res = await claimPendingNativeSession();
      if (!res.success || !res.data?.token) {
        return;
      }
      localStorage.setItem('codex_session', res.data.token);
      await queryClient.cancelQueries({ queryKey: AUTH_ME_KEY });
      await queryClient.refetchQueries({ queryKey: AUTH_ME_KEY });
      if (queryClient.getQueryData(AUTH_ME_KEY)) {
        setWaiting(false);
        navigate('/', { replace: true });
      }
    };
    void tryClaim();
    const id = window.setInterval(() => void tryClaim(), 2000);
    const timeout = window.setTimeout(() => {
      window.clearInterval(id);
      setWaiting(false);
      setError((prev) => prev ?? 'Sign-in timed out. Close the browser tab and try again.');
    }, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearTimeout(timeout);
    };
  }, [waiting, isNative, queryClient, navigate]);

  const handleLogin = async (): Promise<void> => {
    setError(null);
    try {
      const url = buildLoginUrl();
      if (isNative) {
        await openOAuthInExternalBrowser(url);
        setWaiting(true);
      } else {
        window.location.href = url;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not open the sign-in page';
      setError(msg);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-codex-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-codex-border bg-codex-surface">
            <span className="text-2xl font-bold text-codex-accent">C</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100">Project Codex</h1>
          <p className="text-sm text-codex-muted">Your personal Life OS</p>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-500/40 bg-rose-900/20 px-4 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-codex-muted">Checking session…</p>
        ) : waiting ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-codex-border border-t-codex-accent" />
            <p className="text-sm text-codex-muted">Complete sign-in in your browser…</p>
            <p className="max-w-xs text-center text-xs text-codex-muted/70">
              When Google finishes, return here — we’ll connect your session automatically.
            </p>
            <button
              type="button"
              onClick={() => setWaiting(false)}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleLogin()}
            className="flex items-center gap-3 rounded-xl border border-codex-border bg-codex-surface px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-codex-accent/50 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
              />
            </svg>
            Sign in with Google
          </button>
        )}

        <p className="text-xs text-codex-muted/60">Personal access only</p>
      </div>
    </div>
  );
}
