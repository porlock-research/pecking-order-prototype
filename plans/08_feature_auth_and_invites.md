# Feature: Auth, Login & Invite Flow

> Lobby-side user accounts, passwordless login, invite-based game joining, character select, and JWT-secured client entry.

---

## Overview

Players authenticate via email magic links in the lobby. Auth is required on all routes (`/`, `/join/*`, `/game/*`) via edge middleware — unauthenticated users are redirected to `/login?next={path}`. A host creates a game and shares an invite code. Players accept the invite, pick a character from a curated pool, and wait in a lobby. When all slots are filled any participant can launch the game. The lobby mints JWTs that the client passes to the game server on WebSocket connect.

```
Player                Lobby (Next.js + D1)           Game Server (DO)       Client (Vite SPA)
  |                         |                              |                       |
  |-- enter email --------->|                              |                       |
  |<-- magic link ----------|                              |                       |
  |-- click link ---------->|                              |                       |
  |<-- session cookie ------|                              |                       |
  |                         |                              |                       |
  |-- create game --------->|                              |                       |
  |<-- invite code ---------|                              |                       |
  |                         |                              |                       |
  |-- share code with friends                              |                       |
  |                         |                              |                       |
  |-- accept invite ------->| (pick character)             |                       |
  |<-- redirect to waiting -|                              |                       |
  |                         |                              |                       |
  |-- click launch -------->|-- POST /init (Bearer) ------>|                       |
  |                         |<-- 200 OK ------------------|                       |
  |<-- redirect to client --|------- /game/CODE?_t=JWT ----|---------------------->|
  |                         |                              |                       |
  |                         |                              |<-- WS connect + JWT --|
  |                         |                              |-- verify JWT          |
  |                         |                              |-- SYSTEM.SYNC ------->|
```

---

## Data Model (Lobby D1)

Six tables live in the lobby's D1 database (`pecking-order-lobby-db`):

| Table | Purpose |
|-------|---------|
| **Users** | Cross-game identity. `id` (UUID), `email` (unique), `display_name`, timestamps. |
| **Sessions** | Login sessions. Random token ID, 7-day expiry. Looked up via HTTP-only cookie `po_session`. |
| **MagicLinks** | Passwordless login tokens. 5-minute expiry, single-use. |
| **GameSessions** | Lobby-side game tracking. Status lifecycle: `RECRUITING` -> `READY` -> `STARTED` -> `COMPLETED`. Stores invite code, mode, day count, and serialized config. |
| **Invites** | One row per player slot. Tracks `accepted_by` (user ID) and `persona_id` (chosen character). First-come-first-served slot assignment. |
| **PersonaPool** | 24 curated characters with id, name, emoji avatar, and bio. Seeded via migration. |

Migrations: `apps/lobby/migrations/0001_initial.sql` (schema) and `0002_seed_personas.sql` (persona seed data).

---

## Authentication

### Magic Link Flow

1. Player visits `/login`, enters email.
2. Server action `sendMagicLink(email)`:
   - Upserts user in `Users` (create if new).
   - Generates random token, inserts into `MagicLinks` (5-min expiry).
   - Returns the link (displayed in UI; email sending is a future enhancement).
3. Player clicks link: `/login/verify?token=abc123`.
4. Server action `verifyMagicLink(token)`:
   - Validates token exists, not expired, not used.
   - Marks token as used.
   - Creates `Sessions` row (7-day expiry).
   - Sets HTTP-only `po_session` cookie.
   - Redirects to original destination (or `/`).

### Edge Middleware

`apps/lobby/middleware.ts` protects all app routes at the edge layer:

- **Matcher:** `'/'`, `'/join/:path*'`, `'/game/:path*'`
- Checks for `po_session` cookie. If missing, redirects to `/login?next={pathname}`.
- This ensures hosts are authenticated **before** creating a game, preventing invite code loss during the auth redirect. Previously the lobby home (`/`) was unprotected, so unauthenticated hosts could create a game, get an invite code, then lose it when redirected to login.

### Session Resolution

All authenticated server actions call `requireAuth(redirectTo?)`:
- Reads `po_session` cookie.
- Joins `Sessions` + `Users` to resolve `{ userId, email, displayName }`.
- If invalid/expired, redirects to `/login?next={redirectTo}`.

### Key Files

- `apps/lobby/middleware.ts` — Edge auth middleware (cookie check + redirect)
- `apps/lobby/lib/auth.ts` — `getSession()`, `requireAuth()`, `sendMagicLink()`, `verifyMagicLink()`, `logout()`
- `apps/lobby/app/login/page.tsx` — Email input form
- `apps/lobby/app/login/actions.ts` — `requestMagicLink()` server action
- `apps/lobby/app/login/verify/route.ts` — Token verification (route handler)

---

## Game Creation & Invites

### Create Flow

