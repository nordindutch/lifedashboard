import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8180';

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

  return {
    plugins: [react()],
    ...(!isTauri
      ? {
          resolve: {
            alias: {
              '@tauri-apps/plugin-notification': path.resolve(
                __dirname,
                'src/stubs/tauri-plugin-notification.ts',
              ),
              '@tauri-apps/api/window': path.resolve(__dirname, 'src/stubs/tauri-api-window.ts'),
            },
          },
        }
      : {}),

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
