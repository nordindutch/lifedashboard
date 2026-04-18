import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { TitleBar } from '../components/layout/TitleBar';
import { useAuth } from '../hooks/useAuth';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const isCapacitor =
  typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';
const isNative = isTauri || isCapacitor;

const AUTH_ME_KEY = ['auth', 'me'] as const;
const AUTH_BOOTSTRAP_KEY = ['auth', 'bootstrap'] as const;

export function LoginPage() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error') ?? params.get('reason');
    if (err) setError(`Sessieprobleem: ${err.replace(/_/g, ' ')}`);
  }, []);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await login({ email: email.trim(), password });
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      if (isNative) {
        localStorage.setItem('codex_session', res.data.token);
      }
      await queryClient.cancelQueries({ queryKey: AUTH_ME_KEY });
      queryClient.setQueryData(AUTH_ME_KEY, res.data.user);
      await queryClient.invalidateQueries({ queryKey: AUTH_BOOTSTRAP_KEY });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt');
    } finally {
      setPending(false);
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
          <p className="text-sm text-codex-muted">Jouw persoonlijke Life OS</p>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-500/40 bg-rose-900/20 px-4 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-codex-muted">Sessie controleren…</p>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-codex-border bg-codex-surface/60 p-6"
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-codex-muted">E-mail</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                className="rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-slate-100 outline-none ring-codex-accent focus:ring-1"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-codex-muted">Wachtwoord</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                minLength={10}
                className="rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-slate-100 outline-none ring-codex-accent focus:ring-1"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="mt-2 rounded-xl border border-codex-accent/40 bg-codex-accent/20 px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-codex-accent/30 disabled:opacity-50"
            >
              {pending ? 'Bezig met inloggen…' : 'Inloggen'}
            </button>
          </form>
        )}

        <p className="text-xs text-codex-muted/60">Alleen persoonlijk gebruik</p>
      </div>
    </div>
  );
}