1. Authenticated host visits `/` (lobby home).
2. Configures game mode and per-day settings (vote type, game type, activity type).
3. Clicks "Create Game" -> server action `createGame(mode, debugConfig?)`:
   - Inserts `GameSessions` row with status `RECRUITING`.
   - Generates 6-char alphanumeric invite code (no ambiguous chars: no I/O/0/1).
   - Creates one `Invites` row per player slot.
4. UI shows the invite code and link to `/join/{code}`.

### Invite Acceptance

1. Player visits `/join/{code}`.
2. If not logged in, middleware redirects to `/login?next=/join/{code}`.
3. Server action `getInviteInfo(code)` returns:
   - Game info (mode, day count, player count, status).
   - Filled slots (who joined, which character they picked).
   - Available personas (full pool minus already-picked ones).
4. Player picks a character from the grid.
5. Server action `acceptInvite(code, personaId)`:
   - Validates: user not already in game, persona not taken, slots available.
   - Claims first unclaimed `Invites` row.
   - If all slots filled -> updates `GameSessions.status` to `READY`.
6. Redirects to waiting room `/game/{code}/waiting`.

### Waiting Room

- `/game/[id]/waiting/page.tsx` — fetches `getGameSessionStatus(inviteCode)` once on mount (no polling).
- URL uses the **invite code** (not internal game ID) to avoid leaking implementation details.
- Shows join progress (filled/empty slots with character avatars).
- When status is `READY`, any participant sees "Launch Game" button.
- When status is `STARTED`, shows "Enter Game" link pointing to client `/game/{CODE}?_t={JWT}`.

### Character Exclusivity

Each game has access to all 24 personas. Once a player picks one, it's removed from the available pool for that game. The invite page shows a grid of available characters with the taken ones filtered out.

### Key Files

- `apps/lobby/app/actions.ts` — `createGame()`, `getInviteInfo()`, `acceptInvite()`, `getGameSessionStatus()`, `startGame()`
- `apps/lobby/app/join/[code]/page.tsx` — Character select + join UI
- `apps/lobby/app/game/[id]/waiting/page.tsx` — Waiting room UI (URL `[id]` param is the invite code)

---

## Game Start & Handoff

When a player clicks "Launch Game" in the waiting room:

1. Server action `startGame(inviteCode)`:
   - Looks up game by invite code (case-insensitive).
   - Validates the caller is a participant in the game (any player, not just the host) and `READY` status.
   - Loads accepted invites + persona data from D1.
   - Builds roster from real user IDs + picked personas.
   - Builds manifest (day configs, timelines) from stored `config_json`.
   - Validates payload with `InitPayloadSchema`.
   - POSTs to game server with `Authorization: Bearer {AUTH_SECRET}`.
   - Mints a JWT per player via `signGameToken()`.
   - Updates status to `STARTED`.
2. Returns tokens map `{ p1: "eyJ...", p2: "eyJ...", ... }`.
3. Waiting room resolves the current user's token and shows "Enter Game" link.

### POST /init Authentication

The game server validates the `Authorization` header on POST `/init`:

```
Authorization: Bearer {AUTH_SECRET}
```

If `AUTH_SECRET` is set and the header doesn't match, returns 401. This prevents unauthorized callers from creating games.

---

## JWT Token System

### Shared Package

`packages/auth/` provides JWT utilities using `jose` (Workers-compatible). Both lobby and game server import `@pecking-order/auth`.

### Game Token Payload

```typescript
interface GameTokenPayload {
  sub: string;        // userId (from lobby Users table)
  gameId: string;     // game server room ID
  playerId: string;   // e.g. "p1", "p2"
  personaName: string;
  iat: number;        // issued at
  exp: number;        // expiry derived from game duration
}
```

### Token Expiry

Token lifetime is derived from the game's `day_count` (stored in `GameSessions`):

```
expiry = (day_count × 2) + 7 days
```

This gives double the game length plus a 7-day buffer for games that run slower than scheduled. Examples: 3-day game → 13d, 7-day game → 21d, 14-day game → 35d. The default fallback (when `day_count` is unavailable) is 30 days.

### Signing (Lobby Side)

```typescript
import { signGameToken } from '@pecking-order/auth';

const tokenExpiry = `${game.day_count * 2 + 7}d`;
const token = await signGameToken(
  { sub: userId, gameId, playerId: 'p1', personaName: 'Countess Snuffles' },
  AUTH_SECRET,
  tokenExpiry   // optional 3rd param, defaults to '30d'
);
```

### Verification (Game Server Side)

On WebSocket connect, the game server checks for a `?token=` query param:

1. If present: verifies JWT signature + expiry via `verifyGameToken()`. Extracts `playerId`.
2. If absent: falls back to legacy `?playerId=` query param (for debug/backward compat).
3. Validates that `playerId` exists in the game's roster.
4. Attaches `{ playerId }` to connection state.

### Client Side — Clean URL Pattern (localStorage + replaceState)

The client uses an OAuth-style token relay pattern to keep URLs clean and shareable:

