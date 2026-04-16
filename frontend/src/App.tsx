import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { useAuth } from './hooks/useAuth';
import { pathToTab } from './lib/routes';
import { CanvasPage } from './pages/CanvasPage';
import { BudgetPage } from './pages/BudgetPage';
import { DiaryPage } from './pages/DiaryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { ProductivityPage } from './pages/ProductivityPage';
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
  const { data: user, isLoading } = useAuth();

  useEffect(() => {
    setActiveTab(pathToTab(location.pathname));
  }, [location.pathname, setActiveTab]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-codex-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-codex-border border-t-codex-accent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tasks" element={<ProductivityPage />} />
        <Route path="/canvas" element={<CanvasPage />} />
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
