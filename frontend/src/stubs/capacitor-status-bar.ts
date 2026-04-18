/**
 * Browser / Tauri / non-Android Vite builds: `@capacitor/status-bar` is aliased here so
 * `main.tsx` can dynamically import it without installing the native plugin locally.
 * Android release builds use `--mode android` and the real package from npm.
 */

export enum Style {
  Dark = 'DARK',
  Light = 'LIGHT',
  Default = 'DEFAULT',
}

export const StatusBar = {
  setStyle: async (_options: { style: Style }): Promise<void> => {},
  setBackgroundColor: async (_options: { color: string }): Promise<void> => {},
  setOverlaysWebView: async (_options: { overlay: boolean }): Promise<void> => {},
};
