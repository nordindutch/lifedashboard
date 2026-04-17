import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * Bug 2 — Android OAuth return: `appUrlOpen` must be registered as soon as the app
 * mounts. The listener previously lived only on `LoginPage`, which is not mounted
 * while `useAuth` is still loading (spinner) or if routing skips `/login`, so the OS
 * could deliver `com.codex.life://login-success?...` before any handler existed and
 * the session token was lost. Registering here (inside `RouterShell`, always mounted)
 * covers cold start + OAuth return reliably.
 */

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const isCapacitor =
  typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';

export function useNativeOAuthDeepLink(): void {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isTauri && !isCapacitor) return;
    let unlisten: (() => void) | null = null;
    void (async () => {
      try {
        if (isTauri) {
          const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
          unlisten = await onOpenUrl((urls: string[]) => {
            for (const raw of urls) {
              const url = new URL(raw);
              if (url.host === 'login-success') {
                const token = url.searchParams.get('token');
                if (token) {
                  localStorage.setItem('codex_session', token);
                  void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }).then(() => {
                    navigate('/', { replace: true });
                  });
                }
              }
            }
          });
        } else {
          const { App } = await import('@capacitor/app');
          const handler = await App.addListener('appUrlOpen', (data: { url: string }) => {
            const url = new URL(data.url);
            if (url.host === 'login-success') {
              const token = url.searchParams.get('token');
              if (token) {
                localStorage.setItem('codex_session', token);
                void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] }).then(() => {
                  navigate('/', { replace: true });
                });
              }
            }
          });
          unlisten = () => void handler.remove();
        }
      } catch {
        /* non-critical */
      }
    })();
    return () => unlisten?.();
  }, [navigate, queryClient]);
}
