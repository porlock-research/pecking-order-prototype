# Feature: PWA Push Notifications

> Offline-first alerts that pull players back into the game when it's their turn to act.

---

## Overview

Pecking Order is played asynchronously — players aren't always looking at the game. Push notifications are the heartbeat that keeps the game moving: they tell players when a new day starts, when voting opens, when someone sends a DM, and when someone gets eliminated.

The system is built on the **Web Push Protocol** (RFC 8291) with VAPID authentication, running entirely on Cloudflare infrastructure. No third-party push services (Firebase, OneSignal) are involved. The client is a PWA that registers a service worker for both precaching and push handling.

```
Browser (SW)         Client (React)         L1 (DO/server.ts)         Push Service (FCM/Mozilla)
    |                     |                        |                           |
    |<-- registerSW() ----|                        |                           |
    |                     |                        |                           |
    |                     |-- WS connect --------->|                           |
    |                     |                        |                           |
    |<- getSubscription() |                        |                           |
    |-- existing sub? --->|                        |                           |
    |                     |-- PUSH.SUBSCRIBE ----->|                           |
    |                     |   + returnUrl          |-- storage.put(sub) ------>|
    |                     |                        |-- storage.put(url) ------>|
    |                     |                        |                           |
    |                     |        ... game progresses ...                     |
    |                     |                        |                           |
    |                     |                        |-- state transition ------>|
    |                     |                        |   detected (L2 sub)       |
    |                     |                        |                           |
    |                     |                        |-- buildPushHTTPRequest -->|
    |                     |                        |   (payload includes url)  |
    |                     |                        |-- fetch(endpoint, ...) -->|
    |                     |                        |                           |-- deliver to browser
    |<-- push event ------|------------------------|---------------------------|
    |-- showNotification  |                        |                           |
    |   (url from data)   |                        |                           |
    |                     |                        |                           |
    |<-- click ---------->|                        |                           |
    |-- focus/open tab -->|  (opens returnUrl      |                           |
    |                     |   with game token)     |                           |
```

---

## Architecture

### Two Push Trigger Paths

Push notifications originate from two distinct paths in L1, both inside the L2 actor's `.subscribe()` callback:

| Path | Trigger | Scope | Examples |
|------|---------|-------|----------|
| **Fact-driven** | `FACT.RECORD` event in L1's `persistFactToD1` action override | Targeted or broadcast | DM received, elimination, winner declared |
| **State-transition-driven** | L2+L3 state string changes detected in the subscription | Broadcast only | Day started, activity started, voting opened, night fallen, game time |

Both paths converge on the same `pushToPlayer()` / `pushBroadcast()` methods in `push-triggers.ts`.

### Why Two Paths?

Facts represent **discrete game events** — a specific player sent a DM, a specific player was eliminated. These are ideal for targeted notifications ("X sent you a DM") and happen at unpredictable times.

State transitions represent **phase changes** — the game moved from group chat to voting. These affect all players equally and are detected by comparing serialized state strings between subscription fires.

### Configurable Triggers

Each trigger can be enabled/disabled per game via `pushConfig` on the game manifest. The lobby debug panel exposes toggles for all 8 triggers. Default: all ON.

```typescript
// shared-types
export const PushTriggerSchema = z.enum([
  'DM_SENT', 'ELIMINATION', 'WINNER_DECLARED',
  'DAY_START', 'ACTIVITY', 'VOTING', 'NIGHT_SUMMARY', 'DAILY_GAME',
]);

// Checked before every push
isPushEnabled(manifest, 'VOTING') // reads manifest.pushConfig, falls back to DEFAULT_PUSH_CONFIG
```

---

## Server-Side Pipeline

### Module Structure

Push logic is split across two files extracted from server.ts:

| File | Purpose |
|------|---------|
| `push.ts` | Low-level: DO storage CRUD, `@pushforge/builder` encryption, HTTP send |
| `push-triggers.ts` | High-level: trigger decisions, `stateToPush`, `handleFactPush`, broadcast/targeted delivery |

### Trigger Path 1: Fact-Driven Push

