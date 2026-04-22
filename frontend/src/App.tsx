import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { useAuth, useBootstrap } from './hooks/useAuth';
import { pathToTab } from './lib/routes';
import { BudgetPage } from './pages/BudgetPage';
import { CaloriesPage } from './pages/CaloriesPage';
import { DiaryPage } from './pages/DiaryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotesPage } from './pages/NotesPage';
import { ProductivityPage } from './pages/ProductivityPage';
import { SetupPage } from './pages/SetupPage';
import { SettingsPage } from './pages/SettingsPage';
import { isApiBaseUrlConfigured } from './api/client';
import { useUiStore } from './stores/uiStore';

const isTauriApp =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function RouterShell() {
  const location = useLocation();
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const { data: user, isLoading: authLoading } = useAuth();
  const {
    data: bootstrap,
    isLoading: bootstrapLoading,
    isError: bootstrapError,
    refetch: refetchBootstrap,
    error: bootstrapQueryError,
  } = useBootstrap();

  useEffect(() => {
    setActiveTab(pathToTab(location.pathname));
  }, [location.pathname, setActiveTab]);

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
            Tauri builds must embed your API origin at build time. Set{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">VITE_API_BASE_URL=https://your-domain</code>{' '}
            in <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">frontend/.env.tauri.local</code> (or{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">.env.production.local</code>), then run{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">npm run build:tauri</code> and{' '}
            <code className="rounded bg-white/10 px-1 py-0.5 text-[11px]">cargo tauri build</code> again. No trailing
            slash on the URL.
          </p>
        ) : null}
        <p className="text-xs text-codex-muted">{message}</p>
        <button
          type="button"
          onClick={() => void refetchBootstrap()}
          className="rounded-lg border border-codex-border bg-codex-surface px-4 py-2 text-sm text-slate-200 hover:border-codex-accent/50"
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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tasks" element={<ProductivityPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/diary" element={<DiaryPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/calories" element={<CaloriesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
