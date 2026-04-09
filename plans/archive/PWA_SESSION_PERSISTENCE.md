# PWA Session Persistence & Service Worker Strategy

## Problem

Two related issues with session persistence:

1. **Dead-end screen in browser**: When the client is at `/game/CODE` with no cached token (expired, cleared, new tab), it shows an "awaiting signal" dead-end instead of recovering.
2. **iOS standalone PWA isolation**: When a player saves the client app to their home screen, iOS gives the standalone app completely isolated storage (localStorage, cookies, IndexedDB) from Safari.

## Architecture: Two Auth Layers

| Layer | Token | Origin | Storage | Lifetime | Purpose |
|-------|-------|--------|---------|----------|---------|
| **Lobby session** | `po_session` cookie | Lobby | HTTP-only cookie | 7 days | "Who is this user?" — durable identity |
| **Game JWT** | `po_token_{CODE}` | Client | `localStorage` + Cache API | `dayCount×2+7` days | "Which player in which game?" — derived credential |

The lobby session is the **authoritative, durable** auth. The game JWT is a **derived, ephemeral** credential that should be recoverable from the lobby session at any time.

**Post ADR-074**: The `po_session` cookie is set with `domain: '.peckingorder.ca'`, making it accessible from both Safari and standalone PWA contexts on the same domain. This means step 3 (lobby API refresh) works universally — not just in browser contexts. The Cache API bridge (step 2) and cookie bridge (`po_pwa_*`) are belt-and-suspenders for edge cases but are no longer strictly required for auth recovery.

## Token Recovery Chain

When the client loads `/game/CODE`, it walks this chain. Steps 1-3 are seamless (no page navigation). Only step 4 requires user interaction.

```
1. localStorage has valid JWT?     → use it (fastest path)
2. Cache API has valid JWT?        → restore to localStorage, use it
3. po_session cookie reachable?    → fetch lobby API, get fresh JWT, store it
4. Nothing works?                  → redirect to lobby login (last resort)
```

### Why each step exists

| Step | Solves | Context |
|------|--------|---------|
| 1. localStorage | Page refresh, new tab, browser restart, PWA relaunch | All browsers |
| 2. Cache API | Fallback within same context (e.g., cleared localStorage) | All browsers |
| 3. Lobby API | JWT expired or cleared, but user still logged in via `po_session` | All contexts on `.peckingorder.ca` (ADR-074) |
| 4. Lobby redirect | No session anywhere — user must log in | All contexts, last resort |

## Service Worker Strategy

### Plugin: `vite-plugin-pwa` with `injectManifest`

We use `injectManifest` (not `generateSW`) because we have custom service worker logic for push notifications. The plugin compiles our `src/sw.ts` and injects the workbox precache manifest.

### Auto-Update Lifecycle

Configured for seamless deploys during active playtesting — no user action required.

**vite.config.ts:**
```typescript
VitePWA({
  strategies: 'injectManifest',
  registerType: 'autoUpdate',
  srcDir: 'src',
  filename: 'sw.ts',
  injectRegister: false,
  // ...
})
```

**sw.ts:**
```typescript
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();       // Activate immediately, don't wait for old SW to release
clientsClaim();           // Take control of all open tabs/PWA instances
cleanupOutdatedCaches();  // Remove precached assets from previous SW versions
precacheAndRoute(self.__WB_MANIFEST);
```

**main.tsx:**
```typescript
import { registerSW } from 'virtual:pwa-register';
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    // Standalone PWAs don't get navigation-triggered SW checks,
    // so poll hourly to catch deploys while the app is open
    if (!registration) return;
    setInterval(async () => {
      if (registration.installing || !navigator) return;
      if ('connection' in navigator && !navigator.onLine) return;
      const resp = await fetch(swUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      });
      if (resp?.status === 200) await registration.update();
    }, 60 * 60 * 1000);
  },
});
```

### Update Flow

