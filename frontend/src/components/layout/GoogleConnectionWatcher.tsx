import { useEffect, useRef } from 'react';
import { useIntegrationStatus } from '../../hooks/useIntegrationStatus';
import { useUiStore } from '../../stores/uiStore';

const GOOGLE_DISCONNECT_MESSAGE =
  'Google-verbinding verlopen. Agenda en Gmail synchroniseren niet meer — koppel opnieuw via Instellingen.';

export function GoogleConnectionWatcher() {
  const { data: status } = useIntegrationStatus();
  const pushToast = useUiStore((s) => s.pushToast);
  const prevConnected = useRef<boolean | null>(null);
  const notifiedExpired = useRef(false);

  useEffect(() => {
    if (status === undefined) {
      return;
    }

    const connected = status.google;
    const expired = status.google_disconnect_reason === 'expired';

    if (prevConnected.current === true && !connected && expired) {
      pushToast({ message: GOOGLE_DISCONNECT_MESSAGE, tone: 'error' });
      notifiedExpired.current = true;
    }

    if (!connected && expired && prevConnected.current === null && !notifiedExpired.current) {
      pushToast({ message: GOOGLE_DISCONNECT_MESSAGE, tone: 'error' });
      notifiedExpired.current = true;
    }

    if (connected) {
      notifiedExpired.current = false;
    }

    prevConnected.current = connected;
  }, [status, pushToast]);

  return null;
}
