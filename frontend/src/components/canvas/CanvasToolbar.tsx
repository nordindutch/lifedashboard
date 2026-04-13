import { Grid3x3, Plus, RotateCcw } from 'lucide-react';
import { useCanvasStore } from '../../stores/canvasStore';
import { Button } from '../ui/Button';

export function CanvasToolbar() {
  const { gridVisible, toggleGrid, resetView } = useCanvasStore();
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-codex-border bg-codex-surface/95 p-2 shadow-lg backdrop-blur">
      <Button type="button" variant="ghost" className="gap-1 px-2">
        <Plus className="h-4 w-4" />
        Note
      </Button>
      <Button type="button" variant="ghost" className="gap-1 px-2">
        <Plus className="h-4 w-4" />
        Task
      </Button>
      <Button type="button" variant="ghost" className="gap-1 px-2" onClick={resetView}>
        <RotateCcw className="h-4 w-4" />
        Reset
      </Button>
      <Button
        type="button"
        variant={gridVisible ? 'primary' : 'ghost'}
        className="gap-1 px-2"
        onClick={toggleGrid}
      >
        <Grid3x3 className="h-4 w-4" />
        Grid
      </Button>
    </div>
  );
}
