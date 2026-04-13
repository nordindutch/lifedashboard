import { useRef } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { Note } from '../../types';
import { CanvasToolbar } from './CanvasToolbar';
import { StickyNote } from './StickyNote';

type Props = { notes: Note[] };

export function CanvasWorkspace({ notes }: Props) {
  const { x, y, zoom, gridVisible, setViewport } = useCanvasStore();
  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) {
      return;
    }
    dragging.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) {
      return;
    }
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setViewport({ x: x + dx, y: y + dy });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const next = Math.min(3, Math.max(0.25, zoom + delta));
    setViewport({ zoom: next });
  };

  return (
    <div className="relative flex h-[calc(100vh-8rem)] flex-col md:h-[calc(100vh-4rem)]">
      <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <CanvasToolbar />
      </div>
      <div
        role="application"
        aria-label="Canvas"
        className="relative flex-1 overflow-hidden rounded-xl border border-codex-border bg-codex-bg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{
          backgroundImage: gridVisible
            ? 'linear-gradient(to right, #27272f 1px, transparent 1px), linear-gradient(to bottom, #27272f 1px, transparent 1px)'
            : undefined,
          backgroundSize: gridVisible ? `${24 * zoom}px ${24 * zoom}px` : undefined,
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            transform: `translate(${x}px, ${y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {notes.map((n) => (
            <StickyNote key={n.id} note={n} />
          ))}
        </div>
      </div>
    </div>
  );
}
