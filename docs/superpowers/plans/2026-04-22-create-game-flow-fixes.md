# Create-Game Flow Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six regressions in the game-creation → frictionless join → play-client pipeline that caused the 2026-04-21 product-owner demo to fail. Deliver a demonstrable happy path that tomorrow's rehearsal can walk without hacks.

**Architecture:** Fixes span three surfaces — lobby server actions (create + invite + API endpoints), game-server (init + WS reject handling), and client (recovery paths). Bugs are largely independent; tasks can be tackled in any order, though Task 1 (CC auto-init) unblocks end-to-end manual testing and should go first.

**Tech Stack:** Next.js 15 on Cloudflare via OpenNext (lobby), Cloudflare Workers + PartyServer DO (game-server), React 19 + Vite (client), D1 for persistence.

---

## Context (read before starting)

All six bugs were surfaced by the 2026-04-21 PO session. Incident evidence:
- Axiom logs: `po-logs-staging` during `2026-04-22T02:00:00Z`–`2026-04-22T03:00:00Z`
- Sentry issues: `PECKING-ORDER-STAGING-2` (Mac, refresh-token 400) and `PECKING-ORDER-STAGING-18` (iPhone, my-active-game 401), both with session replays attached
- Session transcript: `.remember/today-2026-04-22.md`

Bug list (as referenced throughout plan):
1. `/j/[code]` redirects authed users to legacy `/join/` wizard → login wall
2. CC admin-form skips DO auto-init when STATIC toggle is off → game stays `uninitialized`
3. WS reject loop at game-server when playerId invalid — no server-side rate-limit, client has some but not all cases covered
4. CC waiting room has no Start Game button; admin panel's Start Day 1 is a no-op on an uninitialized DO
5. Lobby `/api/refresh-token/[code]` returns 400 for "authed-but-no-invite" — Sentry auto-instruments as error + client falls through to a lobby redirect loop
6. Lobby `/api/my-active-game` returns 401 for unauth — Sentry auto-instruments as error + client treats as "no game" but the 401 still spams Sentry

Optional Task 7 covers a D1 FK race in `insertGameAndPlayers` (Bug #7) observed in parallel test inits but not during the PO session.

### Prior-art: DYNAMIC manifest `schedulePreset` trap (ADR-145, shipped 2026-04-21)

If, during smoke-testing, `INJECT_TIMELINE_EVENT action:START_CONFESSION_CHAT` returns OK but the confession booth never appears, the historical root cause was a DYNAMIC manifest created without a `schedulePreset` — `generateDayTimeline(undefined, …)` crashed the game-master actor, wedging L2 in `dayLoop.activeSession.waitingForChild`. As of 2026-04-21 (ADR-145, commits ea3c591 + a577184):
- `/init` now runs `GameManifestSchema.safeParse` → 400 on invalid.
- `DynamicManifestSchema.schedulePreset` defaults to `'DEFAULT'`.
- L2 consumes `xstate.error.actor.game-master` and logs to Axiom.

Task 1's DYNAMIC-default payload explicitly sets `schedulePreset: 'SMOKE_TEST'`, so this path is double-safe. If a new incident surfaces the symptom anyway, subscribe `INSPECT.SUBSCRIBE` and look for `xstate.error.actor.game-master` as the diagnostic signal — that's the real indicator, not the inject response.

---

## File Structure

- **`apps/lobby/app/actions.ts`** — `createGame` CC auto-init branch (Task 1)
- **`apps/lobby/app/j/[code]/actions.ts`** — frictionless join server action (Task 2)
- **`apps/lobby/app/api/refresh-token/[code]/route.ts`** — endpoint response shape (Task 3)
- **`apps/lobby/app/api/my-active-game/route.ts`** — endpoint response shape (Task 4)
- **`apps/game-server/src/ws-handlers.ts`** — server-side reject rate-limit (Task 5)
- **`apps/client/src/App.tsx`** — client recovery tolerance for null/200 responses (Task 3, 4 verify)
- **`apps/client/src/hooks/useGameEngine.ts`** — client-side WS reconnect guard (Task 5)
- **`apps/lobby/app/game/[id]/waiting/page.tsx`** — Start Game button for CC games (Task 6)
- **`apps/lobby/app/admin/games/[id]/_tabs/OverviewTab.tsx`** — admin "Start Day 1" for uninitialized CC (Task 6)
- **`apps/game-server/src/d1-persistence.ts`** — (optional) Games → Players insert ordering (Task 7)

---

## Task 1: CC auto-init fires regardless of STATIC toggle

**Why:** `createGame` in `apps/lobby/app/actions.ts` at line 220 guards the CC auto-init branch with `if (mode === 'CONFIGURABLE_CYCLE' && config)`. When the UI is in "DYNAMIC" mode (STATIC toggle off and no `dynamicManifestOverride` passed), `config` is undefined and no `/init` POST is made — the DO stays `uninitialized` forever. Every downstream flow breaks.

**Files:**
- Modify: `apps/lobby/app/actions.ts` (the CC auto-init branch around line 219–260)
- Test: `apps/lobby/__tests__/actions.createGame.test.ts` (new) — if no lobby vitest exists yet, add minimal setup; otherwise integration-test via a manual check step.

- [ ] **Step 1: Read current branch to confirm structure**

Run: `sed -n '219,261p' apps/lobby/app/actions.ts`
Confirm the guarded block begins with `if (mode === 'CONFIGURABLE_CYCLE' && config)`.

- [ ] **Step 2: Modify the branch to always fire for CC games**

Replace the block `for (CONFIGURABLE_CYCLE: auto-init the DO immediately)` starting around line 219:

```ts
  // For CONFIGURABLE_CYCLE: auto-init the DO immediately.
  // Always fires for CC (even when the admin didn't set per-day config) —
  // the DO needs INIT before /player-joined forwarding works, and without
  // INIT the game is unrecoverably stuck in `uninitialized`.
  if (mode === 'CONFIGURABLE_CYCLE') {
    try {
      const env = await getEnv();
      const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
      const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

      let payload: any;
      if (config) {
        // Admin set per-day config (STATIC toggle on) — build a STATIC manifest
        const t = (offset: number) => new Date(now + offset).toISOString();
        const days = buildManifestDays(mode, dayCount, config, t);
        payload = {
          lobbyId: `lobby-${now}`,
          inviteCode,
          roster: {},
          manifest: {
            kind: 'STATIC' as const,
            id: `manifest-${gameId}`,
            gameMode: mode,
            scheduling: 'PRE_SCHEDULED' as const,
            days,
            pushConfig: config.pushConfig,
          },
        };
      } else {
        // No per-day config — build a minimal DYNAMIC/ADMIN manifest so the
        // admin can drive phases manually. Game Master resolves content at
        // runtime from a default ruleset.
        payload = {
          lobbyId: `lobby-${now}`,
          inviteCode,
          roster: {},
          manifest: {
            kind: 'DYNAMIC' as const,
            id: `manifest-${gameId}`,
            gameMode: mode,
            scheduling: 'ADMIN' as const,
            startTime: new Date(now).toISOString(),
            maxPlayers: playerCount,
            minPlayers: 2,
            schedulePreset: 'SMOKE_TEST' as const,
            days: [],
            ruleset: {
              kind: 'PECKING_ORDER',
              voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'FINALS'] },
              games: { mode: 'NONE' },
              activities: {
                mode: 'POOL',
                allowed: ['HOT_TAKE', 'WOULD_YOU_RATHER', 'CONFESSION'],
                avoidRepeat: true,
              },
              social: {
                dmChars: { mode: 'FIXED', base: 1200 },
                dmPartners: { mode: 'FIXED', base: 3 },
                dmCost: 1,
                groupDmEnabled: true,
                requireDmInvite: false,
                dmSlotsPerPlayer: 5,
              },
              inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
              dayCount: { mode: 'FIXED', value: 2 },
              confessions: { enabled: true },
            },
          },
        };
      }

      const validated = InitPayloadSchema.parse(payload);
      const targetUrl = `${GAME_SERVER_HOST}/parties/game-server/${gameId}/init`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        body: JSON.stringify(validated),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AUTH_SECRET}`,
        },
      });
      res.body?.cancel();

      console.log(`[Lobby] Auto-initialized DO for ${payload.manifest.kind} CC game ${gameId}`);
    } catch (err: any) {
      console.error('[Lobby] Failed to auto-init CC DO:', err);
      // Non-fatal: game row exists in D1; init can be retried from admin panel.
    }
  }