Facts flow upward through the Russian Doll: L3 raises `FACT.RECORD` → L2 propagates → L1's `.provide()` override intercepts.

```
L3 (session machine)
  │  assign + sendParent({ type: 'FACT.RECORD', fact: { type: 'DM_SENT', ... } })
  ▼
L2 (orchestrator)
  │  on: { 'FACT.RECORD': { actions: ['persistFactToD1', 'updateJournalTimestamp'] } }
  ▼
L1 (server.ts — .provide() override of persistFactToD1)
  │  1. Writes to D1 journal (if journalable type)
  │  2. Converts fact → ticker message (factToTicker)
  │  3. handleFactPush(ctx, fact, manifest) ← THIS
  ▼
pushToPlayer() or pushBroadcast()
```

**Fact types that trigger push:**

| Fact Type | Push Target | Notification |
|-----------|-------------|-------------|
| `DM_SENT` | `pushToPlayer(fact.targetId)` | "{senderName} sent you a DM" |
| `ELIMINATION` | `pushBroadcast()` | "{playerName} has been eliminated!" |
| `WINNER_DECLARED` | `pushBroadcast()` | "{playerName} wins!" |

All other fact types (VOTE_CAST, SILVER_TRANSFER, PERK_USED, etc.) do **not** trigger push — they're either too frequent or not urgent enough to warrant a notification.

### Trigger Path 2: State-Transition-Driven Push

State transitions are detected inside the L2 `.subscribe()` callback by comparing a combined state string:

```
L2 .subscribe(snapshot => {
  │
  │  // Combine L2 + L3 state values to catch L3 phase changes
  │  const l3StateJson = l3Snapshot ? JSON.stringify(l3Snapshot.value) : '';
  │  const currentStateStr = JSON.stringify(snapshot.value) + l3StateJson;
  │
  │  if (currentStateStr !== this.lastBroadcastState) {
  │    const pushPayload = stateToPush(currentStateStr, snapshot.context, manifest);
  │    if (pushPayload) {
  │      const pushKey = `${pushPayload.tag}:${pushPayload.body}`;
  │      if (!this.sentPushKeys.has(pushKey)) {
  │        this.sentPushKeys.add(pushKey);
  │        pushBroadcast(ctx, pushPayload);
  │      }
  │    }
  │  }
  ▼
})
```

**State mappings (`stateToPush`):**

| State String Contains | Trigger | Notification | Tag |
|-----------------------|---------|-------------|-----|
| `"activityLayer":"playing"` | `ACTIVITY` | "Activity time!" | `activity` |
| `morningBriefing` or `groupChat` | `DAY_START` | "Day {N} has begun!" | `phase` |
| `voting` | `VOTING` | "Voting has begun!" | `phase` |
| `nightSummary` | `NIGHT_SUMMARY` | "Night has fallen..." | `phase` |
| `dailyGame` | `DAILY_GAME` | "Game time!" | `phase` |

**Order matters:** `ACTIVITY` is checked before `DAY_START` because activities run inside `groupChat` — without this ordering, the `groupChat` match would shadow the activity detection.

Phase-transition pushes sharing the `phase` tag means the browser replaces the previous phase notification rather than stacking them.

**Deduplication:** The L2 subscription can fire multiple times for a single logical state change (e.g., context change + FACT.RECORD, or L3 parallel state completing). Each fire produces a different state string but may map to the same push payload. A `Set<string>` of sent push keys (`tag:body` composites) permanently prevents re-sending the same notification within a game session.

### Push Delivery Methods

```typescript
// Targeted: send to one player
async function pushToPlayer(ctx: PushContext, playerId: string, payload: Record<string, string>)

// Broadcast: send to all players in roster
async function pushBroadcast(ctx: PushContext, payload: Record<string, string>)
```

