import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TitleBar } from '../components/layout/TitleBar';
import { useAuth } from '../hooks/useAuth';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const isCapacitor =
  typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

function buildLoginUrl(): string {
  const origin = API_BASE !== '' ? API_BASE : window.location.origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const appParam = isCapacitor ? '&app=1' : '';
  return `${API_BASE}/api/auth/google?redirect_uri=${encodeURIComponent(redirectUri)}${appParam}`;
}

export function LoginPage() {
  const { data: user, isLoading, refetch } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error') ?? params.get('reason');
    if (err) setError(`Login failed: ${err.replace(/_/g, ' ')}`);
  }, []);

  useEffect(() => {
    if (!isTauri && !isCapacitor) return;
    let unlisten: (() => void) | null = null;
    void (async () => {
      try {
        if (isTauri) {
          const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
          const handler = await onOpenUrl((urls: string[]) => {
            for (const raw of urls) {
              const url = new URL(raw);
              if (url.host === 'login-success') {
                const token = url.searchParams.get('token');
                if (token) {
                  localStorage.setItem('codex_session', token);
                  void refetch().then(() => navigate('/', { replace: true }));
                }
              }
            }
          });
          unlisten = handler;
        } else {
          const { App } = await import('@capacitor/app');
          const handler = await App.addListener('appUrlOpen', (data: { url: string }) => {
            const url = new URL(data.url);
            if (url.host === 'login-success') {
              const token = url.searchParams.get('token');
              if (token) {
                localStorage.setItem('codex_session', token);
                void refetch().then(() => navigate('/', { replace: true }));
              }
            }
          });
          unlisten = () => void handler.remove();
        }
      } catch {
        /* non-critical */
      }
    })();
    return () => unlisten?.();
  }, [navigate, refetch]);

  const handleLogin = (): void => {
    setError(null);
    window.location.href = buildLoginUrl();
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
          <p className="rounded-lg border border-rose-500/40 bg-rose-900/20 px-4 py-2 text-sm text-rose-300">{error}</p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-codex-muted">Checking session…</p>
        ) : (
          <button
            type="button"
            onClick={handleLogin}
            className="flex items-center gap-3 rounded-xl border border-codex-border bg-codex-surface px-6 py-3 text-sm font-medium text-slate-200 transition-colors hover:border-codex-accent/50 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
              <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
            </svg>
            Sign in with Google
          </button>
        )}

        <p className="text-xs text-codex-muted/60">Personal access only</p>
      </div>
    </div>
  );
}
