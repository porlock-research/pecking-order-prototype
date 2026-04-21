# Dev Game Workflow + Frictionless Invite Flow + Wizard Commit-Early

**Date:** 2026-04-20
**Branch:** `feature/dev-game-workflow`
**Status:** Draft

## Motivation

Three problems compound to make local/staging testing brittle and cause real playtester failures:

1. **Bypass parity.** Local test games are minted by `scripts/tmp-create-game.js` or lobby "Skip invites" toggle — both POST `/init` directly. No `Users`, `Invites`, or `po_session` cookie exist. Bugs in archive-check, token-cache, invite-collision, and magic-link recovery don't surface locally because local doesn't exercise those paths.
2. **Designer distribution on staging.** Designers can't self-serve test games on staging — every invite requires email-auth signup. No path exists to share a single link with a group chat and let each designer claim a seat without the full wizard.
3. **Playtester "scenario 3" trap.** `acceptInvite` calls `/player-joined`. If L2 has left `preGame` (DYNAMIC CC day-1 alarm fired), DO returns 409, lobby flips `GameSessions.status = STARTED`, and the playtester sees *"This game has already started."* Real playtest quote: *"I forgot to click the last button when setting up and missed the deadline wompwomp."*

## Scope

**In this spec:**
- Super-admin-gated `/admin/create-debug` page + `createDebugGame()` server action.
- Frictionless `/j/CODE` route — one share URL per game; recipient types a name; auto-user-create; hand off to existing persona wizard.
- Schema: `Users.contact_handle TEXT` column; `Users.email` nullable.
- Wizard commit-early: `acceptInvite` fires when Q&A is complete, not gated on a final "Confirm" tap. Confirm step becomes optional review.
- Auto-redirect after wizard success → `/play/CODE` (client), skipping the mandatory waiting-room stop.
- Waiting room invite form: un-gate email input; keep `isHost` gate on the sent-invites list only.
- Email-on-flip fallback when L2 exits `preGame`.
- `/create-game` script rewrite: calls lobby server actions via authenticated HTTP, no direct `/init` POST.
- Deprecate `startDebugGame()` bypass path + remove `DEBUG_OVERRIDE` option from root `/` page.

**Explicitly NOT in this spec (other session owns):**
- Client pregame screen implementation (layout, arrival feed, Day 1 countdown, action cards).
- Invite affordance UI inside the client pregame state.
- Any visual design work on the Pulse pregame surface.

**Deferred (follow-up):**
- Status-gate cleanup on `/play/CODE` + `/api/refresh-token/CODE` for CC (latent ADR-067/118/086 drift — see "Follow-ups").
- True late-join support (scenario B: wizard after L2 has left preGame). Out of scope per user direction.

## Interface with the other session

**Contract:** After wizard commits early, the player is redirected to `/play/CODE` which mints a JWT and redirects to `/game/CODE?_t=JWT`. By the time the client loads, `PLAYER_JOINED` has fired on the server and L2 roster contains the player. Whatever the client renders when L2 is in `preGame` is the other session's responsibility.

**Share URL payload:** The `/j/CODE` URL is what the client pregame's invite-share-sheet affordance will share. This spec ships the route; the other session ships the surface that invokes `navigator.share()` with it.

---

## Design

### 1. Frictionless `/j/CODE` route

New Next.js route at `apps/lobby/app/j/[code]/route.ts` (matches existing `/invite/[token]` unauth-safe pattern) and a companion page `apps/lobby/app/j/[code]/page.tsx` for the welcome form.

**Middleware exemption:** Add `/j/*` to `middleware.ts` matcher exemption (currently protects `/`, `/join/*`, `/game/*`). `/j/*` must work pre-auth — it's where new users create their identity.

