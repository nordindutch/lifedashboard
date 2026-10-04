import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  tone?: 'info' | 'success' | 'error';
}

interface UiState {
  sidebarExpanded: boolean;
  quickCreateOpen: boolean;
  moodModalOpen: boolean;
  toasts: ToastItem[];
  toggleSidebar: () => void;
  openQuickCreate: () => void;
  closeQuickCreate: () => void;
  openMoodModal: () => void;
  closeMoodModal: () => void;
  pushToast: (t: Omit<ToastItem, 'id'> & { id?: string }) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarExpanded: true,
  quickCreateOpen: false,
  moodModalOpen: false,
  toasts: [],
  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  openQuickCreate: () => set({ quickCreateOpen: true }),
  closeQuickCreate: () => set({ quickCreateOpen: false }),
  openMoodModal: () => set({ moodModalOpen: true }),
  closeMoodModal: () => set({ moodModalOpen: false }),
  pushToast: (t) =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: t.id ?? crypto.randomUUID(), message: t.message, tone: t.tone ?? 'info' },
      ],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));
