/**
 * No-op stub for `npm run dev` / SPA builds where `@tauri-apps/plugin-notification`
 * must not be resolved. Tauri builds set `TAURI_ENV_*` and use the real package via Vite alias.
 */

export async function isPermissionGranted(): Promise<boolean> {
  return false;
}

export async function requestPermission(): Promise<NotificationPermission> {
  return 'denied';
}

export function sendNotification(_options: { title: string; body?: string } | string): void {}

export async function onAction(_cb: (notification: { title?: string; body?: string }) => void): Promise<() => void> {
  return () => {};
}
