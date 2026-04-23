const CHECKIN_HOURS = [8, 12, 15, 18, 21];
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Capacitor detection — Capacitor sets window.Capacitor
const isCapacitor =
  typeof window !== 'undefined' && typeof (window as unknown as { Capacitor?: unknown }).Capacitor !== 'undefined';

let clickFocusRegistered = false;
let scheduleStartedDate = '';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// --- Tauri notification helpers ---

async function requestPermissionTauri(): Promise<boolean> {
  try {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === 'granted';
    }
    return granted;
  } catch {
    return false;
  }
}

async function registerNotificationClickFocusTauri(): Promise<void> {
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

async function sendMoodNotificationTauri(hour: number): Promise<void> {
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({
      title: 'Mood check-in',
      body: `It's ${String(hour).padStart(2, '0')}:00 — how are you feeling?`,
    });
  } catch {
    // non-critical
  }
}

// --- Capacitor notification helpers ---

async function requestPermissionCapacitor(): Promise<boolean> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') return true;
    if (status.display === 'denied') return false;
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

async function scheduleCapacitorNotifications(): Promise<void> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const now = new Date();

    const notifications = CHECKIN_HOURS
      .map((hour, index) => {
        const target = new Date();
        target.setHours(hour, 0, 0, 0);
        if (target.getTime() <= now.getTime()) return null;
        return {
          id: 100 + index, // stable IDs so re-scheduling replaces old ones
          title: 'Mood check-in',
          body: `It's ${String(hour).padStart(2, '0')}:00 — how are you feeling?`,
          schedule: { at: target },
          smallIcon: 'ic_stat_codex',
          actionTypeId: 'MOOD_CHECKIN',
          extra: { type: 'mood', hour },
        };
      })
      .filter(Boolean);

    await LocalNotifications.cancel({
      notifications: CHECKIN_HOURS.map((_, i) => ({ id: 100 + i })),
    });

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications: notifications as never[] });
    }
  } catch {
    // non-critical
  }
}

// --- Evening summary notification (Capacitor only) ---

export async function sendEveningNotificationCapacitor(): Promise<void> {
  if (!isCapacitor) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 200,
          title: 'Day summary ready',
          body: 'Your end-of-day reflection is ready. Time to close off the day.',
          schedule: { at: new Date(Date.now() + 1000) },
          smallIcon: 'ic_stat_codex',
          actionTypeId: 'EVENING_SUMMARY',
        },
      ],
    });
  } catch {
    // non-critical
  }
}

// --- Main export ---

export async function scheduleMoodNotifications(): Promise<void> {
  const today = todayStr();
  if (scheduleStartedDate === today) return;
  scheduleStartedDate = today;

  if (isTauri) {
    const granted = await requestPermissionTauri();
    if (!granted) return;

    await registerNotificationClickFocusTauri();

    const now = new Date();
    const nowMs = now.getTime();
    for (const hour of CHECKIN_HOURS) {
      const target = new Date();
      target.setHours(hour, 0, 0, 0);
      const delayMs = target.getTime() - nowMs;
      if (delayMs < 0) continue;
      window.setTimeout(() => {
        void sendMoodNotificationTauri(hour);
      }, delayMs);
    }
    return;
  }

  if (isCapacitor) {
    const granted = await requestPermissionCapacitor();
    if (!granted) return;
    await scheduleCapacitorNotifications();
  }
}
