import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8180';

const isTauri =
  process.env.TAURI_ENV_DEBUG !== undefined || process.env.TAURI_ENV_PLATFORM !== undefined;

export default defineConfig({
  plugins: [react()],

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
        target: ['chrome105', 'safari13'],
        minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
        sourcemap: !!process.env.TAURI_ENV_DEBUG,
      }
    : {},

  base: isTauri ? './' : '/',
});
