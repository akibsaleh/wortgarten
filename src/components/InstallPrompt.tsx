import { useEffect, useState } from 'react';
import { db } from '../db';

/**
 * P3-T2: PWA install prompt.
 *
 * - Listens for the browser's `beforeinstallprompt` event.
 * - Only shows after ≥3 completed sessions (reviewLogs count ≥ 3).
 * - Dismissible: "Not now" hides for 7 days via localStorage.
 * - Never re-nags after dismissal within the 7-day window (dark-pattern NFR).
 */
const DISMISS_KEY = 'wortgarten_install_dismissed';
const DISMISS_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if previously dismissed within the cooldown window
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = Number(dismissed);
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return;
    }

    // Count review logs to gate the prompt behind ≥3 sessions
    let cancelled = false;

    void db.reviewLogs.count().then((count) => {
      if (cancelled || count < 3) return;

      function handler(e: Event) {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setVisible(true);
      }

      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    setDeferredPrompt(null);
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      className="install-banner"
      role="status"
      aria-label="Install Wortgarten"
    >
      <p className="install-banner-text">
        Add Wortgarten to your home screen for offline learning
      </p>
      <div className="install-banner-actions">
        <button
          onClick={handleInstall}
          className="btn-primary install-banner-btn"
          aria-label="Install Wortgarten"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="btn-text install-banner-btn"
          aria-label="Dismiss install prompt"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
