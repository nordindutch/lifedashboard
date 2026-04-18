import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupAccount } from '../api/auth';
import { TitleBar } from '../components/layout/TitleBar';
import { useAuth } from '../hooks/useAuth';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const isCapacitor =
  typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';
const isNative = isTauri || isCapacitor;

const AUTH_ME_KEY = ['auth', 'me'] as const;
const AUTH_BOOTSTRAP_KEY = ['auth', 'bootstrap'] as const;

export function SetupPage() {
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }
    if (password.length < 10) {
      setError('Wachtwoord moet minimaal 10 tekens zijn');
      return;
    }
    setPending(true);
    try {
      const res = await setupAccount({
        email: email.trim(),
        name: name.trim(),
        password,
      });
      if (!res.success) {
        setError(res.error.message);
        return;
      }
      if (isNative) {
        localStorage.setItem('codex_session', res.data.token);
      }
      queryClient.setQueryData(AUTH_ME_KEY, res.data.user);
      queryClient.setQueryData(AUTH_BOOTSTRAP_KEY, { needs_setup: false });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installatie mislukt');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-codex-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-slate-100">Welkom bij Project Codex</h1>
          <p className="max-w-md text-sm text-codex-muted">
            Maak het ene account voor deze installatie. Gebruik een sterk wachtwoord; je kunt Google later
            koppelen onder Instellingen voor agenda- en mail-sync.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-rose-500/40 bg-rose-900/20 px-4 py-2 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-codex-muted">Laden…</p>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-codex-border bg-codex-surface/60 p-6"
          >
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-codex-muted">Je naam</span>
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
                className="rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-slate-100 outline-none ring-codex-accent focus:ring-1"
              />
            </label>
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
              <span className="text-codex-muted">Wachtwoord (min. 10 tekens)</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                required
                minLength={10}
                className="rounded-lg border border-codex-border bg-codex-bg px-3 py-2 text-slate-100 outline-none ring-codex-accent focus:ring-1"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-codex-muted">Bevestig wachtwoord</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(ev) => setPassword2(ev.target.value)}
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
              {pending ? 'Account aanmaken…' : 'Account aanmaken'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
