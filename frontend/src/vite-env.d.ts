/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CODEX_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected at build time by vite.config.ts define: true for Tauri builds, false otherwise.
declare const __TAURI_BUILD__: boolean;
