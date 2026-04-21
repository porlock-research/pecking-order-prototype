/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import type { DeepLinkIntent } from '@pecking-order/shared-types';
import { parseIntentFromData, buildIntentUrl } from './sw-intent-helpers';

declare const self: ServiceWorkerGlobalScope;

// Auto-update: activate new SW immediately without waiting for tabs to close.
// Combined with registerSW({ immediate: true }) in main.tsx, deploys are
// picked up automatically — critical during active playtesting.
self.skipWaiting();
clientsClaim();

// Remove precached assets from previous SW versions
cleanupOutdatedCaches();

// Precache static assets injected by vite-plugin-pwa
precacheAndRoute(self.__WB_MANIFEST);

// ── Persona avatar caching ───────────────────────────────────────────────
// Cache persona images (headshot, medium, full) from assets CDN.
// CacheFirst: avatars never change once generated, so serve from cache
// and avoid redundant network requests.
// NOTE: Cross-origin opaque responses (status 0) are NOT cached by default.
// Once CORS headers are added to the assets CDN, this will cache properly.
// For now, browser HTTP cache handles avatar caching.
registerRoute(
  ({ url }) =>
    url.pathname.includes('/personas/') &&
    /\.(png|jpg|jpeg|webp)$/i.test(url.pathname),
  new CacheFirst({
    cacheName: 'persona-avatars',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
);

// ── Token persistence ────────────────────────────────────────────────────
// Token read/write now uses caches.open() directly from the page context
// (App.tsx), bypassing the SW entirely. This avoids the race condition where
// navigator.serviceWorker.controller is null on first visit, preventing the
// Cache API write. The SW no longer needs a fetch handler for token storage.

// Push notification handler
// No tags, no renotify — every notification is unique because XState state
// transitions fire exactly once. Every push should alert the user.
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW] Received push event with no data');
    // Show fallback to avoid browser revoking push permission
    event.waitUntil(
      self.registration.showNotification('Pecking Order', { body: 'New update available' }),
    );
    return;
  }

  try {
    const data = event.data.json();
    const title = data.title || 'Pecking Order';
    const intent = parseIntentFromData(data);
    const options: NotificationOptions = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      requireInteraction: true,
      data: { url: data.url || self.location.origin, intent },
    };

    // If push includes a game token, store in Cache API for token recovery
    if (data.token && data.url) {
      const match = data.url.match(/\/game\/([A-Za-z0-9]+)/);
      if (match) {
        const code = match[1];
        caches.open('po-tokens-v1').then(cache =>
          cache.put(
            new Request(`/po-token-cache/po_token_${code}`),
            new Response(data.token),
          )
        ).catch((err) => console.warn('[SW] Push token cache write failed:', err));
      }
    }

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn('[SW] Push payload parse failed, falling back to text:', err);
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Pecking Order', { body: text }),
    );
  }
});

// Notification click handler — focus existing window and postMessage the
// DeepLinkIntent, or open a new window with the intent encoded in ?intent=.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data?.url as string) || self.location.origin;
  const intent = (event.notification.data?.intent as DeepLinkIntent | null) ?? null;
  console.log('[SW] Notification clicked, target:', targetUrl, 'intent:', intent);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      console.log('[SW] Found', clients.length, 'client window(s)');
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          const currentPath = new URL(client.url).pathname;
          const targetPath = new URL(targetUrl).pathname;
          // Same-pathname navigate() reloads the page, racing postMessage
          // against the new mount (which has no ?intent= to fall back on).
          // Only navigate on cross-page jumps, and carry the intent in the
          // URL so the fresh useDeepLinkIntent mount can pick it up.
          if (currentPath !== targetPath && 'navigate' in client) {
            const navUrl = intent ? buildIntentUrl(targetUrl, intent) : targetUrl;
            await (client as WindowClient).navigate(navUrl);
          }
          const focused = await (client as WindowClient).focus();
          if (intent) focused.postMessage({ type: 'DEEP_LINK_INTENT', intent });
          return;
        }
      }
      // Cold start: carry intent in URL so the hook can pick it up on mount
      const openUrl = intent ? buildIntentUrl(targetUrl, intent) : targetUrl;
      console.log('[SW] No existing window, opening:', openUrl);
      return self.clients.openWindow(openUrl);
    }).catch((err) => console.error('[SW] Notification click navigation failed:', err)),
  );
});
