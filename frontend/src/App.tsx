import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { useAuth, useBootstrap } from './hooks/useAuth';
import { pathToTab } from './lib/routes';
import { BudgetPage } from './pages/BudgetPage';
import { DiaryPage } from './pages/DiaryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { NotesPage } from './pages/NotesPage';
import { ProductivityPage } from './pages/ProductivityPage';
import { SetupPage } from './pages/SetupPage';
import { SettingsPage } from './pages/SettingsPage';
import { useUiStore } from './stores/uiStore';

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
    const message = bootstrapQueryError instanceof Error ? bootstrapQueryError.message : 'Request failed';
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-codex-bg px-4 text-center">
        <p className="max-w-md text-sm text-slate-300">
          Could not reach the server to check whether setup is required. Fix your API URL or connection, then
          retry.
        </p>
        <p className="text-xs text-codex-muted">{message}</p>
        <button
          type="button"
          onClick={() => void refetchBootstrap()}
          className="rounded-lg border border-codex-border bg-codex-surface px-4 py-2 text-sm text-slate-200 hover:border-codex-accent/50"
        >
          Retry
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
