import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
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
    if (!registration) return;
    setInterval(async () => {
      if (registration.installing || !navigator) return;
      if ('connection' in navigator && !navigator.onLine) return;
      const resp = await fetch(swUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      });
      if (resp?.status === 200) await registration.update();
    }, 60 * 60 * 1000); // check hourly
  },
});