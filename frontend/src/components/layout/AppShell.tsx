import type { ReactNode } from 'react';
import { MoodModal } from '../home/MoodModal';
import { BottomNav } from './BottomNav';
import { QuickCreate } from './QuickCreate';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-codex-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1 flex-row items-stretch">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 max-md:pb-[calc(8rem+env(safe-area-inset-bottom,0px))] md:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
      <QuickCreate />
      <MoodModal />
    </div>
  );
}