**Route behavior:**
1. Look up game by `invite_code`. If not found → 404 page.
2. If `GameSessions.status NOT IN ('RECRUITING', 'READY')` → render "This game already started" stale-link screen (mockup frame 2). No wizard entry.
3. If caller has `po_session` cookie and is already a player (`Invites.accepted_by = session.userId`) → redirect to `/play/CODE` (they're already in; jump to client).
4. Otherwise → render welcome form (mockup frame 3). Single field: "What should we call you?" with submit button.

**Submit action** (`claimSeat` server action):
1. If `po_session` exists → reuse. Else create new `Users` row (email=NULL, contact_handle=trimmed name).
2. Set `po_session` cookie (same format as existing auth cookie in `lib/auth.ts`).
3. Redirect to `/join/CODE` (existing persona wizard).

**Name validation:** 1-24 chars, trimmed. Strip zero-width / control chars. No uniqueness constraint — multiple "Alex"s are fine; host reveals curate identity at game end per mockup frame 5.

### 2. Schema migration

New migration `apps/lobby/migrations/0015_contact_handle.sql`:

```sql
-- Add contact_handle column for frictionless-invite users
ALTER TABLE Users ADD COLUMN contact_handle TEXT;

-- Make email nullable (was NOT NULL)
-- SQLite: recreate table since ALTER COLUMN isn't supported
-- (standard 12-step migration pattern)
```

Backfill existing rows: `contact_handle = email.split('@')[0]` where email is set (so their display names remain intact).

**PII:** `contact_handle` is low-sensitivity (user-typed, public at reveal) — does NOT need the `PII_ENCRYPTION_KEY` treatment that `email`/`phone` get per ADR-014-era lobby conventions.

### 3. Wizard commit-early

Current flow: `/join/CODE` wizard = persona draw → bio → Q&A → final **Confirm** button → `acceptInvite` fires.

New flow: fire `acceptInvite` on the step where Q&A is submitted (step 3 of 4), before the confirm screen. Confirm screen becomes a review/polish state that has no effect on roster membership.

**Server-side:** `acceptInvite` is idempotent for the same user+game — if already joined, return `{ success: true, alreadyJoined: true }` instead of the current error. Safe to call from either step 3 or step 4 (or both, if someone taps back).

**Client-side (lobby `/join/[code]/page.tsx`):** call `acceptInvite` at the moment Q&A is complete. Show a subtle "You're in" confirmation on the confirm step rather than "tap to commit." The only thing step 4 does is redirect to `/play/CODE` when tapped (or auto-redirect after a short delay if the user wanders away).

**Handling scenario 3 at step 3:** if `acceptInvite` returns the 409 error ("already started") at this earlier step, we still show a clean "game already started" state — but the player hasn't spent time on the Q&A yet. Less wasted effort.

**Time saved:** median wizard has ~15-30s of Q&A + ~5-10s of confirm review. Commit-early shaves the confirm-review window off the scenario-3 trap.

### 4. Auto-redirect after wizard

After `acceptInvite` success (either step 3 commit or step 4 confirm tap), redirect the user to `/play/CODE` instead of `/game/CODE/waiting`.

`/play/CODE` mints the JWT and redirects to `/game/CODE?_t=JWT` (client). The client handles whatever pregame state L2 is in — that's the other session's problem.

**Exception for hosts of STATIC/non-CC games:** they still need the waiting room's "Launch Game" button. Redirect host to `/game/CODE/waiting` for non-CC modes. CC hosts go to client.

**Waiting room stays navigable:** `/game/CODE/waiting` remains a valid URL. Deep links (PWA `start_url` fallbacks, bookmarks, shared links) continue to work. It's just no longer a mandatory stop in the happy path.

### 5. Waiting room invite form ungating

Current state: `/game/[id]/waiting/page.tsx:301` gates the entire invite section (form + sent-invites list) on `isHost`.

New state:
- **Form + email input + Send button + success/error toasts:** visible to all participants.
- **Sent-invites list (emails + pending/joined status):** `isHost` only (privacy — non-hosts shouldn't see other participants' email addresses).

Server-side `sendEmailInvite` already permits any participant per ADR-073. Only the UI gate changes.

### 6. Super-admin create-debug page

New page `apps/lobby/app/admin/create-debug/page.tsx` + server action `createDebugGame()` in `apps/lobby/app/admin/create-debug/actions.ts`.

Gated by existing `AdminLayout` (`isSuperAdmin()` check → redirect `/` if not allowed).

**Form fields:**
- Player count (1-8)
- Day count (1-10)
- Shell (pulse/vivid/classic/immersive)
- Schedule preset (SPEED_RUN / SMOKE_TEST / ADMIN-manual)
- Confession phase on/off
- `minPlayers` override (1 allowed for solo confession testing)
- Force cartridges (multi-select from `CARTRIDGE_INFO`)
- Push notifications on/off per trigger
- "Mint N per-slot magic links" toggle (default on)

**Env scoping:** the admin page creates games on whatever environment the lobby is running on. Designer wants a staging game → open staging admin page. The `/create-game` CLI tool keeps its `env=local|staging` flag (it's a cross-env tool by design) but routes through the same `createDebugGame()` action via HTTP.

**Server action `createDebugGame(config)`:**
1. Call existing `createGame()` — real lobby path, real `GameSessions` + (if STATIC) real `Invites` rows.
2. If `mintMagicLinks` → for each slot, sign a JWT via `signGameToken()` and return them in the response.
3. Return `{ gameId, inviteCode, shareUrl: /j/CODE, magicLinks: { p1: ..., p2: ... } | null, adminUrl, stateUrl }`.

**Output screen:**
- Big invite code + copy button
- `/j/CODE` share URL + copy + native share-sheet button
- Per-slot magic link list with copy buttons (if minted)
- Admin console link (`/admin/game/[gameId]`)
- "Enter as p1" quick link for self-testing

**Deprecations:**
- Remove `DEBUG_OVERRIDE (Manual)` option from the root `/` page's `<select>` (page.tsx:647).
- Remove the "Skip invites" toggle and `handleDebugStart` handler.
- Delete `startDebugGame()` from `actions.ts` (the bypass path — 823-919).
- Keep `DEBUG_PECKING_ORDER` mode enum value for backward compat with existing games, but creation path only goes via `createDebugGame()`.

### 7. Email-on-flip fallback

Trigger: L2 transitions `preGame → dayLoop` (DYNAMIC CC) or `startGame()` runs (STATIC).

**DYNAMIC CC:** L2 emits a new `INTERNAL.GAME_STARTED` event on entry to `dayLoop` (entry action in `l2-orchestrator.ts`). L1's existing inspector / state subscription surfaces this; L1 HTTP-POSTs to a new lobby endpoint `POST /api/game-started` with `{ gameCode, startedAt }`. The lobby:
1. Marks `GameSessions.status = STARTED` (fixes the ADR-067/118 drift latently — see Follow-ups).
2. Queries all participants with `email IS NOT NULL` AND `email_encrypted IS NOT NULL`.
3. For each, decrypt email, send a "Your game just started" Resend email with a one-click `/play/CODE` link.

**STATIC:** `startGame()` already flips status. Add the email-send loop to that path.

**Deduplication:** the endpoint is idempotent — only sends emails if `status` was previously non-STARTED. Guards against double-firing.

**Opt-out:** reuse existing unsubscribe/preferences infrastructure. MVP can send unconditionally to all participants; follow-up can add preference.

### 8. `/create-game` script rewrite

Current: `scripts/tmp-create-game.js` POSTs directly to game-server `/init`. Bypasses lobby D1 entirely.

New: the script becomes a thin CLI that authenticates against the lobby (or a super-admin API key) and calls `createDebugGame()` via HTTP. Parity is structural.

**Auth model for CLI:** add a `LOBBY_CLI_SECRET` env var that, if present on the lobby, allows calling `createDebugGame` via a dedicated POST endpoint `/api/admin/create-debug` (bearer-token gated, not UI-accessible). For local dev, this is `dev-secret-change-me` or similar. For staging, set via wrangler secret.

**Script output unchanged:** still writes `/tmp/pecking-order-test-game.json` with the same shape for Playwright consumption. Still prints magic links per slot.

**Slash command `/create-game`** continues to work; it just calls the rewritten script that calls the admin endpoint that calls `createDebugGame()`. Single code path.

### 9. Middleware exemption

`apps/lobby/middleware.ts` currently gates `/`, `/join/*`, `/game/*`. Add:
- `/j/*` — unauth-safe welcome for frictionless flow.

`/invite/[token]` and `/api/*` exemptions stay as-is.

---

## Follow-ups (not shipped here)

### Status-gate / refresh-token cleanup

ADR-067 established status-stays-`RECRUITING` for CC pre-game; ADR-118 removed the "all slots filled" trigger for DYNAMIC CC; ADR-086 aligned PID calculation across three token-minting routes but didn't revisit the `status === 'STARTED'` gate in two of them.

Residual issue: `/play/CODE` and `/api/refresh-token/CODE` both hardcode `status !== 'STARTED'` checks that break for DYNAMIC CC in `RECRUITING`. The email-on-flip trigger in §7 incidentally fixes this by flipping status correctly on L2's `preGame → dayLoop`. After §7 ships, the residual gates become dead code for DYNAMIC CC (status will be STARTED before anyone needs to refresh).

Cleanup task: once §7 is verified in production, remove the gates entirely for CC (trust `Invites.accepted_by` as the authority). Optionally write an ADR documenting the ADR-067/118/086 triangle and the resolution. Not shipped in this spec.

### True late-join (scenario B)

A player who enters the wizard after L2 has already moved past `preGame` is rejected even with commit-early (L2's `PLAYER_JOINED` handler only fires in `preGame`). Supporting this requires extending L2 to accept `PLAYER_JOINED` in `dayLoop` with content-hydration rules. Out of scope; own spec + own ADR.

---

## Data model changes

- `Users.contact_handle TEXT` (new)
- `Users.email TEXT NULL` (was `NOT NULL`)
- Migration: `apps/lobby/migrations/0015_contact_handle.sql`

---

## New routes / endpoints

- `GET /j/[code]` (unauth-safe welcome page)
- `POST /j/[code]/claim` (server action: upsert user, set cookie, redirect to `/join/CODE`)
- `GET /admin/create-debug` (super-admin page)
- `POST /api/admin/create-debug` (CLI-facing, bearer-token gated)
- `POST /api/game-started` (L1 → lobby callback on L2 `preGame → dayLoop` transition)

---

## Deleted / deprecated

- `startDebugGame()` in `apps/lobby/app/actions.ts` (the bypass path)
- `DEBUG_OVERRIDE (Manual)` option from the root `/` page select
- "Skip invites" toggle + `handleDebugStart` handler
- `scripts/tmp-create-game.js` (rewritten, not deleted)

---

## Regression checklist

- Existing `/invite/[token]` email flow works unchanged
- `/play/[code]` redirect still works for RECRUITING CC games (landing on waiting room with token)
- `/api/my-active-game` still includes RECRUITING games
- Push notifications (`sendGameEntryPush`) still fire when STARTED
- `/admin` dashboard, `/admin/inspector`, `/admin/game/[id]` still work
- E2E Playwright tests (`e2e/tests/`) still pass after waiting-room auto-redirect change
- Lobby E2E tests (`apps/lobby/e2e/`) updated for the new `/j/CODE` flow
- `sendEmailInvite` still works for any participant (no server change; UI ungating only)
- Host remains able to launch STATIC games via "Launch Game" button in waiting room

---

## Test plan

**Unit / component (apps/client, apps/lobby):**
- `/j/[code]` route: RECRUITING state renders welcome; non-RECRUITING renders stale-link; already-joined redirects to `/play/CODE`.
- `claimSeat` action: creates user with NULL email; sets po_session cookie; redirects.
- Wizard commit-early: `acceptInvite` fires on Q&A submit, idempotent on step 4 tap.
- Waiting room: non-host sees form but not sent-invites list.

**Integration (apps/game-server):**
- L2 `preGame → dayLoop` transition posts to lobby `/api/game-started`.
- Repeated posts are idempotent (status already STARTED).

**E2E (Playwright):**
- Full frictionless flow: new user hits `/j/CODE` → types name → persona wizard → lands in client.
- Commit-early: kill tab between Q&A and confirm; verify player is in roster.
- Scenario-3 trap no longer fires at the confirm step (should only fire at Q&A step or earlier).

**Manual checklist:**
- Create a debug game via `/admin/create-debug` → open `/j/CODE` in incognito → complete flow → verify in game server state.
- Staging designer flow: create debug game with mint-magic-links → share the `/j/CODE` URL with a colleague → verify they land in the client without a signup bounce.

---

## Risks

- **Middleware exemption** is a security-adjacent change. Audit carefully — `/j/*` must not leak session info or accept arbitrary input.
- **Nullable email migration** may break code paths that assume `user.email` is set. Grep for unsafe dereferences before rollout. Likely candidates: email templates, login UI, any admin views.
- **`po_session` creation for nameless users** — rate-limit the `claimSeat` action to prevent anonymous-user spam (lightweight: IP-based rate limit in the route handler).
- **Idempotency of `acceptInvite`** needs careful review. Currently throws "already joined" on re-submission; changing to a success-return must not mask legitimate errors (wrong persona, wrong bio format, etc.).
- **`/create-game` script auth rewrite** could break existing agent workflows. Ensure the slash-command continues working before merging.
