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
    |                     |   (via WebSocket)      |-- storage.put() -------->|
    |                     |                        |                           |
    |                     |        ... game progresses ...                     |
    |                     |                        |                           |
    |                     |                        |-- state transition ------>|
    |                     |                        |   detected (L2 sub)       |
    |                     |                        |                           |
    |                     |                        |-- isPlayerOnline()? NO -->|
    |                     |                        |-- buildPushHTTPRequest -->|
    |                     |                        |-- fetch(endpoint, ...) -->|
    |                     |                        |                           |-- deliver to browser
    |<-- push event ------|------------------------|---------------------------|
    |-- showNotification  |                        |                           |
    |                     |                        |                           |
    |<-- click ---------->|                        |                           |
    |-- focus/open tab -->|                        |                           |
```

---

## Architecture

### Two Push Trigger Paths

Push notifications originate from two distinct paths in L1, both inside the L2 actor's `.subscribe()` callback:

| Path | Trigger | Scope | Examples |
|------|---------|-------|----------|
| **Fact-driven** | `FACT.RECORD` event in L1's `persistFactToD1` action override | Targeted or broadcast | DM received, elimination, winner declared |
| **State-transition-driven** | L2+L3 state string changes detected in the subscription | Broadcast only | Day started, voting opened, night fallen, game time |

Both paths converge on the same `pushToPlayer()` / `pushBroadcast()` methods.

### Why Two Paths?

Facts represent **discrete game events** — a specific player sent a DM, a specific player was eliminated. These are ideal for targeted notifications ("X sent you a DM") and happen at unpredictable times.

State transitions represent **phase changes** — the game moved from group chat to voting. These affect all players equally and are detected by comparing serialized state strings between subscription fires.

---

## Server-Side Pipeline

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
  │  3. Converts fact → push notification ← THIS
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
  │  // (L3 phases like voting/dailyGame don't change the L2 state string)
  │  const l3StateJson = l3Snapshot ? JSON.stringify(l3Snapshot.value) : '';
  │  const currentStateStr = JSON.stringify(snapshot.value) + l3StateJson;
  │
  │  if (currentStateStr !== this.lastBroadcastState) {
  │    const pushPayload = this.stateToPush(currentStateStr, snapshot.context);
  │    // Dedup by tag:body to prevent double-sends from rapid subscription fires
  │    if (pushPayload && pushTag !== this.lastPushTag) {
  │      this.pushBroadcast(pushPayload);
  │    }
  │  }
  ▼
})
```

**State mappings (`stateToPush`):**

| State String Contains | Notification | Tag |
|-----------------------|-------------|-----|
| `morningBriefing` or `groupChat` | "Day {N} has begun!" | `phase` |
| `voting` | "Voting has begun!" | `phase` |
| `nightSummary` | "Night has fallen..." | `phase` |
| `dailyGame` | "Game time!" | `phase` |

All phase-transition pushes share the `phase` tag, which means the browser replaces the previous phase notification rather than stacking them.

**Deduplication:** The L2 subscription can fire multiple times for a single logical state change (e.g., context change + FACT.RECORD in quick succession). Each fire may produce a slightly different L3 state string, but both map to the same push payload. The `lastPushTag` check (`tag:body` composite key) prevents the same notification from being sent twice.

### Push Delivery Methods

```typescript
// Targeted: send to one player (skips online players)
private async pushToPlayer(playerId: string, payload: Record<string, string>)

// Broadcast: send to all players in roster (each individually checked for online status)
private async pushBroadcast(payload: Record<string, string>)
```