Both methods:
1. **Resolve push key** — `pushKeyForPlayer()` maps `playerId` → `realUserId` from the L2 roster, falling back to `playerId` for debug games.
2. **Retrieve subscription** — `getPushSubscription()` reads from DO storage (`push_sub:{pushKey}`).
3. **Inject returnUrl** — reads `push_url:{pushKey}` from storage. If present, adds `url` field to the payload so notification clicks open the game with the player's token.
4. **Encrypt & send** — `sendPushNotification()` uses `@pushforge/builder` to encrypt the payload and POST to the push service endpoint.
5. **Handle expiry** — If the push service returns 410/404, the subscription is deleted from storage.

Pushes are always sent regardless of whether the player has a tab open. The user should see the notification in their OS notification tray even if the game is in the foreground.

### Payload Format

```typescript
{
  title: "Pecking Order",     // Always the app name
  body: "Voting has begun!",  // Human-readable phase/event description
  tag: "phase" | "activity" | "dm" | "elimination" | "winner",
  url: "https://client.example.com/?token=eyJ..."  // Optional: injected from stored returnUrl
}
```

The `tag` field controls browser notification behavior — notifications with the same tag replace each other rather than stacking. The `renotify: true` option in the SW ensures the replacement still alerts the user.

---

## Client-Side Pipeline

### Service Worker (`apps/client/src/sw.ts`)

Registered via `vite-plugin-pwa` with `injectManifest` strategy. The SW handles two concerns:

1. **Precaching** — `precacheAndRoute(self.__WB_MANIFEST)` caches static assets at build time.
2. **Push events** — Listens for `push` and `notificationclick`.

```typescript
// Push: decrypt payload, show notification with returnUrl
self.addEventListener('push', (event) => {
  const data = event.data.json();  // { title, body, tag, url? }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag,
      renotify: true,
      data: { url: data.url || self.location.origin },
    })
  );
});

// Click: focus existing game tab or open returnUrl
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.location.origin;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.startsWith(targetUrl) && 'focus' in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
```

### Cloudflare Pages `_redirects`

The SPA catch-all `/* /index.html 200` must NOT intercept `sw.js` or `manifest.webmanifest`. Explicit pass-through rules are placed before the fallback:

```
/sw.js /sw.js 200
/manifest.webmanifest /manifest.webmanifest 200
/* /index.html 200
```

Without this, Cloudflare Pages serves `index.html` for `/sw.js` requests, silently breaking service worker registration.

### Registration (`apps/client/src/main.tsx`)

```typescript
import { registerSW } from 'virtual:pwa-register';
registerSW();
```

Uses `vite-plugin-pwa`'s virtual module to handle dev/prod SW paths correctly. Manual `/sw.js` registration causes MIME type errors in dev mode.

### Subscription Hook (`apps/client/src/hooks/usePushNotifications.ts`)

The `usePushNotifications(socket)` hook manages the full subscription lifecycle:

```
Component mounts with socket
  │
  ▼
useEffect([permission, socket])
  │  navigator.serviceWorker.ready
  │  └─ pushManager.getSubscription()
  │     ├─ EXISTS: setIsSubscribed(true)
  │     │  └─ Re-send PUSH.SUBSCRIBE + returnUrl to server (new game DO needs it)
  │     └─ NULL: setIsSubscribed(false)
  │
  ▼
subscribe() — called on "Alerts" button click
  │  1. Notification.requestPermission()
  │  2. Fetch VAPID public key from GET /vapid-key (cached in sessionStorage)
  │  3. pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
  │  4. Send PUSH.SUBSCRIBE over WebSocket with { endpoint, keys, returnUrl }
  │  5. setIsSubscribed(true)
  │
  ▼
unsubscribe()
  │  1. pushManager.getSubscription().unsubscribe()
  │  2. Send PUSH.UNSUBSCRIBE over WebSocket
  │  3. setIsSubscribed(false)
```

**returnUrl:** Both the mount re-register and the initial subscribe send `window.location.href` as `returnUrl`. This includes the game token, so notification clicks can authenticate into the game. The server stores it as `push_url:{pushKey}` alongside the subscription.

**Cross-game persistence:** Push subscriptions live in the browser (per-origin, not per-page). But the server stores them in per-game Durable Object storage. When a player joins a new game, the new DO has no record of their subscription. The mount effect detects the existing browser subscription and automatically re-sends `PUSH.SUBSCRIBE` to the new game's server.

