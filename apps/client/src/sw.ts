/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Precache static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// Claim clients immediately so the Cache API bridge is available on first visit
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Cache API bridge for token persistence ──────────────────────────────
// Shared between Safari and standalone PWA on iOS (unlike localStorage).
// Virtual endpoint: /api/session-cache
const TOKEN_CACHE = 'po-tokens-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/api/session-cache') return;

  if (event.request.method === 'POST') {
    event.respondWith(
      event.request.json().then(async (data: { key: string; value: string }) => {
        const cache = await caches.open(TOKEN_CACHE);
        await cache.put(
          new Request(`/api/session-cache/${data.key}`),
          new Response(data.value),
        );
        return new Response('ok');
      }),
    );
  } else if (event.request.method === 'GET') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(TOKEN_CACHE);
        const keys = await cache.keys();
        const tokens: Record<string, string> = {};
        for (const req of keys) {
          const key = new URL(req.url).pathname.replace('/api/session-cache/', '');
          const res = await cache.match(req);
          if (res) tokens[key] = await res.text();
        }
        return new Response(JSON.stringify(tokens), {
          headers: { 'Content-Type': 'application/json' },
        });
      })(),
    );
  } else if (event.request.method === 'DELETE') {
    event.respondWith(
      event.request.json().then(async (data: { key: string }) => {
        const cache = await caches.open(TOKEN_CACHE);
        await cache.delete(new Request(`/api/session-cache/${data.key}`));
        return new Response('ok');
      }),
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'Pecking Order';
    const options: NotificationOptions & { renotify?: boolean } = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'default',
      renotify: true,
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
