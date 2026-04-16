import type { ReactNode } from 'react';
import { MoodModal } from '../home/MoodModal';
import { BottomNav } from './BottomNav';
import { QuickCreate } from './QuickCreate';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-codex-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto pb-20 md:pb-6">{children}</main>
      </div>
      <BottomNav />
      <QuickCreate />
      <MoodModal />
    </div>
  );
}