### UI Component (`apps/client/src/components/PushPrompt.tsx`)

A small "Alerts" button in the header bar (Bell icon + text). Visibility rules:

| Condition | Button State |
|-----------|-------------|
| Push API unsupported | Hidden |
| Permission denied | Hidden |
| Already subscribed (browser has subscription) | Hidden |
| Permission default or granted, not yet subscribed | **Visible** |

---

## Subscription Storage

### Server-Side (DO Storage)

Subscriptions and return URLs are stored in Durable Object storage:

```
push_sub:{pushKey}  → JSON string of PushSubscription { endpoint, keys: { p256dh, auth } }
push_url:{pushKey}  → Full client URL with game token (for notification click)
```

**Key resolution (`pushKeyForPlayer`):** Maps `playerId` → `roster[playerId].realUserId`, falling back to `playerId` for debug games (which have no real user IDs).

**Per-game isolation:** Each game is a separate Durable Object with its own storage. A player's subscription exists independently in each game they're part of. The client auto-re-registers on every game join (mount effect).

### Client-Side (Browser)

The browser manages the actual push subscription via the Push API. The subscription is scoped to the **origin** (e.g., `https://pecking-order-client.pages.dev`), not to a specific game. One subscription serves all games.

The VAPID public key is cached in `sessionStorage` under `po_vapid_key` to avoid re-fetching on every page load.

---

## VAPID Configuration

### Keys

| Key | Location | Format |
|-----|----------|--------|
| **Public** | `wrangler.toml` `[vars].VAPID_PUBLIC_KEY` | Base64url-encoded P-256 public key |
| **Private** | `wrangler secret put VAPID_PRIVATE_JWK` (prod) / `.dev.vars` (local) | JSON Web Key (ES256 P-256) |

The public key is also served via HTTP for the client to fetch:

```
GET /parties/game-server/vapid-key
→ { "publicKey": "BDCbn388..." }
```

CORS headers (`Access-Control-Allow-Origin: *`) are set on this endpoint since the client origin differs from the server origin.

### Secrets (Remote)

Both the **game server** and **lobby** need `AUTH_SECRET` set via `wrangler secret put` with the same value. The lobby mints JWTs and the game server verifies them.

```bash
cd apps/game-server && npx wrangler secret put AUTH_SECRET
cd apps/lobby && npx wrangler secret put AUTH_SECRET
# Also needed on game server:
npx wrangler secret put VAPID_PRIVATE_JWK
```

### Encryption

The `@pushforge/builder` library handles RFC 8188 payload encryption:

1. Generates ephemeral ECDH key pair.
2. Derives shared secret from subscription's `p256dh` key.
3. Encrypts payload with AES-GCM (`Content-Encoding: aesgcm`).
4. Signs request with VAPID JWT (`Authorization: vapid t=<jwt>,k=<key>`).

---

## Lobby Debug Panel — Push Config

The debug manifest config includes a `pushConfig: Record<string, boolean>` with toggles for all 8 triggers. This is passed through to the game manifest on both the invite flow (`startGame()`) and quick-start flow (`startDebugGame()`).

Triggers default to ON. The admin can disable specific triggers per game for testing.

---

## WebSocket Event Handling

Push events are handled in L1's `onMessage()` **before** XState routing — they never touch the state machines:

```typescript
// server.ts onMessage()
if (event.type === 'PUSH.SUBSCRIBE') {
  const pushKey = pushKeyForPlayer(state.playerId, roster);
  savePushSubscription(this.ctx.storage, pushKey, event.subscription);
  if (event.returnUrl) {
    this.ctx.storage.put(`push_url:${pushKey}`, event.returnUrl);
  }
  return;  // ← Short-circuit, no XState involvement
}

if (event.type === 'PUSH.UNSUBSCRIBE') {
  const pushKey = pushKeyForPlayer(state.playerId, roster);
  deletePushSubscription(this.ctx.storage, pushKey);
  return;
}
```

This is intentional — push subscription management is an L1 infrastructure concern, not game logic.

---

