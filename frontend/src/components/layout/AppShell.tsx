import type { ReactNode } from 'react';
import { BottomNav } from './BottomNav';
import { QuickCreate } from './QuickCreate';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-codex-bg md:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 pb-20 md:pb-6">{children}</main>
      <BottomNav />
      <QuickCreate />
    </div>
  );
}
