import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Home } from './screens/Home';
import { Session } from './screens/Session';
import { Summary } from './screens/Summary';
import { Dashboard } from './screens/Dashboard';
import { Settings } from './screens/Settings';
import { Onboarding } from './screens/Onboarding';
import { importWords, db } from './db';

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
        <p style={{ color: 'var(--color-neutral-3)' }}>Loading…</p>
      </main>
    );
  }

  if (!completed) {
    return <Navigate to="/onboarding" replace />;
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
              <Home />
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