Both methods:
1. **Check online status** — `isPlayerOnline()` iterates WebSocket connections. If the player has an active tab open, skip the push (they'll see changes via SYSTEM.SYNC).
2. **Resolve push key** — `pushKeyForPlayer()` maps `playerId` → `realUserId` from the L2 roster, falling back to `playerId` for debug games.
3. **Retrieve subscription** — `getPushSubscription()` reads from DO storage (`push_sub:{pushKey}`).
4. **Encrypt & send** — `sendPushNotification()` uses `@pushforge/builder` to encrypt the payload and POST to the push service endpoint.
5. **Handle expiry** — If the push service returns 410/404, the subscription is deleted from storage.

### Payload Format

```typescript
{
  title: "Pecking Order",     // Always the app name
  body: "Voting has begun!",  // Human-readable phase/event description
  tag: "phase" | "dm" | "elimination" | "winner"  // Notification grouping
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
// Push: decrypt payload, show notification
self.addEventListener('push', (event) => {
  const data = event.data.json();  // { title, body, tag }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag,
      renotify: true,
      data: { url: self.location.origin },
    })
  );
});

// Click: focus existing game tab or open new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Focus existing tab or open new window
    })
  );
});
```

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
  │     │  └─ Re-send PUSH.SUBSCRIBE to server (new game DO needs it)
  │     └─ NULL: setIsSubscribed(false)
  │
  ▼
subscribe() — called on "Alerts" button click
  │  1. Notification.requestPermission()
  │  2. Fetch VAPID public key from GET /vapid-key (cached in sessionStorage)
  │  3. pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
  │  4. Send PUSH.SUBSCRIBE over WebSocket with { endpoint, keys: { p256dh, auth } }
  │  5. setIsSubscribed(true)
  │
  ▼
unsubscribe()
  │  1. pushManager.getSubscription().unsubscribe()
  │  2. Send PUSH.UNSUBSCRIBE over WebSocket
  │  3. setIsSubscribed(false)
```

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

Subscriptions are stored in Durable Object storage, keyed by the player's real user ID:

```
Key:   push_sub:{realUserId}    (or push_sub:{playerId} for debug games)
Value: JSON string of PushSubscription { endpoint, keys: { p256dh, auth } }
```

**Key resolution (`pushKeyForPlayer`):** Looks up `roster[playerId].realUserId`. Falls back to `playerId` if no real user ID exists (debug roster). This means debug games use keys like `push_sub:p1`.

**Per-game isolation:** Each game is a separate Durable Object with its own storage. A player's subscription exists independently in each game they're part of. This is fine because:
- The client auto-re-registers on every game join (mount effect).
- Each game needs to independently decide whether to push (online check, etc.).
- Subscriptions are small (~200 bytes each).

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

### Encryption

The `@pushforge/builder` library handles RFC 8188 payload encryption:

1. Generates ephemeral ECDH key pair.
2. Derives shared secret from subscription's `p256dh` key.
3. Encrypts payload with AES-GCM (`Content-Encoding: aesgcm`).
4. Signs request with VAPID JWT (`Authorization: vapid t=<jwt>,k=<key>`).

---

## WebSocket Event Handling

Push events are handled in L1's `onMessage()` **before** XState routing — they never touch the state machines:

```typescript
// server.ts onMessage()
if (event.type === 'PUSH.SUBSCRIBE') {
  const pushKey = this.pushKeyForPlayer(state.playerId);
  savePushSubscription(this.ctx.storage, pushKey, event.subscription);
  return;  // ← Short-circuit, no XState involvement
}

if (event.type === 'PUSH.UNSUBSCRIBE') {
  const pushKey = this.pushKeyForPlayer(state.playerId);
  deletePushSubscription(this.ctx.storage, pushKey);
  return;
}
```

This is intentional — push subscription management is an L1 infrastructure concern, not game logic.

---

## Online Skip Logic

Before sending a push, `isPlayerOnline()` iterates all active WebSocket connections:

```typescript
private isPlayerOnline(playerId: string): boolean {
  for (const ws of this.getConnections()) {
    const state = ws.state as { playerId: string } | null;
    if (state?.playerId === playerId) return true;
  }
  return false;
}
```

If the player has an active WebSocket (i.e., a game tab open), they'll see changes in real time via SYSTEM.SYNC. Push notifications would be redundant and annoying.

**Edge case:** A player might have a tab open but not be looking at it (e.g., backgrounded mobile tab). The current implementation skips push in this case. This is acceptable — the tab will update when they return to it, and mobile browsers often suspend WebSocket connections for backgrounded tabs anyway (which would make `isPlayerOnline()` return false, triggering the push).

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
| `apps/game-server/src/server.ts` | L1: trigger logic, online check, PUSH.* event handling |
| `apps/game-server/wrangler.toml` | VAPID_PUBLIC_KEY in `[vars]` |
| `apps/game-server/.dev.vars` | VAPID_PRIVATE_JWK for local dev |
| `apps/client/src/sw.ts` | Service worker: push + notificationclick handlers |
| `apps/client/src/hooks/usePushNotifications.ts` | Subscription lifecycle hook |
| `apps/client/src/components/PushPrompt.tsx` | "Alerts" button UI |
| `apps/client/src/main.tsx` | SW registration via virtual:pwa-register |
| `apps/client/vite.config.ts` | PWA plugin config + manifest |

---

## Environment Variables

| Variable | Where | How Set | Purpose |
|----------|-------|---------|---------|
| `VAPID_PUBLIC_KEY` | Game Server | `[vars]` in `wrangler.toml` | Served to client for subscription |
| `VAPID_PRIVATE_JWK` | Game Server | `wrangler secret put` / `.dev.vars` | Signs push requests (ES256 JWK) |

---

## Known Issues & Limitations

### Duplicate Broadcast
The L2 subscription can fire twice for a single game action (context change + FACT.RECORD). The `lastPushTag` deduplication prevents duplicate push sends, but it means the `stateToPush` code runs twice. This is the same root cause as the duplicate SYSTEM.SYNC issue documented elsewhere.

### Intermittent Delivery
Push notifications are sometimes not received despite the server reporting "sent" (201 from push service). Under investigation — may be related to `aesgcm` content encoding (the older draft format). The `aes128gcm` encoding (RFC 8291 standard) is preferred by modern browsers.

### No Retry
Push sends are fire-and-forget. If `sendPushNotification()` fails (network error, push service down), the notification is lost. The TTL (24h) on the push message means the push service will retry delivery to the browser, but if the initial POST to the push service fails, there's no server-side retry.

### Per-Game Storage
Subscriptions are stored per Durable Object (per game). A player in multiple games has their subscription stored independently in each game's DO. The client automatically re-registers on each game join, so this is transparent. The trade-off is slightly more storage vs. requiring a shared storage layer (KV/D1) for a global subscription registry.
