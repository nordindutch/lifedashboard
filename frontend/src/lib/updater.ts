import { isCapacitor, isTauri } from './platform';
import { getServerVersion } from '../api/version';

/**
 * Updatecontrole bij het opstarten.
 * - Desktop (Tauri): tauri-plugin-updater leest latest.json van de GitHub-release, verifieert de
 *   handtekening en kan de nieuwe versie installeren en de app herstarten.
 * - Android (Capacitor): vergelijkt de versionCode van de app met /api/version en biedt een
 *   downloadlink naar de nieuwste APK. De web-UI zelf komt al live van de server.
 */
export type AvailableUpdate =
  | { kind: 'desktop'; version: string; currentVersion: string; notes: string | null; install: () => Promise<void> }
  | { kind: 'android'; version: string; currentVersion: string; downloadUrl: string | null; releaseUrl: string | null };

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  try {
    if (isTauri) {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        return null;
      }
      return {
        kind: 'desktop',
        version: update.version,
        currentVersion: update.currentVersion,
        notes: update.body ?? null,
        install: async () => {
          await update.downloadAndInstall();
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        },
      };
    }
    if (isCapacitor) {
      const { App } = await import('@capacitor/app');
      const info = await App.getInfo();
      const res = await getServerVersion();
      if (!res.success) {
        return null;
      }
      const installedCode = Number(info.build);
      const latestCode = res.data.android.version_code;
      if (!Number.isFinite(installedCode) || latestCode <= installedCode) {
        return null;
      }
      return {
        kind: 'android',
        version: res.data.android.version,
        currentVersion: info.version,
        downloadUrl: res.data.android.download_url,
        releaseUrl: res.data.android.release_url,
      };
    }
  } catch (e: unknown) {
    // Geen verbinding, geen publieke sleutel of geen release: stil overslaan. Nooit de app blokkeren.
    console.error('Updatecontrole mislukt', e);
  }
  return null;
}
