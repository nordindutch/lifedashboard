import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8180';

/** Eén versiebron: de root package.json (zie scripts/sync-version.mjs). */
const appVersion = String(
  (JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as { version?: string }).version ?? '0.0.0',
);

/*
 * Bug 1 — Tauri title bar: When `isTauri` is false at build time, Vite aliases
 * `@tauri-apps/api/window` to `src/stubs/tauri-api-window.ts`, so minimize / maximize /
 * close / startDragging become no-ops. `tauri build` already uses `--mode tauri`, but
 * `tauri dev` used to run plain `vite` (mode `development`), so unless `TAURI_ENV_*`
 * was always inherited by the Vite process, the desktop app could ship dev bundles
 * that still pointed at the stub. `beforeDevCommand` now runs `vite --mode tauri`.
 */
export default defineConfig(({ mode }) => {
  const isTauri =
    mode === 'tauri' ||
    process.env.TAURI_ENV_DEBUG !== undefined ||
    process.env.TAURI_ENV_PLATFORM !== undefined;
  const isAndroid = mode === 'android';

  const resolveAlias: Record<string, string> = {};
  if (!isTauri) {
    resolveAlias['@tauri-apps/plugin-notification'] = path.resolve(
      __dirname,
      'src/stubs/tauri-plugin-notification.ts',
    );
    resolveAlias['@tauri-apps/api/window'] = path.resolve(__dirname, 'src/stubs/tauri-api-window.ts');
    resolveAlias['@tauri-apps/plugin-updater'] = path.resolve(__dirname, 'src/stubs/tauri-plugin-updater.ts');
    resolveAlias['@tauri-apps/plugin-process'] = path.resolve(__dirname, 'src/stubs/tauri-plugin-process.ts');
  }
  if (!isAndroid) {
    resolveAlias['@capacitor/status-bar'] = path.resolve(
      __dirname,
      'src/stubs/capacitor-status-bar.ts',
    );
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? process.env.CODEX_BUILD ?? 'dev'),
    },
    ...(Object.keys(resolveAlias).length > 0 ? { resolve: { alias: resolveAlias } } : {}),

    server: {
      port: 5173,
      strictPort: true,
      host: isTauri ? false : process.env.DOCKER === 'true',
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },

    build: isTauri
      ? {
        target: ['chrome120', 'safari16'],
        minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
      }
      : {},

    base: isTauri ? './' : '/',
  };
});
