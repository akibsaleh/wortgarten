import { useEffect, useState, useCallback } from 'react';
import { db } from '../db';
import {
  isSupported as apiSupported,
  getPermission,
  requestPermission as reqPermission,
  scheduleReminder as schedule,
  cancelAllReminders,
} from './NotificationManager';

export interface NotificationState {
  /** Whether the Notification API is available on this platform. */
  isSupported: boolean;
  /** Current permission state ('unavailable' when API is missing). */
  permission: NotificationPermission | 'unavailable';
  /** Whether the user has opted in via the Settings toggle. */
  enabled: boolean;
  /** The stored reminder time in "HH:MM" format. */
  reminderTime: string;
  /** Request browser notification permission and persist preference. */
  requestPermission: () => Promise<void>;
  /** Schedule (or re-schedule) the daily reminder. */
  scheduleReminder: (hour: number, minute: number) => void;
  /** Cancel reminders and disable the feature. */
  cancelAll: () => Promise<void>;
  /** Toggle enabled state from Settings UI. */
  toggleEnabled: () => Promise<void>;
  /** Update the reminder time and reschedule. */
  setReminderTime: (time: string) => Promise<void>;
}

/**
 * React hook that bridges the NotificationManager with Dexie-stored
 * user preferences. All operations silently no-op when the platform
 * does not support notifications.
 */
export function useNotifications(): NotificationState {
  const [permission, setPermission] = useState<NotificationPermission | 'unavailable'>(() => getPermission());
  const [enabled, setEnabled] = useState(false);
  const [reminderTime, setReminderTimeState] = useState('09:00');
  const supported = apiSupported();

  // Load settings from DB on mount
  useEffect(() => {
    db.settings.get(1).then((s) => {
      if (!s) return;
      setEnabled(s.notifications_enabled);
      setReminderTimeState(s.notification_time);
    });
  }, []);

  // Sync the interval-based reminder when enabled / time changes
  useEffect(() => {
    if (!enabled || !supported || permission !== 'granted') {
      cancelAllReminders();
      return;
    }
    const parts = reminderTime.split(':');
    const h = Number(parts[0] ?? '');
    const m = Number(parts[1] ?? '');
    if (Number.isNaN(h) || Number.isNaN(m)) return;
    const cleanup = schedule(h, m);
    return cleanup;
  }, [enabled, reminderTime, supported, permission]);

  const requestPermission = useCallback(async () => {
    if (!supported) return;
    const result = await reqPermission();
    setPermission(result);
    if (result === 'granted') {
      await db.settings.update(1, { notifications_enabled: true });
      setEnabled(true);
    }
  }, [supported]);

  const scheduleReminderCb = useCallback(
    async (hour: number, minute: number) => {
      const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      setReminderTimeState(time);
      await db.settings.update(1, { notification_time: time });
    },
    [],
  );

  const cancelAll = useCallback(async () => {
    cancelAllReminders();
    await db.settings.update(1, { notifications_enabled: false });
    setEnabled(false);
  }, []);

  const toggleEnabled = useCallback(async () => {
    if (enabled) {
      await cancelAll();
    } else {
      // If we haven't asked for permission yet, request it first.
      if (supported && permission === 'default') {
        await requestPermission();
      }
      await db.settings.update(1, { notifications_enabled: true });
      setEnabled(true);
    }
  }, [enabled, supported, permission, requestPermission]);

  const setReminderTime = useCallback(async (time: string) => {
    setReminderTimeState(time);
    await db.settings.update(1, { notification_time: time });
  }, []);

  return {
    isSupported: supported,
    permission,
    enabled,
    reminderTime,
    requestPermission,
    scheduleReminder: scheduleReminderCb,
    cancelAll,
    toggleEnabled,
    setReminderTime,
  };
}
