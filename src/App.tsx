import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Summary } from './screens/Summary';
import { Dashboard } from './screens/Dashboard';
import { Settings } from './screens/Settings';
import { Onboarding } from './screens/Onboarding';
import { WelcomeBack } from './screens/WelcomeBack';
import { importWords, db } from './db';
import { detectAbsence } from './reboot/RebootManager';

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    async function check() {
      await importWords();
      const s = await db.settings.get(1);
      setCompleted(s?.onboarding_completed ?? false);
      setChecked(true);
    }
    void check();
  }, []);

  if (!checked) {
    return (
      <main className="home" id="main-content">
        <p className="loading-text">Loading…</p>
      </main>
    );
  }

  if (!completed) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

/**
 * P3-T4: Checks absence type and shows WelcomeBack screen for lapsed/dormant users.
 * After a comeback session completes, switches to normal Home.
 */
function RequireRebootAware({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  useEffect(() => {
    async function check() {
      // If a comeback session just completed, skip welcome-back
      if (sessionStorage.getItem('p3t4_comeback_done')) {
        sessionStorage.removeItem('p3t4_comeback_done');
        setShowWelcomeBack(false);
        setChecking(true);
        setChecking(false);
        return;
      }

      const info = await detectAbsence();
      setShowWelcomeBack(info.type === 'lapsed' || info.type === 'dormant');
      setChecking(false);
    }
    void check();
  }, []);

  if (checking) {
    return (
      <main className="home" id="main-content">
        <p className="loading-text">Loading…</p>
      </main>
    );
  }

  if (showWelcomeBack) {
    return <WelcomeBack />;
  }

  return <>{children}</>;
}

/** Apply reduced-motion body class based on settings and OS preference */
function ReducedMotionManager() {
  useEffect(() => {
    function apply() {
      db.settings.get(1).then((s) => {
        const mode = s?.reduced_motion ?? 'auto';
        const osPrefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (mode === 'on' || (mode === 'auto' && osPrefersReduced)) {
          document.body.classList.add('reduced-motion');
        } else {
          document.body.classList.remove('reduced-motion');
        }
      });
    }
    apply();
    // Re-apply when the setting might change (e.g. after navigating to Settings)
    const interval = setInterval(apply, 2000);
    return () => clearInterval(interval);
  }, []);
  return null;
}

/** Manage focus on route changes for screen readers */
function FocusOnNavigate() {
  const location = useLocation();
  useEffect(() => {
    // Move focus to the main landmark when navigating
    const main = document.querySelector('main');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      main.removeAttribute('tabindex');
    }
  }, [location.pathname]);
  return null;
}

export function App() {
  // P3-T2: log when the PWA is actually installed
  useEffect(() => {
    function onInstalled() {
      console.log('[PWA] App installed');
    }
    window.addEventListener('appinstalled', onInstalled);
    return () => window.removeEventListener('appinstalled', onInstalled);
  }, []);

  return (
    <>
      {/* Skip navigation — visible on keyboard focus */}
      <a href="#main-content" className="skip-nav">
        Skip to content
      </a>
      <ReducedMotionManager />
      <FocusOnNavigate />
      <Routes>
        <Route
          path="/"
          element={
            <RequireOnboarding>
              <RequireRebootAware>
                <Home />
              </RequireRebootAware>
            </RequireOnboarding>
          }
        />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/session" element={<Session />} />
        <Route path="/summary" element={<Summary />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </>
  );
}
