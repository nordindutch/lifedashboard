import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8180';

const isTauri =
  process.env.TAURI_ENV_DEBUG !== undefined || process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
  plugins: [react()],

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
});
