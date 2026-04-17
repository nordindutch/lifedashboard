import { getCurrentWindow } from '@tauri-apps/api/window';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const isTauri =
  typeof window !== 'undefined' &&
  typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const appWindow = useMemo(() => (isTauri ? getCurrentWindow() : null), []);

  useEffect(() => {
    if (!appWindow) {
      return;
    }

    void appWindow.isMaximized().then(setMaximized);

    let unlisten: (() => void) | null = null;
    void appWindow
      .onResized(() => {
        void appWindow.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [appWindow]);

  if (!appWindow) {
    return null;
  }

  const handleMinimize = () => {
    void appWindow.minimize();
  };

  const handleMaximize = () => {
    void (maximized ? appWindow.unmaximize() : appWindow.maximize());
  };

  const handleClose = () => {
    void appWindow.close();
  };

  // Drag region must not wrap window buttons — Tauri can eat clicks; keep z above main overlays.
  return (
    <div className="relative z-50 flex h-9 w-full shrink-0 select-none items-stretch justify-between border-b border-codex-border/40 bg-codex-bg px-0">
      <div
        data-tauri-drag-region
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-3"
      >
        <span className="text-[11px] font-medium uppercase tracking-widest text-codex-muted/60">
          Project Codex
        </span>
        <div data-tauri-drag-region className="h-full min-h-0 flex-1" />
      </div>

      <div className="flex shrink-0 items-center gap-1 px-2">
        <button
          type="button"
          onClick={handleMinimize}
          className="flex h-7 w-7 items-center justify-center rounded text-codex-muted transition-colors hover:bg-white/10 hover:text-slate-200"
          aria-label="Minimise"
        >
          <Minus size={13} />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          className="flex h-7 w-7 items-center justify-center rounded text-codex-muted transition-colors hover:bg-white/10 hover:text-slate-200"
          aria-label={maximized ? 'Restore' : 'Maximise'}
        >
          {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="flex h-7 w-7 items-center justify-center rounded text-codex-muted transition-colors hover:bg-rose-500/80 hover:text-white"
          aria-label="Close"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
