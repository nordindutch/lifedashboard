import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { useAuth, useBootstrap } from './hooks/useAuth';
import { DEFAULT_PATH } from './modules/registry';
import { useActiveModules } from './modules/useModules';
import { LoginPage } from './pages/LoginPage';
import { MorePage } from './pages/MorePage';
import { SetupPage } from './pages/SetupPage';
import { isApiBaseUrlConfigured } from './api/client';

const isTauriApp =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function Spinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-codex-bg" role="status" aria-label="Laden">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-codex-border border-t-codex-accent" />
    </div>
  );
}

/** Routes uit de moduleregistry (lazy geladen), plus het Meer-scherm. */
function ModuleRoutes() {
  const modules = useActiveModules();
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        {modules.flatMap((m) =>
          m.routes.map((r) => {
            const Component = r.component;
            return <Route key={`${m.id}:${r.path}`} path={r.path} element={<Component />} />;
          }),
        )}
        <Route path="/more" element={<MorePage />} />
        <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
        <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
      </Routes>
    </Suspense>
  );
}

function RouterShell() {
  const location = useLocation();
  const { data: user, isLoading: authLoading } = useAuth();
  const {
    data: bootstrap,
    isLoading: bootstrapLoading,
    isError: bootstrapError,
    refetch: refetchBootstrap,
    error: bootstrapQueryError,
  } = useBootstrap();

  if (authLoading || bootstrapLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-codex-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-codex-border border-t-codex-accent" />
      </div>
    );
  }

  if (bootstrapError) {
    const message = bootstrapQueryError instanceof Error ? bootstrapQueryError.message : 'Verzoek mislukt';
    const tauriMissingBase = isTauriApp && !isApiBaseUrlConfigured;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-codex-bg px-4 text-center">
        <p className="max-w-md text-sm text-slate-300">
          Kan de server niet bereiken om te controleren of installatie nodig is. Controleer je API-URL of
          verbinding en probeer opnieuw.
        </p>
        {tauriMissingBase ? (
          <p className="max-w-lg text-xs leading-relaxed text-amber-200/90">
            Tauri-builds moeten de API-origin bij het bouwen meekrijgen. Zet{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">VITE_API_BASE_URL=https://jouw-domein</code>{' '}
            in <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">frontend/.env.tauri.local</code> en bouw
            opnieuw met <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">npm run build:tauri</code>. Geen
            slash aan het einde van de URL.
          </p>
        ) : null}
        <p className="text-xs text-codex-muted">{message}</p>
        <button
          type="button"
          onClick={() => void refetchBootstrap()}
          className="min-h-touch rounded-xl border border-codex-border bg-codex-surface px-4 text-sm text-slate-200 hover:border-codex-accent/50"
        >
          Opnieuw
        </button>
      </div>
    );
  }

  if (bootstrap?.needs_setup) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to={`/login${location.search}`} replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <ModuleRoutes />
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterShell />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
