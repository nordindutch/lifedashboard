const CHECKIN_HOURS = [8, 12, 15, 18, 21];

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let clickFocusRegistered = false;
let scheduleStarted = false;

async function registerNotificationClickFocus(): Promise<void> {
  if (!isTauri || clickFocusRegistered) {
    return;
  }
  try {
    const { onAction } = await import('@tauri-apps/plugin-notification');
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await onAction(() => {
      void (async () => {
        try {
          const win = getCurrentWindow();
          await win.show();
          await win.setFocus();
        } catch {
          // non-critical
        }
      })();
    });
    clickFocusRegistered = true;
  } catch {
    // non-critical
  }
}

async function requestPermission(): Promise<boolean> {
  if (!isTauri) {
    return false;
  }
  try {
    const { isPermissionGranted, requestPermission: req } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await req();
      granted = permission === 'granted';
    }
    return granted;
  } catch {
    return false;
  }
}

async function sendMoodNotification(hour: number): Promise<void> {
  if (!isTauri) {
    return;
  }
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({
      title: 'Mood check-in',
      body: `It's ${String(hour).padStart(2, '0')}:00 — how are you feeling?`,
    });
  } catch {
    // Silently ignore — notification is non-critical
  }
}

export async function scheduleMoodNotifications(): Promise<void> {
  if (!isTauri || scheduleStarted) {
    return;
  }
  scheduleStarted = true;

  const granted = await requestPermission();
  if (!granted) {
    return;
  }

  await registerNotificationClickFocus();

  const now = new Date();
  const nowMs = now.getTime();

  for (const hour of CHECKIN_HOURS) {
    const target = new Date();
    target.setHours(hour, 0, 0, 0);
    const delayMs = target.getTime() - nowMs;

    if (delayMs < 0) {
      continue;
    }

    window.setTimeout(() => {
      void sendMoodNotification(hour);
    }, delayMs);
  }
}
