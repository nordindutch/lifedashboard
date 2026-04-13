import { create } from 'zustand';

interface CanvasState {
  x: number;
  y: number;
  zoom: number;
  gridVisible: boolean;
  selectedIds: number[];
  setViewport: (p: Partial<Pick<CanvasState, 'x' | 'y' | 'zoom'>>) => void;
  resetView: () => void;
  toggleGrid: () => void;
  setSelected: (ids: number[]) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  x: 0,
  y: 0,
  zoom: 1,
  gridVisible: true,
  selectedIds: [],
  setViewport: (p) => set((s) => ({ ...s, ...p })),
  resetView: () => set({ x: 0, y: 0, zoom: 1 }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  setSelected: (selectedIds) => set({ selectedIds }),
}));
