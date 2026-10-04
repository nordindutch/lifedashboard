/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_CODEX_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versie uit de root package.json, gezet in vite.config.ts */
declare const __APP_VERSION__: string;
/** Korte git-sha van de build, of "dev" */
declare const __APP_BUILD__: string;
