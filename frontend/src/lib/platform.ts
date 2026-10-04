/** Platformdetectie op één plek. */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
export const isCapacitor =
  typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';
export const isNative = isTauri || isCapacitor;
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';
