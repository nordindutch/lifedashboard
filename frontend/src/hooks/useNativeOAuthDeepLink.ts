import type { QueryClient } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/*
 * Capacitor + Tauri: OAuth runs in the system browser; backend redirects to
 * `com.codex.life://login-success?token=...`. Same session path for both: store token,
 * cancel stale /api/auth/me, refetch, navigate home.
 *
 * Capacitor: App.getLaunchUrl() + appUrlOpen. Tauri: getCurrent() + onOpenUrl.
 * Registered from RouterShell so handlers exist during the initial auth loading state.
 */

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
const isCapacitor =
  typeof window !== 'undefined' && typeof (window as { Capacitor?: unknown }).Capacitor !== 'undefined';

const AUTH_ME_KEY = ['auth', 'me'] as const;

/** Rust emits `Vec<Url>`; event JSON may be strings or `{ href }` depending on serde. */
function urlsFromDeepLinkPayload(payload: unknown): string[] {
  if (payload == null) {
    return [];
  }
  if (typeof payload === 'string') {
    return [payload];
  }
  if (!Array.isArray(payload)) {
    return [];
  }
  const out: string[] = [];
  for (const item of payload) {
    if (typeof item === 'string') {
      out.push(item);
    } else if (item && typeof item === 'object' && 'href' in item) {
      const h = (item as { href?: unknown }).href;
      if (typeof h === 'string') {
        out.push(h);
      }
    }
  }
  return out;
}

/** Extract session token from custom-scheme OAuth return URLs (parsers differ by WebView). */
export function parseLoginSuccessToken(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (trimmed === '' || !trimmed.includes('login-success')) {
    return null;
  }
  try {
    const u = new URL(trimmed);
    const fromParams = u.searchParams.get('token');
    if (fromParams) {
      return fromParams;
    }
  } catch {
    /* fall through to regex */
  }
  const m = trimmed.match(/[?&]token=([^&]+)/);
  const rawToken = m?.[1];
  return rawToken !== undefined ? decodeURIComponent(rawToken) : null;
}

async function applySessionFromOAuthDeepLink(
  queryClient: QueryClient,
  navigate: (to: string, opts?: { replace?: boolean }) => void,
  token: string,
): Promise<void> {
  localStorage.setItem('codex_session', token);

  await queryClient.cancelQueries({ queryKey: AUTH_ME_KEY });

  await queryClient.refetchQueries({ queryKey: AUTH_ME_KEY });

  const user = queryClient.getQueryData(AUTH_ME_KEY);
  if (user) {
    if (isCapacitor) {
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch {
        /* non-critical */
      }
    }
    navigate('/', { replace: true });
  }
}

export function useNativeOAuthDeepLink(): void {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isTauri && !isCapacitor) {
      return;
    }
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    const handleUrl = (rawUrl: string): void => {
      if (cancelled) {
        return;
      }
      const token = parseLoginSuccessToken(rawUrl);
      if (!token) {
        return;
      }
      void applySessionFromOAuthDeepLink(queryClient, navigate, token);
    };

    void (async () => {
      try {
        if (isTauri) {
          const { getCurrent, onOpenUrl } = await import('@tauri-apps/plugin-deep-link');
          const initial = await getCurrent();
          if (initial) {
            for (const raw of urlsFromDeepLinkPayload(initial)) {
              handleUrl(raw);
            }
          }
          unlisten = await onOpenUrl((payload: unknown) => {
            for (const raw of urlsFromDeepLinkPayload(payload)) {
              handleUrl(raw);
            }
          });
        } else {
          const { App } = await import('@capacitor/app');
          const launch = await App.getLaunchUrl();
          if (launch?.url) {
            handleUrl(launch.url);
          }
          const handler = await App.addListener('appUrlOpen', (event: { url: string }) => {
            handleUrl(event.url);
          });
          unlisten = () => void handler.remove();
        }
      } catch {
        /* non-critical */
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate, queryClient]);
}