## PWA Configuration

### Vite Plugin (`vite.config.ts`)

```typescript
VitePWA({
  strategies: 'injectManifest',   // Custom SW with workbox precaching
  srcDir: 'src',
  filename: 'sw.ts',
  injectRegister: false,          // Manual registration in main.tsx
  manifest: {
    name: 'Pecking Order',
    short_name: 'Pecking Order',
    theme_color: '#0f0a1a',
    display: 'standalone',
    icons: [/* 192, 512, maskable */],
  },
  devOptions: {
    enabled: true,                // SW active in dev mode
    type: 'module',               // ES modules for dev SW
  },
})
```

### Icons

Placeholder icons in `apps/client/public/icons/`:
- `icon-192.png` — notification icon, app icon
- `icon-512.png` — splash screen
- `icon-512-maskable.png` — adaptive icon (Android)
- `badge-72.png` — small monochrome badge for notification tray

---

## Key Files

| File | Purpose |
|------|---------|
| `apps/game-server/src/push.ts` | Storage utilities + encryption + send |
| `apps/game-server/src/push-triggers.ts` | Trigger decisions, `stateToPush`, `handleFactPush`, `PushContext`, broadcast/targeted delivery |
| `apps/game-server/src/server.ts` | L1: PUSH.* event handling, subscription handler, dedup Set, getPushContext() |
| `apps/game-server/wrangler.toml` | VAPID_PUBLIC_KEY in `[vars]` |
| `apps/game-server/.dev.vars` | VAPID_PRIVATE_JWK for local dev |
| `apps/client/src/sw.ts` | Service worker: push + notificationclick handlers |
| `apps/client/src/hooks/usePushNotifications.ts` | Subscription lifecycle hook |
| `apps/client/src/components/PushPrompt.tsx` | "Alerts" button UI |
| `apps/client/src/main.tsx` | SW registration via virtual:pwa-register |
| `apps/client/vite.config.ts` | PWA plugin config + manifest |
| `apps/client/public/_redirects` | SPA routing with SW/manifest pass-through |
| `packages/shared-types/src/index.ts` | PushTriggerSchema, PushConfigSchema, DEFAULT_PUSH_CONFIG |
| `apps/lobby/app/page.tsx` | Debug panel push config toggles |

---

## Environment Variables

| Variable | Where | How Set | Purpose |
|----------|-------|---------|---------|
| `VAPID_PUBLIC_KEY` | Game Server | `[vars]` in `wrangler.toml` | Served to client for subscription |
| `VAPID_PRIVATE_JWK` | Game Server | `wrangler secret put` / `.dev.vars` | Signs push requests (ES256 JWK) |
| `AUTH_SECRET` | Game Server + Lobby | `wrangler secret put` (both) | JWT signing (lobby) and verification (server) |

---

## Known Issues & Limitations

### Intermittent Delivery
Push notifications are sometimes not received despite the server reporting "sent" (201 from push service). May be related to `aesgcm` content encoding (the older draft format). The `aes128gcm` encoding (RFC 8291 standard) is preferred by modern browsers.

### No Retry
Push sends are fire-and-forget. If `sendPushNotification()` fails (network error, push service down), the notification is lost. The TTL (24h) on the push message means the push service will retry delivery to the browser, but if the initial POST to the push service fails, there's no server-side retry.

### Per-Game Storage
Subscriptions are stored per Durable Object (per game). A player in multiple games has their subscription stored independently in each game's DO. The client automatically re-registers on each game join, so this is transparent.

### iOS Requires PWA Install
On iOS Safari, push notifications only work when the app is installed to the home screen (Add to Home Screen). The `PushManager` API is not available in regular Safari tabs. The "Alerts" button hides when `PushManager` is unavailable.

### Cloudflare Pages Preview URLs
Feature branches deploy the client to preview URLs (`https://{branch}.pecking-order-client.pages.dev/`) but the lobby's `GAME_CLIENT_HOST` points to the production Pages URL. Manual `wrangler pages deploy --branch=main` is needed to test feature branches at the production URL. See AUDIT_GAPS.md for options.
