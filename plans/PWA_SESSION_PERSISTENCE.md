# PWA Session Persistence

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
| 1. localStorage | Page refresh, new tab, browser restart | All browsers |
| 2. Cache API | iOS standalone PWA launch (localStorage is sandboxed) | iOS only |
| 3. Lobby API | JWT expired or cleared, but user still logged into lobby | Browser only (cookie sandboxed in standalone PWA) |
| 4. Lobby redirect | No session anywhere — user must log in | All contexts, last resort |

## Implementation Plan

### Step 1: localStorage (DONE)

Already implemented on branch `fix/pwa-session-persistence`:
- `sessionStorage` → `localStorage` migration
- Game-duration JWT expiry (`dayCount × 2 + 7` days)
- Auto-cleanup of expired `po_token_*` on app launch

### Step 2: Cache API Bridge

Persist JWTs in the Cache API, which is shared between Safari and standalone PWA on iOS (since iOS 14).

**UPDATE**: The original SW fetch handler approach was broken — `persistToCache()` gated on `navigator.serviceWorker.controller`, which is null on first page load. Replaced with direct `caches.open()` from the page context. The SW fetch handler has been removed. Added `syncCacheToLocalStorage()` on app mount to copy cached tokens into localStorage before rendering.

~~**`apps/client/src/sw.ts`** — Add virtual endpoint handler:~~

```typescript
const TOKEN_CACHE = 'po-tokens-v1';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/api/session-cache') return;

  if (event.request.method === 'POST') {
    // Store: client sends { key: "po_token_CODE", value: "eyJ..." }
    event.respondWith(
      event.request.json().then(async (data) => {
        const cache = await caches.open(TOKEN_CACHE);
        await cache.put(
          new Request(`/api/session-cache/${data.key}`),
          new Response(data.value)
        );
        return new Response('ok');
      })
    );
  } else if (event.request.method === 'GET') {
    // Retrieve: return all cached tokens as { key: value, ... }
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
      })()
    );
  } else if (event.request.method === 'DELETE') {
    // Cleanup: remove a specific token
    event.respondWith(
      event.request.json().then(async (data) => {
        const cache = await caches.open(TOKEN_CACHE);
        await cache.delete(new Request(`/api/session-cache/${data.key}`));
        return new Response('ok');
      })
    );
  }
});
```

**`apps/client/src/App.tsx`** — Dual-write on token arrival:

```typescript
function applyToken(jwt, gameCode, ...) {
  // ... existing decode + state set ...
  const key = gameCode || decoded.gameId;
  localStorage.setItem(`po_token_${key}`, jwt);

  // Also persist to Cache API for iOS standalone PWA
  if ('serviceWorker' in navigator) {
    fetch('/api/session-cache', {
      method: 'POST',
      body: JSON.stringify({ key: `po_token_${key}`, value: jwt }),
    }).catch(() => {}); // fire-and-forget
  }
}
```

**`apps/client/src/App.tsx`** — Fallback read in init:

```typescript
// After localStorage check fails:
async function recoverFromCacheApi(gameCode: string): Promise<string | null> {
  try {
    const res = await fetch('/api/session-cache');
    const tokens = await res.json();
    const jwt = tokens[`po_token_${gameCode}`];
    if (jwt) {
      // Validate not expired
      const decoded = decodeGameToken(jwt);
      if (decoded.exp && decoded.exp > Date.now() / 1000) {
        localStorage.setItem(`po_token_${gameCode}`, jwt); // restore
        return jwt;
      }
    }
  } catch {}
  return null;
}
```

**Limitations:**
- Cache may be cleared by iOS after extended periods of inactivity
- Requires SW to be registered (first-ever visit must come through Safari)
- `clients.claim()` needed for immediate SW activation

### Step 3: Lobby API Refresh

New lobby endpoint that accepts the `po_session` cookie and returns a fresh game JWT. Called via `fetch` from the client (no redirect).

**`apps/lobby/app/api/refresh-token/[code]/route.ts`** — New API route:

```typescript
// GET /api/refresh-token/CODE
// Requires: po_session cookie (sent automatically by browser with credentials: 'include')
// Returns: { token: "eyJ..." } or 401
export async function GET(req, { params }) {
  const { code } = await params;
  const session = await getSession(); // reads po_session cookie
  if (!session) return Response.json({ error: 'unauthorized' }, { status: 401 });

  // Same logic as /play/[code]/route.ts but returns JSON instead of redirect
  const game = await db.prepare('SELECT id, status, day_count FROM GameSessions WHERE invite_code = ?')...
  const invite = await db.prepare('SELECT ... WHERE game_id = ? AND accepted_by = ?')...
  const token = await signGameToken(...);

  return Response.json({ token }, {
    headers: {
      'Access-Control-Allow-Origin': CLIENT_HOST,
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
```

**CORS requirements** (lobby side):
- `Access-Control-Allow-Origin`: must be the specific client origin (not `*`, since credentials are involved)
- `Access-Control-Allow-Credentials: true`
- Preflight handler for OPTIONS

**`apps/client/src/App.tsx`** — Fetch before redirect:

```typescript
async function refreshFromLobby(gameCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${LOBBY_HOST}/api/refresh-token/${gameCode}`, {
      credentials: 'include', // sends po_session cookie
    });
    if (!res.ok) return null;
    const { token } = await res.json();
    applyToken(token, gameCode, ...);
    return token;
  } catch {
    return null;
  }
}
```

**Note:** This step only works in browser contexts where the `po_session` cookie is accessible. In iOS standalone PWA, the cookie is sandboxed — step 2 (Cache API) handles that case.

### Step 4: Lobby Redirect (Last Resort)

If steps 1-3 all fail, redirect to `LOBBY_HOST/play/CODE`. This triggers the standard auth flow:
- If `po_session` exists → mint JWT → redirect back to client
- If no session → login page → magic link → `/play/CODE` → redirect back

```typescript
// In App.tsx, after all recovery attempts fail:
window.location.href = `${LOBBY_HOST}/play/${gameCode}`;
```

This is the only step that requires user interaction (if they need to log in).

## File Changes Summary

| File | Change |
|------|--------|
| `apps/client/src/sw.ts` | Add `/api/session-cache` virtual endpoint (Cache API CRUD) |
| `apps/client/src/App.tsx` | Dual-write to Cache API, async recovery chain (Cache API → Lobby API → redirect) |
| `apps/lobby/app/api/refresh-token/[code]/route.ts` | New endpoint: mint JWT from `po_session` cookie |
| `apps/lobby/middleware.ts` | Allow `/api/refresh-token/*` through CORS (or handle in route) |
| `packages/auth/src/index.ts` | No changes (already done) |

## Status

- [x] `sessionStorage` → `localStorage` migration
- [x] Game-duration JWT expiry (`dayCount × 2 + 7` days)
- [x] Auto-cleanup of expired tokens
- [x] Cache API bridge in Service Worker (step 2)
- [x] Lobby refresh-token API endpoint (step 3)
- [x] Client recovery chain with async fallbacks (steps 2-4)
- [x] CORS setup for lobby ↔ client credential sharing (headers in refresh-token route)

## References

- [Sharing State Between PWA and Safari on iOS (Netguru)](https://www.netguru.com/blog/how-to-share-session-cookie-or-state-between-pwa-in-standalone-mode-and-safari-on-ios)
- [PWA iOS Limitations Guide (MagicBell)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [PWAs on iOS 2026 (MobiLoud)](https://www.mobiloud.com/blog/progressive-web-apps-ios)