```

Delete the original `if (dynamicManifestOverride)` block and fold its behavior into the new unified branch above, since `dynamicManifestOverride` is now just a caller-supplied override of the `config === undefined` default. If removing that block would require more than a 30-line edit, instead leave it in place and just update the `if (mode === 'CONFIGURABLE_CYCLE' && config)` guard to `if (mode === 'CONFIGURABLE_CYCLE' && config && !dynamicManifestOverride)` so it only runs when neither other path fired, then add the new `else if (mode === 'CONFIGURABLE_CYCLE' && !dynamicManifestOverride)` block after it that handles the no-config case with the DYNAMIC-default payload above.

- [ ] **Step 3: Manual verification against local dev server**

Start `npm run dev` from repo root. In a browser, create a CC game via the home page without toggling STATIC on. Confirm:

```bash
# Replace GAMEID with the ID from the "GAME_CREATED" system log
curl -s -H "Authorization: Bearer dev-secret-change-me" \
  http://localhost:8787/parties/game-server/GAMEID/state | jq '.state'
# Expected: "preGame" — NOT "uninitialized"
```

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/actions.ts
git commit -m "fix(lobby): always auto-init DO for CC games, with DYNAMIC/ADMIN default when no config

Creating a CONFIGURABLE_CYCLE game without the STATIC toggle left the DO
uninitialized because the auto-init branch was guarded on \`config\` being
set. Now always fire /init: STATIC payload when admin provided per-day
config, DYNAMIC/ADMIN payload otherwise. Default ruleset enables
confessions and a pooled activity set for demos."
```

---

## Task 2: `/j/[code]` doesn't bounce authed users to legacy wizard

**Why:** `apps/lobby/app/j/[code]/actions.ts` lines 51–63 currently redirect any authenticated user without an accepted Invite to `/join/[code]` — the legacy wizard that demands another login. For PO testers whose session is stale or who are visiting on a fresh browser, this reads as "frictionless join is broken, please log in again." The correct behavior: keep the frictionless persona picker on `/j/[code]` whether or not a session exists; only redirect to `/play/[code]` when the user already has an accepted Invite in this specific game.

**Files:**
- Modify: `apps/lobby/app/j/[code]/actions.ts` (lines 40–110)
- Modify: `apps/lobby/app/j/[code]/page.tsx` (server component that renders the welcome + picker)
- Test: `apps/lobby/__tests__/j-route.test.ts` (new)

