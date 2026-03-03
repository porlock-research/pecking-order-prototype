import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// React 19 error handlers — global safety net that captures all React errors
// to Sentry, including errors not caught by ErrorBoundary components.
ReactDOM.createRoot(document.getElementById('root')!, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// Register service worker for PWA + push notifications
// Uses vite-plugin-pwa's virtual module to handle dev/prod paths correctly.
// autoUpdate + skipWaiting + clientsClaim: new SW activates immediately on deploy.
// Periodic check: standalone PWAs don't get navigation-triggered SW checks like
// browser tabs, so we poll hourly to catch deploys while the app is open.
import { registerSW } from 'virtual:pwa-register';
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    console.log('[SW] Registered at', swUrl);
    if (!registration) return;
    setInterval(async () => {
      if (registration.installing || !navigator) return;
      if ('connection' in navigator && !navigator.onLine) return;
      try {
        const resp = await fetch(swUrl, {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        });
        if (resp?.status === 200) await registration.update();
      } catch (err) {
        console.warn('[SW] Hourly update check failed:', err);
      }
    }, 60 * 60 * 1000); // check hourly
  },
  onRegisterError(error) {
    console.error('[SW] Registration failed:', error);
  },
});
