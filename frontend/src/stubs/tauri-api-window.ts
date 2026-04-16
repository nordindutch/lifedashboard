/**
 * Stub for browser / plain Vite when `@tauri-apps/api/window` is aliased here.
 * `TitleBar` only calls these when `__TAURI_INTERNALS__` exists; this module is never used for real window control in the browser.
 */

export function getCurrentWindow(): {
  isMaximized: () => Promise<boolean>;
  onResized: (cb: () => void) => Promise<() => void>;
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  unmaximize: () => Promise<void>;
  close: () => Promise<void>;
  show: () => Promise<void>;
  setFocus: () => Promise<void>;
} {
  return {
    isMaximized: async () => false,
    onResized: async () => () => {},
    minimize: async () => {},
    maximize: async () => {},
    unmaximize: async () => {},
    close: async () => {},
    show: async () => {},
    setFocus: async () => {},
  };
}
