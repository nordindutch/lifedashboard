import { create } from 'zustand';

export type AppTab = 'home' | 'tasks' | 'canvas' | 'diary' | 'settings';

export interface ToastItem {
  id: string;
  message: string;
  tone?: 'info' | 'success' | 'error';
}

interface UiState {
  activeTab: AppTab;
  sidebarExpanded: boolean;
  quickCreateOpen: boolean;
  toasts: ToastItem[];
  setActiveTab: (tab: AppTab) => void;
  toggleSidebar: () => void;
  openQuickCreate: () => void;
  closeQuickCreate: () => void;
  pushToast: (t: Omit<ToastItem, 'id'> & { id?: string }) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'home',
  sidebarExpanded: false,
  quickCreateOpen: false,
  toasts: [],
  setActiveTab: (activeTab) => set({ activeTab }),
  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  openQuickCreate: () => set({ quickCreateOpen: true }),
  closeQuickCreate: () => set({ quickCreateOpen: false }),
  pushToast: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: t.id ?? crypto.randomUUID(), message: t.message, tone: t.tone ?? 'info' },
      ],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
