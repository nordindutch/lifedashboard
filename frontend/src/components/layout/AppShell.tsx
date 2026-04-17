import type { ReactNode } from 'react';
import { MoodModal } from '../home/MoodModal';
import { BottomNav } from './BottomNav';
import { QuickCreate } from './QuickCreate';
import { Sidebar } from './Sidebar';
import { TitleBar } from './TitleBar';

/*
 * Bug 3 — Android home scroll: The flex column uses `overflow-hidden` on ancestors so
 * scrolling must happen on `<main>`. Without `min-h-0`, a flex child’s min-height stays
 * `auto` (content height), so it refuses to shrink below the grid and `overflow-y-auto`
 * never creates a scrollable box—especially in WebView. `touch-pan-y` helps touch
 * scrolling on mobile.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-codex-bg">
      <TitleBar />
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 touch-pan-y overflow-y-auto pb-20 md:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
      <QuickCreate />
      <MoodModal />
    </div>
  );
}