1. **Lobby redirect**: When a player enters the game (via waiting room or `/play/{CODE}`), the lobby redirects to `CLIENT_HOST/game/{CODE}?_t={JWT}`.
2. **Token capture**: The client reads the `_t` param, decodes the JWT, stores it in `localStorage` keyed by game code (`po_token_{CODE}`), and immediately cleans the URL via `history.replaceState({}, '', '/game/{CODE}')`.
3. **Refresh + PWA resilience**: On page refresh or standalone PWA launch, the client finds no `_t` param but checks `localStorage` for a cached token matching the game code from the URL path. Unlike `sessionStorage`, `localStorage` persists across tab closes, browser restarts, and PWA standalone launches from the home screen.
4. **Result**: The canonical client URL is always `/game/{CODE}` — clean, shareable, and memorable. The JWT never persists in the URL bar after the initial redirect.

**Entry flow priority** (in `App.tsx`):
1. `/game/CODE?_t=JWT` — redirect arrival from lobby, store + clean URL
2. `/game/CODE` — refresh/PWA launch, check localStorage for cached token
3. `?token=JWT` — debug links from lobby (direct JWT entry)
4. `?gameId=&playerId=` — legacy backward compat

**Auto-cleanup**: On every app load, `pruneExpiredTokens()` iterates all `po_token_*` keys in `localStorage`, decodes each JWT, and removes any where `exp < now` or that fail to decode. This prevents stale tokens from accumulating and keeps the launcher screen showing only active games.

**Lobby play route**: `/play/[code]/route.ts` authenticates the user via session cookie, resolves their player slot and JWT, then redirects to the client. This is used when a player visits the lobby play URL directly (not just from the waiting room).

**SPA routing**: `apps/client/public/_redirects` contains `/* /index.html 200` for Cloudflare Pages fallback routing, ensuring `/game/{CODE}` paths resolve to the SPA.

Backward compatibility: if no JWT token is available via any method, falls back to `?gameId=&playerId=` query params.

---

## Debug Mode

### Quick Start (Skip Invites)

The debug flow bypasses D1 and auth entirely for rapid local testing:

1. Host clicks "Quick Start" on the lobby home page (with "Skip Invites" toggle ON).
2. Server action `startDebugGame(mode, config?)`:
   - Uses hardcoded personas (Countess Snuffles, Dr. Spatula, etc.).
   - Builds roster with `debug-user-{n}` as `realUserId`.
   - Mints JWTs with `dev-secret-change-me` as the signing secret.
   - POSTs directly to game server (same as normal flow).
3. Returns tokens — lobby links to client with `?token=` for p1.

This means:
- No D1 database needed for local dev.
- No login required.
- Admin console still accessible.
- All game mechanics work identically.

### Full Auth Flow (Debug Games)

When the "Skip Invites" toggle is OFF (default), debug games use the full invite/auth flow:

1. Host clicks "Create Game" — calls `createGame()` with debug config.
2. Invite code generated, waiting room available at `/game/{CODE}/waiting`.
3. Host shares invite code, players join via `/join/{CODE}`.
4. Same character selection, JWT minting, and clean URL flow as production.

This allows testing the complete lobby→game flow locally without deploying.

---

## Environment Variables

| Variable | Where | How Set | Purpose |
|----------|-------|---------|---------|
| `AUTH_SECRET` | Lobby + Game Server | `wrangler secret put` | JWT signing key, POST /init auth |
| `DB` | Lobby | D1 binding in `wrangler.json` | Lobby database (Users, Games, etc.) |
| `GAME_SERVER_HOST` | Lobby | `vars` in `wrangler.json` | URL of game server for POST /init |
| `GAME_CLIENT_HOST` | Lobby | `vars` in `wrangler.json` | URL of client app for redirect links |
| `VITE_GAME_SERVER_HOST` | Client | `.env.production` | Game server WebSocket host |
| `VITE_LOBBY_HOST` | Client | `.env.production` | Lobby URL for admin panel links |

For local dev, `AUTH_SECRET` defaults to `'dev-secret-change-me'` and the game server accepts connections without it.

---

## Security Model

| Boundary | Mechanism |
|----------|-----------|
| Lobby login | Magic link token (5-min, single-use) -> session cookie (HTTP-only, 7-day) |
| Lobby -> Game Server | Shared secret in `Authorization` header |
| Client -> Game Server | JWT in WebSocket query param (game-duration-based expiry, HS256) |
| Player identity | `playerId` extracted from verified JWT, not from client-supplied params |
| Roster validation | Even with valid JWT, `playerId` must exist in game roster |
| Client token storage | `localStorage` with auto-pruning of expired JWTs on app load |

### What's NOT yet implemented
- Email delivery (magic links are displayed in UI, not emailed)
- CSRF protection on server actions (Next.js provides some baseline protection)
- Session revocation UI
- Rate limiting on magic link generation
- Scheduled auto-start (games start manually via host button)
