/** Stub voor niet-Tauri builds: er is nooit een update. */
export type Update = {
  version: string;
  currentVersion: string;
  body?: string;
  downloadAndInstall: (onEvent?: (e: unknown) => void) => Promise<void>;
};
export async function check(): Promise<Update | null> {
  return null;
}
