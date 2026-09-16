import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles/index.css';

// ---------------------------------------------------------------------------
// Service Worker registration
// ---------------------------------------------------------------------------

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[SW] Registered with scope:', reg.scope);

        // Listen for a new SW taking over (autoUpdate triggers this)
        let swActivated = false;
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'activated' &&
              !swActivated
            ) {
              swActivated = true;
              console.log('[SW] Active — offline support ready');
              showToast('App ready for offline use');
            }
          });
        });
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  });
}

// ---------------------------------------------------------------------------
// Minimal offline toast (no external deps)
// ---------------------------------------------------------------------------

function showToast(message: string) {
  const existing = document.getElementById('sw-toast');
  if (existing) return;

  const toast = document.createElement('div');
  toast.id = 'sw-toast';
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#3F7D5D',
    color: '#FBFAF7',
    padding: '0.6rem 1.2rem',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontFamily: 'system-ui, sans-serif',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 0.3s ease',
  });
  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
  });

  // Fade out after 3s
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

// ---------------------------------------------------------------------------
// Mount React app
// ---------------------------------------------------------------------------

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
