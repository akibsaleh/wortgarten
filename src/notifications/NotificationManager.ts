/**
 * Local notification manager using the Web Notification API.
 *
 * ─── Platform limitations ────────────────────────────────────────────
 * • iOS Safari (standalone web app): VERY LIMITED — no background
 *   notifications; the Notification API is partially available since
 *   iOS 16.4 but only fires when the page is foregrounded. Push
 *   subscriptions are not supported without a full Web Push setup.
 * • Android Chrome: FULL support — notifications work in background
 *   when the PWA is installed. Web Push via service worker is also
 *   available.
 * • Desktop browsers (Chrome, Edge, Firefox, Safari): FULL support —
 *   persistent notifications and, where a service worker is
 *   registered, background delivery.
 * • PWA installed (Add to Home Screen): BETTER support than a plain
 *   browser tab — on Android this enables background notification
 *   delivery; on iOS 16.4+ it enables foreground-only delivery.
 *
 * Because the Notification API is unreliable across platforms, all
 * notification logic is strictly opt-in and gracefully degrades when
 * the API is unavailable or permission is denied.
 * ─────────────────────────────────────────────────────────────────────
 */

const STORAGE_KEY_LAST_NOTIFIED = 'wortgarten:last-notified-date';

/** Local quiet-hours window (24 h clock). Notifications are suppressed in this range. */
const QUIET_START = 22; // 22:00
const QUIET_END = 7; // 07:00

/** Check whether the Notification API is available at all. */
export function isSupported(): boolean {
  return typeof Notification !== 'undefined';
}

/** Return the current permission state, or 'unavailable' if the API is missing. */
export function getPermission(): NotificationPermission | 'unavailable' {
  if (!isSupported()) return 'unavailable';
  return Notification.permission;
}

/** Request browser notification permission. Returns the resulting state. */
export async function requestPermission(): Promise<NotificationPermission | 'unavailable'> {
  if (!isSupported()) return 'unavailable';
  // Safari throws if permission is already granted or denied — guard.
  if (Notification.permission !== 'default') return Notification.permission;
  return await Notification.requestPermission();
}

/** Whether the current local time falls inside quiet hours. */
export function isQuietHours(): boolean {
  const hour = new Date().getHours();
  if (QUIET_START > QUIET_END) {
    // crosses midnight (e.g. 22 → 7)
    return hour >= QUIET_START || hour < QUIET_END;
  }
  return hour >= QUIET_START && hour < QUIET_END;
}

/** Whether we already fired a notification today. */
export function alreadyNotifiedToday(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY_LAST_NOTIFIED);
  if (!stored) return false;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return stored === today;
}

function markNotifiedToday(): void {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STORAGE_KEY_LAST_NOTIFIED, today);
}

/**
 * Show a single local notification (fire-and-forget).
 * Respects quiet hours and the max-1-per-day policy.
 * Returns `true` if the notification was actually shown.
 */
export function showNotification(
  title: string,
  options?: NotificationOptions,
): boolean {
  if (!isSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  if (isQuietHours()) return false;
  if (alreadyNotifiedToday()) return false;

  // eslint-disable-next-line no-new
  new Notification(title, options);
  markNotifiedToday();
  return true;
}

/**
 * Schedule a daily reminder at the given local hour:minute.
 *
 * Because the Notification API does not support native scheduling
 * without a service worker / push backend, we use a lightweight
 * `setInterval`-based timer that checks every 30 seconds whether
 * the target time has been reached. This works only while the page
 * (or PWA) is open — it is NOT a background timer.
 *
 * Returns a cleanup function that clears the interval.
 */
export function scheduleReminder(
  hour: number,
  minute: number,
): () => void {
  const LABEL = 'Wortgarten';
  const BODY = 'Time for a quick review — keep your streak going! 🌱';

  // Immediately clear any previous interval stored globally.
  cancelAllReminders();

  let lastFiredDate = '';

  const intervalId = window.setInterval(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const todayKey = now.toISOString().slice(0, 10);

    if (
      currentHour === hour &&
      currentMinute === minute &&
      lastFiredDate !== todayKey
    ) {
      lastFiredDate = todayKey;
      showNotification(LABEL, { body: BODY, icon: '/pwa-192x192.png', tag: 'wortgarten-reminder' });
    }
  }, 30_000); // check every 30 s

  // Store the interval id globally so `cancelAllReminders` can clear it.
  (window as unknown as Record<string, unknown>).__wortgartenReminderInterval = intervalId;

  return () => {
    clearInterval(intervalId);
    delete (window as unknown as Record<string, unknown>).__wortgartenReminderInterval;
  };
}

/** Cancel all locally scheduled reminders (clears the interval). */
export function cancelAllReminders(): void {
  const id = (window as unknown as Record<string, unknown>).__wortgartenReminderInterval as number | undefined;
  if (id != null) {
    clearInterval(id);
    delete (window as unknown as Record<string, unknown>).__wortgartenReminderInterval;
  }
}
