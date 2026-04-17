import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8180';

export default defineConfig(({ mode }) => {
  // isTauri is true when built with --mode tauri (via `tauri build` or `npm run build:tauri`)
  // OR when Tauri CLI sets TAURI_ENV_* during `tauri dev`.
  // Using mode is essential: TAURI_ENV_* vars are only set during the Rust compilation phase,
  // NOT during the beforeBuildCommand frontend build step.
  const isTauri =
    mode === 'tauri' ||
    process.env.TAURI_ENV_DEBUG !== undefined ||
    process.env.TAURI_ENV_PLATFORM !== undefined;

  return {
    plugins: [react()],

    // Inject a compile-time constant so LoginPage.tsx can reliably detect Tauri
    // without depending solely on the __TAURI_INTERNALS__ runtime global.
    define: {
      __TAURI_BUILD__: JSON.stringify(isTauri),
    },

    resolve: {
      alias: isTauri
        ? {}
        : {
          '@tauri-apps/plugin-notification': path.resolve(
            __dirname,
            'src/stubs/tauri-plugin-notification.ts',
          ),
          '@tauri-apps/api/window': path.resolve(__dirname, 'src/stubs/tauri-api-window.ts'),
        },
    },

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