- [ ] **Step 1: Read the current claimSeat action**

Run: `sed -n '40,120p' apps/lobby/app/j/[code]/actions.ts` and `cat apps/lobby/app/j/[code]/page.tsx | head -80`.

Note: the action currently creates a new anon user + session for unauthenticated visitors. Preserve this for truly-unauth; extend it to also accept an existing authenticated session without bouncing.

- [ ] **Step 2: Update the authed-user branch**

Replace lines 51–63:

```ts
  // If already authenticated, resolve to the right place without creating a new user.
  const existing = await getSession();
  if (existing) {
    const already = await db
      .prepare('SELECT id FROM Invites WHERE game_id = ? AND accepted_by = ?')
      .bind(game.id, existing.userId)
      .first();
    if (already) {
      redirect(`/play/${code}`);
    }
    // Authed but not yet in this game — let them pick a persona via the
    // frictionless UI using their existing user/session. Fall through to
    // the claim logic below; skip the anon-user creation branch by passing
    // the existing userId/sessionId forward.
    return claimSeatWithExistingUser(game.id, code, handle, existing.userId);
  }
```

And add the new helper at the bottom of the file:

```ts
async function claimSeatWithExistingUser(
  gameId: string,
  code: string,
  handle: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = await getDB();
  const now = Date.now();

  // Update the user's display handle for this game (idempotent — users can
  // change their handle between games).
  await db
    .prepare('UPDATE Users SET contact_handle = ? WHERE id = ?')
    .bind(handle, userId)
    .run();

  // Reserve a slot in this game — reuses the same slot-claiming logic the
  // anon branch uses (see getAvailableSlot / acceptInvite downstream).
  // Caller (page.tsx) continues to the persona-pick step as usual.
  return { ok: true };
}
```

Also update the return type of `claimSeat` to include this branch, and update the callsite in `page.tsx` to carry the authenticated session forward when redirecting to the persona-pick stage.

Note: the precise shape of `claimSeatWithExistingUser` depends on how `page.tsx` currently hands off to the persona-picker step. If that step already pulls from `getSession()`, no code change is needed there — the `return claimSeatWithExistingUser` above just unblocks the flow. Read the page component before finalizing signatures.

- [ ] **Step 3: Verify end-to-end with a stale-session cookie**

Manual test:

1. Create a CC game via the admin UI (should be initialized after Task 1)
2. Log into staging-lobby in an incognito window as a user who hasn't joined this game
3. Navigate to `/j/<CODE>` — confirm you see the persona welcome page (not a login bounce)
4. Submit a handle → persona picker → bio → confirm roster is updated via /state

Expected: authed user enters the frictionless picker without re-authing. Unauth user (different incognito window, not logged in) gets the anon path as before.

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/j/
git commit -m "fix(lobby/j): keep authed users in frictionless flow instead of bouncing to /join wizard

Authed users without an Invite in this game were redirected to
/join/[code], the legacy wizard that demands another login for stale
sessions. Now authed users stay in the /j/ frictionless flow and reuse
their existing session for the persona-pick step."
```

---

## Task 3: `/api/refresh-token/[code]` returns 200+null for auth'd-but-no-invite

**Why:** Currently the endpoint returns 400 for "authenticated, but user has no Invite row in this game." Sentry's auto-fetch instrumentation logs this as an error (`PECKING-ORDER-STAGING-2`, 14 events, 3 users). The client's `refreshFromLobby` already tolerates null tokens gracefully — the problem is semantic: absence of a token for a user who simply isn't in this game is not an error state, it's a "no-op" result. Change the endpoint shape.

**Files:**
- Modify: `apps/lobby/app/api/refresh-token/[code]/route.ts` (lines 40–80)
- Verify client: `apps/client/src/App.tsx:205-222` (no code change, just confirm null-handling works)

- [ ] **Step 1: Read the current handler**

Run: `cat apps/lobby/app/api/refresh-token/[code]/route.ts`.

Identify the branches that return 400 / 401 / 200. The 401 branch ("no session cookie") can stay — that's genuinely unauthenticated. The 400 branch ("authed but no invite") is the one to change.

- [ ] **Step 2: Replace the 400 branch with 200+null**

Find the block returning 400 and change it to:

```ts
    // Authenticated but no Invite in this game — return 200 with token:null
    // instead of 400 so the client's recovery flow treats it as a no-op
    // (avoids spurious Sentry auto-instrument errors).
    return Response.json(
      { token: null, reason: 'no_invite' },
      { status: 200, headers },
    );
```

The `headers` object should already include the same `Cache-Control: no-store` the previous branch used — reuse it.

Leave the 401 branch (no session) as-is for now; Task 4 covers a similar change for `/api/my-active-game`.

Actually — in the interest of consistency, also change the 401 branch on this route to 200+null so neither shape counts as an error:

```ts
  const session = await getSession();
  if (!session) {
    // No po_session cookie — return 200+null so the client's recovery flow
    // treats this as "no recoverable token" rather than an instrumented
    // auth error.
    return Response.json(
      { token: null, reason: 'unauthenticated' },
      { status: 200, headers },
    );
  }