1. **Deploy**: New build uploads to Cloudflare Pages with new `sw.js` (content hash changes)
2. **App open**: `registerSW({ immediate: true })` checks for SW updates on load
3. **App backgrounded**: Hourly periodic check catches deploys while the PWA is open
4. **New SW found**: Browser downloads and installs new SW
5. **`skipWaiting()`**: New SW activates immediately (doesn't wait for old SW to release)
6. **`clientsClaim()`**: New SW takes control of all open tabs/PWA instances
7. **`cleanupOutdatedCaches()`**: Old precached assets removed (MD5 hash-based revision tracking — only changed files are re-downloaded)
8. **Page reload**: Triggered by `registerSW`, app loads with new assets

**No reinstall needed.** `skipWaiting()` runs in the new SW's install phase. Even if the old SW didn't have auto-update, the new SW activates itself immediately.

### Precaching

Default `globPatterns` of `**/*.{js,css,html}` plus `includeManifestIcons: true` (default). This precaches:
- All JS chunks (including lazy-loaded game components, shells, cartridges)
- CSS bundle
- `index.html`
- All manifest icons (192, 512, 512-maskable)
- Badge icon (72px, for push notifications)
- `manifest.webmanifest`

**~35 entries, ~1.2 MB total.** After install, the only network traffic is WebSocket messages and API calls (push subscribe, lobby refresh). All static assets are served from cache.

Cache invalidation is automatic — workbox assigns MD5 content hashes to each entry. On deploy, only changed files are re-downloaded. `cleanupOutdatedCaches()` removes old revisions.

### Dynamic Manifest Override

`updatePwaManifest()` in App.tsx creates a `data:` URL manifest with `start_url: /game/CODE?_t=JWT` when a token is applied. This overrides the static manifest's `start_url: /` so that iOS "Add to Home Screen" installs a pre-authenticated PWA.

**Known issue (PROD-026):** If the game is later deleted, the baked `start_url` leads to a stale game. The expired-token guard catches truly expired JWTs, but valid-but-stale tokens (game deleted before JWT expiry) pass through and render an empty shell. See KNOWN_ISSUES.md PROD-026 for the long-term fix (push-based invites + launcher-first `start_url`).

## Status

- [x] `sessionStorage` → `localStorage` migration
- [x] Game-duration JWT expiry (`dayCount × 2 + 7` days)
- [x] Auto-cleanup of expired tokens
- [x] Cache API bridge (direct `caches.open()` from page context, not SW fetch handler)
- [x] Cookie bridge (`po_pwa_*` for iOS 17.2+ Safari→PWA one-time copy)
- [x] Lobby refresh-token API endpoint (`GET /api/refresh-token/CODE`)
- [x] Client recovery chain with async fallbacks (localStorage → cookie → Cache API → lobby API → redirect)
- [x] CORS setup for lobby ↔ client credential sharing
- [x] Cross-subdomain `po_session` cookie (ADR-074, `.peckingorder.ca`)
- [x] SW auto-update: `skipWaiting` + `clientsClaim` + `cleanupOutdatedCaches` (PROD-027)
- [x] Periodic SW update check (hourly, for standalone PWAs)
- [x] Full static asset precaching (~35 entries, ~1.2 MB)
- [ ] Game validity check before shell render (PROD-026)
- [ ] Push-based invites for returning players (PROD-026, deferred)
- [ ] Launcher-first `start_url` (blocked on in-PWA join flow)

## References

- [vite-plugin-pwa documentation](https://vite-pwa-org.netlify.app/guide/)
- [Sharing State Between PWA and Safari on iOS (Netguru)](https://www.netguru.com/blog/how-to-share-session-cookie-or-state-between-pwa-in-standalone-mode-and-safari-on-ios)
- [PWA iOS Limitations Guide (MagicBell)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [PWAs on iOS 2026 (MobiLoud)](https://www.mobiloud.com/blog/progressive-web-apps-ios)
