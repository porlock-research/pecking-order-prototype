/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Claim clients immediately so the Cache API bridge is available on first visit
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Token persistence ────────────────────────────────────────────────────
// Token read/write now uses caches.open() directly from the page context
// (App.tsx), bypassing the SW entirely. This avoids the race condition where
// navigator.serviceWorker.controller is null on first visit, preventing the
// Cache API write. The SW no longer needs a fetch handler for token storage.

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Pecking Order';
    const tag = data.tag || 'default';
    // DMs, eliminations, and winner notifications deserve their own alert sound;
    // phase/activity notifications silently replace the existing one.
    const renotify = tag.startsWith('dm-') || tag === 'elimination' || tag === 'winner';
    const options: NotificationOptions & { renotify?: boolean } = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag,
      renotify,
      // Keep notification visible until user interacts (no auto-dismiss on desktop).
      // Important notifications (DMs, eliminations, winner) always persist;
      // phase notifications persist too since they're time-sensitive game events.
      requireInteraction: true,
      data: { url: data.url || self.location.origin },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Fallback for non-JSON payloads
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Pecking Order', { body: text }),
    );
  }
});

// Notification click handler — focus or open game tab
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data?.url as string) || self.location.origin;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if found
      for (const client of clients) {
        if (client.url.startsWith(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return self.clients.openWindow(targetUrl);
    }),
  );
});