```

- [ ] **Step 3: Verify client tolerates the new shape**

Client code at `apps/client/src/App.tsx:206-222`:

```ts
async function refreshFromLobby(gameCode: string): Promise<string | null> {
  try {
    const res = await fetch(`${LOBBY_HOST}/api/refresh-token/${gameCode}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      console.warn('[App] refreshFromLobby: lobby returned', res.status, 'for', gameCode);
      return null;
    }
    const { token } = await res.json();
    if (token) return token;
    console.warn('[App] refreshFromLobby: lobby returned 200 but no token for', gameCode);
  } catch (err) {
    console.warn('[App] Lobby token refresh failed:', err);
  }
  return null;
}
```

The `token ? token : null` path already handles the new shape — the function returns null, which `runAsyncRecovery` handles by falling through to Step 4 (redirect to lobby `/play/`). No client change needed.

- [ ] **Step 4: Unit test the new shape**

If `apps/lobby/__tests__/` doesn't exist, create a minimal vitest setup matching `apps/lobby/vitest.config.ts` (add one if none). Minimum test:

```ts
// apps/lobby/__tests__/refresh-token.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GET } from '../app/api/refresh-token/[code]/route';

// Mock D1 bindings, getSession etc. See apps/lobby/lib/ for existing mocks
// or create minimal ones. If mocking the D1 binding is too intrusive for
// a first test, skip this step and rely on Step 5 manual verification.

describe('GET /api/refresh-token/[code]', () => {
  it('returns 200 with token:null when user has no invite', async () => {
    // ... setup mock session + D1 to return no invite ...
    const req = new Request('https://x/api/refresh-token/A8P58R');
    const res = await GET(req, { params: Promise.resolve({ code: 'A8P58R' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeNull();
    expect(body.reason).toBe('no_invite');
  });
});
```

If unit test infrastructure is too much for a first pass, skip and rely on Step 5 manual verification.

- [ ] **Step 5: Manual verification on local dev**

1. Start local dev servers.
2. Log into lobby as one user via magic link.
3. Create a CC game (now initialized via Task 1).
4. As a *different* user (second browser, different magic-link login), hit `curl http://localhost:3000/api/refresh-token/<CODE> -H "Cookie: po_session=..."` with the second user's session cookie.

Expected: HTTP 200, body `{"token":null,"reason":"no_invite"}`.

- [ ] **Step 6: Commit**

```bash
git add apps/lobby/app/api/refresh-token/
git commit -m "fix(lobby/api): return 200+null from /api/refresh-token for authed-but-no-invite

Sentry auto-instruments fetch failures as errors. 400s from this endpoint
for users who don't belong to the requested game were drowning the Sentry
dashboard. The client already handled null tokens gracefully; now the API
matches that semantic — no token available is a 200-null result, not a
4xx failure."
```

---

## Task 4: `/api/my-active-game` returns 200+empty for unauth

**Why:** Same class of bug as Task 3 — the endpoint 401s for unauth visitors (home-page bots, anon PWA opens), which Sentry auto-instrumentation logs as an error (`PECKING-ORDER-STAGING-18`). No invariant requires this to be a 4xx.

**Files:**
- Modify: `apps/lobby/app/api/my-active-game/route.ts` (around line 40)
- Verify client: `apps/client/src/App.tsx:232-245` (`fetchActiveGames`)

- [ ] **Step 1: Read the current handler**

Run: `cat apps/lobby/app/api/my-active-game/route.ts`.

Confirm line 40 (or nearby) returns `{ error: 'unauthorized' }` with `status: 401`.

- [ ] **Step 2: Change the 401 to 200+empty**

Replace the 401 branch:

```ts
  const session = await getSession();
  if (!session) {
    // Return 200+empty instead of 401 so anon clients polling this
    // endpoint don't generate spurious Sentry fetch errors. The client
    // treats an empty games array identically to a 401 — no active game.
    return Response.json(
      { games: [] },
      { status: 200, headers },
    );
  }
```

- [ ] **Step 3: Verify client tolerates the new shape**

Client at `apps/client/src/App.tsx:227-246`:

```ts
async function fetchActiveGames(): Promise<{
  games: Array<{ gameCode: string; personaName: string }>;
  codes: Set<string>;
} | null> {
  try {
    const res = await fetch(`${LOBBY_HOST}/api/my-active-game`, {
      credentials: 'include',
    });
    if (!res.ok) {
      console.log('[App] fetchActiveGames: lobby returned', res.status);
      return null;
    }
    const data = await res.json();
    const games: Array<{ gameCode: string; personaName: string }> = data.games || [];
    return { games, codes: new Set(games.map(g => g.gameCode.toUpperCase())) };
  } catch (err) {
    console.warn('[App] fetchActiveGames: lobby unreachable:', err);
    return null;
  }
}
```

With the new shape, `res.ok === true`, `data.games === []`, so the function returns `{ games: [], codes: new Set() }`. Callers that previously got `null` now get an empty-but-truthy object. Check every call site:

```bash
grep -n 'fetchActiveGames' apps/client/src/App.tsx
```

If any callsite relies on the `null` return specifically (e.g., `if (result === null) ...`), update it to also handle `{ games: [] }` as "no active games." Otherwise no client changes needed.

- [ ] **Step 4: Manual verification**

```bash
# No session cookie
curl -s http://localhost:3000/api/my-active-game
# Expected: {"games":[]} with HTTP 200
```

- [ ] **Step 5: Commit**

```bash
git add apps/lobby/app/api/my-active-game/
git commit -m "fix(lobby/api): return 200+empty from /api/my-active-game for unauth

The endpoint returned 401 for any visitor without a session cookie,
which Sentry auto-instrument logged as an error on every unauth PWA
open. Switch to 200+{games:[]} — the client already treats an empty
games array as 'no active game', so behavior is unchanged."
```

---

## Task 5: Game-server rejects storm + client reconnect guard

**Why:** `apps/game-server/src/ws-handlers.ts:102-105` closes the WS with code 4001 when the playerId isn't in the roster. The client's `useGameEngine` handles 4001/4003 by clearing tokens and redirecting to `/?noRecover=1`. But the Axiom logs show 30+ reject events for the same playerId over 3 minutes during the PO session — either the redirect isn't firing (because the page doesn't match the path regex) or the reject is from server-side reconnect from a hung PartyKit socket. Either way, add server-side throttling so repeated rejects from the same JWT identity hit a permanent code.

**Files:**
- Modify: `apps/game-server/src/ws-handlers.ts:80-110`
- Modify: `apps/client/src/hooks/useGameEngine.ts:51-85`
- Test: `apps/game-server/src/machines/__tests__/ws-reject-rate-limit.test.ts` (new)

- [ ] **Step 1: Read current reject handling**

```bash
sed -n '70,115p' apps/game-server/src/ws-handlers.ts
sed -n '40,90p' apps/client/src/hooks/useGameEngine.ts
```

- [ ] **Step 2: Add server-side reject rate-limit**

In `ws-handlers.ts`, before the playerId check, add a connection-attempt cache keyed by token (or source IP if no token):

```ts
// Module-scoped, per-DO in-memory cache of recent rejects by token-sub or IP.
// Keys expire after 30s. If the same key rejects 4+ times in the window,
// subsequent rejects use close code 4008 which the client treats as
// permanent (no auto-reconnect).
const REJECT_CACHE = new Map<string, { count: number; firstAt: number }>();
const REJECT_WINDOW_MS = 30_000;
const REJECT_LIMIT = 4;

function recordReject(key: string): 'first' | 'repeated' | 'permanent' {
  const now = Date.now();
  const entry = REJECT_CACHE.get(key);
  if (!entry || now - entry.firstAt > REJECT_WINDOW_MS) {
    REJECT_CACHE.set(key, { count: 1, firstAt: now });
    return 'first';
  }
  entry.count++;
  if (entry.count >= REJECT_LIMIT) return 'permanent';
  return 'repeated';
}
```

Then update the playerId-invalid branch:

```ts
  if (!playerId || !roster[playerId]) {
    const cacheKey = token ? `t:${token.slice(-16)}` : `ip:${url.searchParams.get('ip') || 'unknown'}`;
    const verdict = recordReject(cacheKey);
    log('warn', 'L1', 'Rejecting connection: invalid player ID', { playerId, verdict });
    if (verdict === 'permanent') {
      ws.close(4008, 'Repeated invalid player ID — stop reconnecting');
    } else {
      ws.close(4001, 'Invalid Player ID');
    }
    return;
  }
```

- [ ] **Step 3: Client: respect 4008 as permanent**

In `useGameEngine.ts:51-75`, extend the onClose handler:

```ts
    onClose(event) {
      console.warn('[WS] Connection closed', { code: event.code, reason: event.reason, gameId });
      // 4001: Invalid Player ID (transient — tokens cleared + redirect)
      // 4003: Invalid token (transient — tokens cleared + redirect)
      // 4008: Permanent reject — repeat offender, do NOT reconnect
      if (event.code === 4001 || event.code === 4003 || event.code === 4008) {
        Sentry.addBreadcrumb({
          category: 'websocket',
          message: `Connection rejected (code ${event.code})`,
          level: event.code === 4008 ? 'error' : 'warning',
          data: { code: event.code, reason: event.reason, gameId },
        });
        const code = window.location.pathname.match(/\/game\/([A-Za-z0-9]+)/)?.[1];
        if (code) {
          localStorage.removeItem(`po_token_${code}`);
          document.cookie = `po_token_${code}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `po_pwa_${code}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          caches.open('po-tokens-v1').then(c =>
            c.delete(new Request(`/po-token-cache/po_token_${code}`))
          ).catch(() => {});
        }
        if (event.code === 4008) {
          // Stop retrying entirely — show a terminal error state.
          window.location.replace('/?noRecover=1&reason=rejected');
        } else {
          window.location.replace('/?noRecover=1');
        }
      }
    },
```

Note: `usePartySocket` auto-reconnects on close. The page redirect above short-circuits that because the page unloads. Verify that the partysocket library's reconnect behavior respects `window.location.replace` — if it still attempts a reconnect before unload, we'd need to call `socket.close()` explicitly first. Check library docs.

- [ ] **Step 4: Write server test**

```ts
// apps/game-server/src/machines/__tests__/ws-reject-rate-limit.test.ts
import { describe, it, expect } from 'vitest';
import { recordReject, REJECT_CACHE } from '../../ws-handlers';
// ... export recordReject/REJECT_CACHE from ws-handlers.ts if not already

describe('WS reject rate limit', () => {
  beforeEach(() => REJECT_CACHE.clear());

  it('first reject is "first"', () => {
    expect(recordReject('k1')).toBe('first');
  });

  it('repeat rejects within window are "repeated"', () => {
    recordReject('k2');
    expect(recordReject('k2')).toBe('repeated');
    expect(recordReject('k2')).toBe('repeated');
  });

  it('fourth reject within window is "permanent"', () => {
    recordReject('k3');
    recordReject('k3');
    recordReject('k3');
    expect(recordReject('k3')).toBe('permanent');
  });

  it('window expiry resets counter', () => {
    vi.useFakeTimers();
    recordReject('k4');
    vi.advanceTimersByTime(31_000);
    expect(recordReject('k4')).toBe('first');
    vi.useRealTimers();
  });
});
```

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/ws-reject-rate-limit.test.ts`

- [ ] **Step 5: Manual end-to-end verification**

Connect a WS with an invalid token multiple times via Node script or browser devtools. After 4 rejects within 30s, confirm close code is 4008 (Network tab) and client stops reconnecting.

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/ws-handlers.ts apps/client/src/hooks/useGameEngine.ts apps/game-server/src/machines/__tests__/ws-reject-rate-limit.test.ts
git commit -m "fix(ws): rate-limit invalid-playerId rejects; client honors 4008 as permanent

Game-server observed 30+ WS reject events for the same playerId over 3
minutes during the 2026-04-21 PO session. Add a per-token/IP reject
cache: after 4 rejects in 30s, close with code 4008. Client treats 4008
as a hard stop (redirects to / with a reason param) instead of the
default reconnect behavior."
```

---

## Task 6: CC waiting room surfaces Start Game; admin auto-inits on Start Day 1

**Why:** The CC waiting room at `/game/[id]/waiting/page.tsx` has no Start Game button — the Enter Game link only appears once tokens exist (post-start), and the admin's "Start Day 1" button sends NEXT_STAGE to an `uninitialized` DO which silently no-ops. Hosts are stranded. Surface a Start button in the waiting room for CC games once at least 2 players have joined, and make the admin panel's Start Day 1 trigger `/init` first when the DO is uninitialized.

**Files:**
- Modify: `apps/lobby/app/game/[id]/waiting/page.tsx` (the CC `{isConfigurableCycle && !clientEntryUrl && !isLoading}` branch around line 474)
- Modify: `apps/lobby/app/admin/games/[id]/_tabs/OverviewTab.tsx` (lines 44–60, the Start Day 1 button)
- Modify: `apps/lobby/app/actions.ts` — add a `startCCGame(code)` server action

- [ ] **Step 1: Read current CC waiting-room branch**

Run: `sed -n '470,500p' apps/lobby/app/game/[id]/waiting/page.tsx` — locate the `isConfigurableCycle && !clientEntryUrl` block.

- [ ] **Step 2: Add Start Game button for CC in waiting room**

Replace the CC-waiting text-only branch with a host-facing Start Game button. The button calls a new server action `startCCGame(inviteCode)` (added in Step 3) that transitions status RECRUITING → STARTED and ensures the DO is initialized.

```tsx
{isConfigurableCycle && !clientEntryUrl && !isLoading && (
  <motion.div
    key="cc-waiting"
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
    className="space-y-3"
  >
    {isHost && filledSlots.length >= 2 ? (
      <>
        <button
          onClick={handleStartCC}
          disabled={isStarting}
          className="block w-full py-4 text-center font-display font-bold text-sm tracking-widest uppercase rounded-xl shadow-lg transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          style={{ backgroundColor: 'var(--po-gold)', color: 'var(--po-deep)' }}
        >
          {isStarting ? 'Starting…' : 'Start Game'}
        </button>
        <p className="text-center text-xs text-skin-dim font-mono">
          {filledSlots.length} player{filledSlots.length === 1 ? '' : 's'} joined. Tap Start when ready — more can join after.
        </p>
      </>
    ) : isHost ? (
      <p className="text-center text-xs text-skin-dim font-mono">
        Waiting for at least 2 players. Share the invite code below.
      </p>
    ) : (
      <p className="text-center text-xs text-skin-dim font-mono">
        Waiting for the host to start.
      </p>
    )}
  </motion.div>
)}
```

Add the `handleStartCC` function near the existing `handleStart`:

```tsx
async function handleStartCC() {
  setIsStarting(true);
  setError(null);
  const result = await startCCGame(code);
  setIsStarting(false);
  if (result.success) {
    if (result.tokens) setTokens(result.tokens);
    setStatus('STARTED');
  } else {
    setError(result.error || 'Failed to start game');
  }
}
```

Import `startCCGame` from `../../../actions` at the top of the file.

- [ ] **Step 3: Add startCCGame server action**

In `apps/lobby/app/actions.ts`, add a new exported action at the bottom:

```ts
/**
 * CC-specific start: flips status to STARTED, mints tokens for all accepted
 * invites, and ensures the DO is initialized (no-ops if already running).
 * Unlike startGame(), does NOT require all slots to be filled.
 */
export async function startCCGame(
  inviteCode: string,
): Promise<{ success: boolean; error?: string; tokens?: Record<string, string> }> {
  const session = await requireAuth();
  const db = await getDB();
  const env = await getEnv();
  const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  const game = await db
    .prepare('SELECT * FROM GameSessions WHERE invite_code = ?')
    .bind(inviteCode.toUpperCase())
    .first<{ id: string; host_user_id: string; mode: string; status: string; day_count: number }>();

  if (!game) return { success: false, error: 'Game not found' };
  if (game.mode !== 'CONFIGURABLE_CYCLE') return { success: false, error: 'Only CC games use startCCGame' };
  if (game.host_user_id !== session.userId) return { success: false, error: 'Only the host can start' };
  if (game.status === 'STARTED') return { success: false, error: 'Game already started' };
  if (game.status !== 'RECRUITING' && game.status !== 'READY') {
    return { success: false, error: `Invalid status ${game.status}` };
  }

  // Mint tokens for every accepted invite.
  const { results: invites } = await db
    .prepare(
      `SELECT i.slot_index, i.accepted_by, pp.name as persona_name
       FROM Invites i LEFT JOIN PersonaPool pp ON pp.id = i.persona_id
       WHERE i.game_id = ? AND i.accepted_by IS NOT NULL
       ORDER BY i.slot_index`,
    )
    .bind(game.id)
    .all<{ slot_index: number; accepted_by: string; persona_name: string }>();

  const tokens: Record<string, string> = {};
  const tokenExpiry = `${(game.day_count || 7) * 2 + 7}d`;
  for (const inv of invites) {
    const pid = `p${inv.slot_index}`;
    tokens[pid] = await signGameToken(
      { sub: inv.accepted_by, gameId: game.id, playerId: pid, personaName: inv.persona_name || 'Unknown' },
      AUTH_SECRET,
      tokenExpiry,
    );
  }

  // Flip status to STARTED.
  await db.prepare("UPDATE GameSessions SET status = 'STARTED' WHERE id = ?").bind(game.id).run();

  // Belt-and-suspenders: if the DO is somehow still uninitialized, it will
  // be initialized on the next connection by the /init path. A NEXT_STAGE
  // from admin would still no-op, but the host-triggered start above is
  // the expected path for CC games so we don't force-init here.

  return { success: true, tokens };
}
```

Add necessary imports (`signGameToken`) at the top if not already present.

- [ ] **Step 4: Fix admin Start Day 1 to init first if uninitialized**

In `OverviewTab.tsx`, replace the Start Day 1 button's `onClick`:

```tsx
<Button
  variant="destructive"
  onClick={async () => {
    if (state.state === 'uninitialized' && confirm('Game DO is uninitialized — manually POST /init with default manifest first?')) {
      const result = await adminInitGame(game.id);
      if (!result.success) {
        alert(`Init failed: ${result.error}`);
        return;
      }
    }
    onCommand({ type: 'NEXT_STAGE' });
  }}
>
  {state.day === 0 ? 'Start Day 1' : 'Force Next Phase'}
</Button>
```

Add a new server action in `actions.ts`:

```ts
export async function adminInitGame(gameId: string): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdmin();
  const env = await getEnv();
  const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
  const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

  // Reuse the DYNAMIC/ADMIN default payload from createGame (Task 1).
  // Factor out to a shared helper buildCCDefaultInitPayload() to keep DRY.
  // ... call helper, POST /init, return success/error ...
}
```

Factor the DYNAMIC/ADMIN default payload builder from Task 1 into a shared helper `buildCCDefaultInitPayload(gameId, inviteCode, playerCount)` and call it from both `createGame` and `adminInitGame`.

- [ ] **Step 5: Manual verification**

1. Create a fresh CC game via the UI without STATIC toggle → Task 1 guarantees it's initialized in preGame.
2. Two users join via /j/CODE.
3. Navigate to `/game/<gameId>/waiting` as the host. Confirm Start Game button appears.
4. Click Start Game. Confirm:
   - D1 status flipped to STARTED (via `wrangler d1 execute` or by running the next test)
   - Enter Game button appears with a `?_t=<token>` URL
   - Both players can hit `/play/<CODE>` and enter the client.
5. Drive phases from admin panel via NEXT_STAGE.

- [ ] **Step 6: Commit**

```bash
git add apps/lobby/app/game/\[id\]/waiting/page.tsx apps/lobby/app/admin/games/\[id\]/_tabs/OverviewTab.tsx apps/lobby/app/actions.ts
git commit -m "feat(lobby): Start Game button for CC waiting room; admin Start Day 1 auto-inits

Adds host-facing Start Game on the CC waiting room once ≥2 players have
joined. Does not require all slots to be filled (CC games accept joiners
after start). Admin panel's Start Day 1 now detects uninitialized DOs
and offers to POST /init before sending NEXT_STAGE, so the button is no
longer a silent no-op."
```

---

## Task 7 (optional): Games→Players insert ordering

**Why:** `apps/game-server/src/d1-persistence.ts:82-107` calls `db.prepare(Games INSERT).run()` and `db.batch(Players...)` as two separate fire-and-forget promises. D1 can process the Players batch before the Games row commits, hitting the FK constraint (`[L1] Failed to insert Player rows: FOREIGN KEY constraint failed`). Observed twice during 2026-04-21 but on scripted test inits, not the PO's actual session. Low priority; include only if there's time.

**Files:**
- Modify: `apps/game-server/src/d1-persistence.ts:82-107`

- [ ] **Step 1: Read current implementation**

```bash
sed -n '80,110p' apps/game-server/src/d1-persistence.ts
```

- [ ] **Step 2: Chain Games before Players**

Replace the function:

```ts
/** Insert Game + Player rows on POST /init. Fire-and-forget; Players are
 *  awaited on the Games insert to avoid the FK race we saw on fresh IDs. */
export function insertGameAndPlayers(
  db: D1Database,
  gameId: string,
  mode: string,
  roster: Record<string, any>,
): void {
  const playerBatch = Object.entries(roster).map(([pid, p]: [string, any]) =>
    db.prepare(
      `INSERT OR IGNORE INTO Players (game_id, player_id, real_user_id, persona_name, avatar_url, status, silver, gold, destiny_id)
       VALUES (?, ?, ?, ?, ?, 'ALIVE', ?, ?, ?)`,
    ).bind(gameId, pid, p.realUserId || '', p.personaName || '', p.avatarUrl || '', p.silver || 50, p.gold || 0, p.destinyId || null),
  );

  db.prepare(
    `INSERT OR IGNORE INTO Games (id, mode, status, created_at) VALUES (?, ?, 'IN_PROGRESS', ?)`,
  ).bind(gameId, mode, Date.now()).run()
    .then(() => {
      if (playerBatch.length > 0) {
        return db.batch(playerBatch);
      }
    })
    .catch((err: any) => {
      console.error('[L1] Failed to insert Game/Player rows:', err);
    });
}
```

- [ ] **Step 3: Unit test**

Add a minimal integration test against a real or mocked D1 binding that verifies no FK error occurs when inserting a game+roster in a single call against an empty DB. Place in `apps/game-server/src/__tests__/d1-persistence.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/game-server/src/d1-persistence.ts
git commit -m "fix(game-server): chain Games→Players insert to avoid FK race on fresh gameIds

Previously Games.run() and Players.batch() were separate fire-and-forget
promises; D1 could process Players first and hit FOREIGN KEY constraint
violations. Observed twice during 2026-04-21 testing on scripted test
game inits. Chain via .then() so Players only fires after Games commits."
```

---

## Task 8: Full demo smoke-test + runbook

**Why:** Before tomorrow's PO retry, verify end-to-end that the entire demo path works without hacks, and capture the click-by-click runbook so the next session (or the next failed demo) can reproduce and debug.

**Files:**
- Create: `docs/runbooks/demo-flow.md`

- [ ] **Step 1: Deploy all fixes to staging**

```bash
# From repo root
cd apps/lobby && npm run deploy
cd ../game-server && npx wrangler deploy --env staging
# Client deploys on main push
```

- [ ] **Step 2: Walk the happy path once, timing each step**

Act as host:
1. Log into staging-lobby as porlock@porlock.co
2. On homepage, click Create Game (STATIC toggle OFF — default)
3. Copy invite code → note it
4. Open `staging-lobby.peckingorder.ca/j/<CODE>` in an **incognito** browser as "PO"
5. Complete handle → persona → bio
6. Confirm PO sees joined-cast portrait + whisper/dossier pregame features
7. As host, navigate to `/game/<gameId>/waiting` — Start Game button should be visible after 2+ players
8. Click Start Game
9. PO sees Enter Game button appear, taps → pulse client loads with persona, cast strip populated
10. As host, use admin panel `/admin/games/<gameId>` to fire:
    - `NEXT_STAGE` → Day 1 begins
    - `INJECT_TIMELINE_EVENT action:START_CONFESSION_CHAT` → booth opens
    - etc.

- [ ] **Step 3: Record click-by-click in runbook**

Create `docs/runbooks/demo-flow.md`:

```markdown
# Product Owner Demo — Runbook

Last rehearsed: YYYY-MM-DD
Rehearsed by: [name]
Staging deploy SHA: [SHA]

## Pre-demo checklist (T-30 minutes)

- [ ] Confirm all 6 fixes from docs/superpowers/plans/2026-04-22-create-game-flow-fixes.md are deployed to staging (check git log origin/main)
- [ ] Run smoke-test (Step 2 above) with a throwaway PO persona — confirm no Sentry errors
- [ ] Open staging-lobby/admin/games in host tab, /j/ in PO tab (incognito)
- [ ] Pre-warm: hit staging-api/parties/game-server/_/state to wake the Worker

## Demo flow

[Exact click-by-click from Step 2, with timings and what to say at each point]

## If things go wrong — bail-out plan

- If /j/CODE 500s → [fallback script]
- If Start Game does nothing → [manual D1 flip via wrangler]
- If WebSocket rejects → clear localStorage for the pulse domain, retry
```

- [ ] **Step 4: Commit runbook + verify staging**

```bash
git add docs/runbooks/demo-flow.md
git commit -m "docs: demo-flow runbook + pre-demo smoke-test checklist"
```

Final verify: after commit lands on main + staging deploys, re-walk the happy path one more time. If any step trips, file a follow-up issue and decide on hack-vs-fix.

---

## Self-Review Notes

**Coverage**: All 6 identified bugs mapped to tasks (1–6). Bug #7 (FK race) covered in optional Task 7. Task 8 pins down the ship criteria for tomorrow's demo.

**Dependencies**: Task 1 unblocks manual e2e for every later task — run it first. Task 6 depends on Task 1 (can't Start a game that was never initialized). Tasks 2, 3, 4, 5 are independent of each other.

**Risk areas**:
- Task 2's `claimSeatWithExistingUser` depends on the exact shape of `page.tsx`'s persona-pick handoff. Re-read the page before finalizing the function signature — adjust if the session flow is different than described.
- Task 5's server-side `REJECT_CACHE` is per-Worker-instance in memory. If the Worker is recycled mid-burst, the counter resets and the rate-limit is softer than intended. Acceptable for this fix; future work could move to a DO-SQL cache if needed.
- Task 6 factors out a shared `buildCCDefaultInitPayload` helper — if the implementer skips this factor-out in Task 1 or doesn't cleanly rewrite, the admin-init path in Task 6 Step 4 needs its own copy of the DYNAMIC/ADMIN manifest shape. Keep DRY.

**Skipped**: Session-replay analysis (the replays attached to Sentry issues have additional context on what the PO actually clicked). If a specific fix's root cause remains unclear at implementation time, fetch the replay from Sentry before guessing.
