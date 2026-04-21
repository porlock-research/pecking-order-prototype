# Dev Game Workflow + Frictionless Invite Flow + Wizard Commit-Early

**Date:** 2026-04-20
**Branch:** `feature/dev-game-workflow`
**Status:** Draft (revised after review)

## Motivation

Three problems compound to make local/staging testing brittle and cost real playtesters their spots:

1. **Bypass parity.** Local test games are minted by `scripts/tmp-create-game.js` or the lobby "Skip invites" toggle — both POST `/init` directly. No `Users`, `Invites`, or `po_session` cookie exist. Bugs in archive-check, token-cache, invite-collision, and magic-link recovery don't surface locally because local doesn't exercise those paths.
2. **Designer distribution on staging.** Designers can't self-serve test games on staging — every invite requires email-auth signup. No path exists to share one URL with a group chat and let each designer claim a seat without the full wizard.
3. **Scenario-3 window (mitigation, not a fix).** `acceptInvite` calls `/player-joined`. If L2 has left `preGame` (DYNAMIC CC Day-1 alarm fired), DO returns 409 and `actions.ts:617-628` correctly releases the slot + flips status. This cleanup is correct behavior. But the window between wizard entry and final submit is long enough that players lose their setup to a real-world race. Real playtest quote: *"I forgot to click the last button when setting up and missed the deadline wompwomp."* This spec shrinks that window; it doesn't remove the race.

## Scope

**In this spec (three implementation phases):**

**Phase 1 — Foundation (low blast radius, ship first)**
- §5 Waiting-room invite form: un-gate email input; keep `isHost` gate on the sent-invites list only
- §8 `/create-game` script rewrite: single code path through `createDebugGame()`

**Phase 2 — Frictionless + admin tooling**
- §1 `/j/CODE` frictionless route
- §2 Schema: `Users.contact_handle TEXT`, `Users.email` nullable, type audit across consumers
- §6 Super-admin `/admin/create-debug` page + `createDebugGame()` server action
- Deprecations: remove `DEBUG_OVERRIDE`, `startDebugGame()`, `DEBUG_PECKING_ORDER` enum

**Phase 3 — Trap mitigation**
- §3 Wizard commit-early at step 3 (idempotent, step 4 becomes read-only review)
- §4 Auto-redirect after wizard
- §7 Email-on-flip fallback + `INTERNAL.GAME_STARTED` callback + status-flip completion

**Explicitly NOT in this spec (parallel session owns):**
- Client pregame screen implementation (layout, Day 1 countdown, arrival feed, action-card framework)
- Cast-grid rendering — moves from lobby waiting room to client pregame
- Share-URL invocation site — where `/j/CODE` is passed to `navigator.share()`

**Deferred (own spec, own ADR):**
- True late-join support (scenario B — wizard entered after L2 has left `preGame`). Requires L2 `PLAYER_JOINED` handler in `dayLoop` + content hydration rules.

## Interface with the parallel session

**We own (lobby + wizard + auth + admin):**
- `/j/CODE` URL and its unauth-safe welcome route
- `acceptInvite` idempotency and early-commit semantics
- Admin page + server action for creating debug games with magic links
- Email-on-flip + L1→lobby `INTERNAL.GAME_STARTED` callback + status flip
- `/create-game` script parity

**They own (client pregame surface):**
- What renders at `/game/CODE?_t=JWT` when L2 is in `preGame`
- **Cast-grid ownership transfers**: the "see who joined" UI currently at `apps/lobby/app/game/[id]/waiting/page.tsx:280-296` (lobby waiting room) moves to client pregame
- **Share-sheet invocation site**: the UI that calls `navigator.share({ url: '/j/CODE' })`. This spec ships the URL target; they ship the button that invokes it
- Day 1 countdown, arrival feed, action-card framework

**Contract:** By the time the player lands at `/game/CODE?_t=JWT`, `PLAYER_JOINED` has fired and the L2 roster contains them.

---

## Design

### 1. Frictionless `/j/CODE` route

New Next.js route at `apps/lobby/app/j/[code]/page.tsx` with a co-located server action `claimSeat()` in `apps/lobby/app/j/[code]/actions.ts`.

**Middleware behavior — no exemption needed.** Next.js middleware uses an **inclusion matcher** (`middleware.ts:27`), which currently lists `/`, `/join/:path*`, `/game/:path*`, `/admin/:path*`, `/playtest`, `/playtest/share/:path*`, `/share/:path*`. To make `/j/*` unauth-safe, simply **don't add it to the matcher**. No exemption mechanism exists; the matcher is the protection boundary.

**Route behavior:**
1. Look up game by `invite_code`. If not found → 404 page.
2. If `GameSessions.status NOT IN ('RECRUITING', 'READY')` → render stale-link screen (mockup frame 2). No wizard entry.
3. If caller has `po_session` AND is already a player (`Invites.accepted_by = session.userId`) → redirect to `/play/CODE`.
4. Otherwise → render welcome form (mockup frame 3): single field "What should we call you?" + submit.

**`claimSeat` server action:**
1. If `po_session` exists → reuse session's `userId`. Else create new `Users` row with `email = NULL`, `contact_handle = trimmed name`, then create a fresh session via `createSession()` in `lib/auth.ts`.
2. Set `po_session` cookie.
3. Redirect to `/join/CODE` (existing persona wizard).

**Name validation:** 1-24 chars, trimmed; strip zero-width/control chars. No uniqueness — multiple "Alex"s are fine; host curates identity at game end (mockup frame 5).

**Rate limit:** IP-based throttle on `claimSeat` (e.g., 10 new-user creates per IP per hour) to prevent anonymous-user spam. Start generous; tighten if abused.

### 2. Schema migration + nullable-email type audit

New migration `apps/lobby/migrations/0015_contact_handle_nullable_email.sql`:
- Add `Users.contact_handle TEXT`
- Drop `NOT NULL` constraint on `Users.email` (SQLite requires the 12-step table-recreation pattern — standard)

**`UNIQUE` + `NULL` safety:** `Users.email` has `UNIQUE` per `migrations/0001_initial.sql:4`. SQLite allows multiple NULLs under `UNIQUE`, so the constraint survives unchanged — multiple `/j/*` users coexist without collision.

**Backfill:** `contact_handle = split_part(email, '@', 1)` where `email IS NOT NULL` (or equivalent SQLite expression via `substr`/`instr`) so existing users' display names remain sensible.

**Nullable-email type audit (explicit spec item, not a generic risk):**
- `apps/lobby/lib/auth.ts:51,72,78` types `Session.email` as `string`. Change to `string | null`.
- Grep every `.email` access in `apps/lobby/` (the interface `Session`, plus direct `user.email` reads). Each site must handle `null`.
- Known affected paths: `/invite/[token]` route, login UI, `getAuthStatus()`, admin views that display user identity.
- Work committed to the same PR as the migration — not a scattered follow-up.

**PII:** `contact_handle` is low-sensitivity user-typed text. Does NOT need `PII_ENCRYPTION_KEY` treatment applied to `email_encrypted`/`phone_encrypted`.

### 3. Wizard commit-early + confirm-is-read-only

Current flow: `/join/CODE` wizard = persona draw → bio → Q&A → Confirm → `acceptInvite` fires (`/join/[code]/page.tsx:167`).

New flow: `acceptInvite` fires when Q&A is submitted (end of step 3). **Step 4 becomes a read-only review with auto-redirect** — no back nav, no "change your mind" escape. Tradeoff accepted: eliminates the setup-loss trap for the scenario-3 window.

**Server-side idempotency (answers review concern #2):**
- `acceptInvite` idempotent only for the *same submission* — if called again with identical `(userId, gameId)` AND identical `(personaId, bio, qaAnswers)`, return `{ success: true, alreadyJoined: true }`.
- Different persona/bio on re-submit: NOT supported. The wizard is locked after step 3; if somehow the client sends a different submission, return the existing "You have already joined this game" error. This preserves the current defense against mid-wizard persona swap.

**Client-side:**
- Call `acceptInvite` on step-3 submit.
- Step 4 renders a read-only "you're in" summary + countdown → auto-redirects to `/play/CODE`.
- Disable back navigation at step 4 (`router.push` not `router.replace` on step 3→4 transition; block beforeunload if pending).
- Bigger "locking your choice" callout on step 3's submit button so users understand this is commit time.

**Scope honesty:** this MITIGATES scenario-3 by shrinking the window from "~30-60s of Q&A + confirm review" to "~5s at Q&A submit." The 409 cleanup at `actions.ts:617-628` stays intact as correct behavior for true late-joiners.

### 4. Auto-redirect after wizard

After `acceptInvite` success (step 3 commit OR step 4 countdown), redirect to `/play/CODE`, which mints a JWT and redirects to `/game/CODE?_t=JWT`.

**Exception:** host of STATIC/non-CC games still needs the "Launch Game" button. For non-CC modes, redirect host to `/game/CODE/waiting`. CC hosts go straight to client.

**Waiting room stays navigable:** `/game/CODE/waiting` remains a valid URL for deep links, bookmarks, PWA `start_url` recovery. Just no longer a mandatory stop in the happy path.

### 5. Waiting-room invite form ungating

At `apps/lobby/app/game/[id]/waiting/page.tsx:301`, the entire invite section is gated on `isHost`. Split the gate:
- **Form + email input + Send button + toasts:** visible to all participants.
- **Sent-invites list (emails + status) at lines 364-381:** `isHost` only. Protects non-hosts from seeing other participants' email addresses (privacy, matches anonymous-game spirit).

Server-side `sendEmailInvite` already permits any participant per ADR-073 — UI-only change.

### 6. Super-admin `/admin/create-debug`

New page `apps/lobby/app/admin/create-debug/page.tsx` + `createDebugGame()` server action in `apps/lobby/app/admin/create-debug/actions.ts`. Gated by the existing `AdminLayout` (redirects to `/` if not super-admin).

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

**Env scoping:** Admin page creates games only on the current lobby environment. Designer wants a staging game → open staging admin. Cross-env creation handled by the `/create-game` CLI (designed to be cross-env).

**`createDebugGame(config)` action:**
1. Call existing `createGame()` — real lobby path, real `GameSessions` + real `Invites` rows where applicable.
2. If `mintMagicLinks`: for each slot, sign a JWT via `signGameToken()`; return per-slot tokens.
3. Return `{ gameId, inviteCode, shareUrl: '/j/CODE', magicLinks: { p1, p2, ... } | null, adminUrl, stateUrl }`.

**Output screen:**
- Invite code + copy
- `/j/CODE` share URL + copy + native share sheet
- Per-slot magic link list with copy buttons (when minted)
- Admin console link (`/admin/game/[gameId]`)
- "Enter as p1" self-test link

**Deprecations — delete, don't preserve:**
- `DEBUG_OVERRIDE (Manual)` option at `apps/lobby/app/page.tsx:647`
- "Skip invites" toggle (`page.tsx:1100-1117`) + `handleDebugStart` handler (`:531-556`)
- `startDebugGame()` in `actions.ts:823-919`
- `DEBUG_PECKING_ORDER` enum value — deleted entirely. Any legacy D1 rows with `mode = 'DEBUG_PECKING_ORDER'` still render (read-only history); no new creation path uses the enum.

### 7. Email-on-flip + status-flip completion

**Trigger:** L2 `preGame → dayLoop` (DYNAMIC) or `startGame()` (STATIC).

**DYNAMIC mechanism:**
1. L2's `dayLoop` state entry action emits `INTERNAL.GAME_STARTED { gameCode }`.
2. L1 already subscribes to L2 snapshots (inspector bridge per ADR-084); on observing this event, L1 HTTP-POSTs to lobby `POST /api/game-started` with `{ gameCode, startedAt }`.
3. Endpoint auth: `Authorization: Bearer $AUTH_SECRET` (reuses the existing L1↔lobby shared secret — see `actions.ts:611`). **No new `LOBBY_CLI_SECRET` — one secret for all server-to-lobby traffic.**
4. Endpoint is **idempotent at the endpoint level**: wraps everything in a `status !== 'STARTED'` guard. Second call is a no-op.

**Lobby endpoint behavior:**
1. If `status === 'STARTED'` already → 200 no-op.
2. Otherwise, flip `GameSessions.status = 'STARTED'`.
3. Query participants with `email_encrypted IS NOT NULL`. Decrypt. Send "Your game just started" Resend email with a one-click `/play/CODE` link.

**Status-flip completion (was a follow-up, now in-spec per review concern #10):**

Once §7 flips status on `preGame → dayLoop`, the `status !== 'STARTED'` gates in `/play/[code]/route.ts:43` and `/api/refresh-token/[code]/route.ts:67` start **correctly** gating CC games. They become load-bearing again, not latently-dead code. This closes the ADR-067/118/086 triangle.

**In-flight token survival (verified against `packages/auth/src/index.ts`):** `verifyGameToken` does signature + expiry only. No D1 lookup. No status check. In-flight JWTs survive the status flip. Clients mid-session do not need to refresh.

**STATIC:** `startGame()` already flips status in `actions.ts:798`. Add the email-send loop to that path; same endpoint-idempotency guard applies so a concurrent `/api/game-started` call from L1 (if STATIC ever goes through `preGame → dayLoop`) is a no-op.

### 8. `/create-game` script rewrite

Current: `scripts/tmp-create-game.js` POSTs directly to game-server `/init`. New: calls lobby `POST /api/admin/create-debug` with `Authorization: Bearer $AUTH_SECRET` — same secret everywhere (reuses L1↔lobby + CLI↔lobby shared trust; one secret to rotate).

**CLI endpoint** `POST /api/admin/create-debug`:
- Auth: `Authorization: Bearer $AUTH_SECRET`
- Body: same config shape as `createDebugGame()` action
- Calls the action; returns same output shape.

**Script output unchanged:** still writes `/tmp/pecking-order-test-game.json`, still prints magic links per slot. `/create-game` slash-command contract preserved.

**Env target `local|staging`:** CLI flag stays. Lobby URL + `AUTH_SECRET` differ per env; shape is identical.

---

## Data model changes

- **New:** `Users.contact_handle TEXT` (nullable, user-typed)
- **Changed:** `Users.email TEXT` — `NOT NULL` dropped, `UNIQUE` preserved (SQLite multi-NULL under UNIQUE is safe)
- **Migration:** `apps/lobby/migrations/0015_contact_handle_nullable_email.sql`
- **Type change:** `Session.email: string | null` in `apps/lobby/lib/auth.ts` + consumer audit across `apps/lobby/`

---

## New routes / endpoints

- `GET /j/[code]` — unauth-safe welcome page (NOT in middleware matcher)
- `claimSeat()` server action co-located with the page
- `GET /admin/create-debug` — super-admin page
- `POST /api/admin/create-debug` — CLI-facing, `Authorization: Bearer $AUTH_SECRET`
- `POST /api/game-started` — L1→lobby callback, `Authorization: Bearer $AUTH_SECRET`, idempotent

---

## Deleted

- `startDebugGame()` in `apps/lobby/app/actions.ts:823-919`
- `DEBUG_OVERRIDE (Manual)` option at `apps/lobby/app/page.tsx:647`
- "Skip invites" toggle + `handleDebugStart` handler (`page.tsx:1100-1117`, `:531-556`)
- `DEBUG_PECKING_ORDER` enum value (delete entirely; legacy rows render read-only)
- `scripts/tmp-create-game.js` — rewritten (see §8), not deleted from disk

---

## Regression checklist

- Existing `/invite/[token]` email flow works unchanged
- `/play/[code]` redirect still works for RECRUITING → STARTED transition (after §7)
- `/api/my-active-game` still returns `RECRUITING + READY + STARTED` games
- `sendGameEntryPush` still fires when STARTED
- `/admin`, `/admin/inspector`, `/admin/game/[id]` still work
- E2E Playwright tests pass after waiting-room auto-redirect change
- Lobby E2E tests updated for `/j/CODE` flow
- `sendEmailInvite` still works for any participant (UI ungating only)
- Host still launches STATIC games via "Launch Game" button
- Nullable-email audit finds and fixes every broken `.email` access path
- Legacy D1 rows with `mode = 'DEBUG_PECKING_ORDER'` render without crash

---

## Test plan

**Unit / component:**
- `/j/[code]`: RECRUITING → welcome; non-RECRUITING → stale-link; already-joined → redirect
- `claimSeat`: creates user with NULL email; sets `po_session`
- `acceptInvite` idempotency: identical submission returns `alreadyJoined: true`; different persona/bio returns error
- Waiting room: non-host sees form but not sent-invites list
- `Session.email: null` handled at every read site (type checks catch most; runtime tests for logic that branches on presence)

**Integration:**
- L2 `preGame → dayLoop` emits `INTERNAL.GAME_STARTED`
- L1 observes and posts to `/api/game-started`
- Repeated posts are idempotent (status guard)
- In-flight JWT decodes + verifies post-flip

**E2E (Playwright):**
- Full frictionless flow: new user hits `/j/CODE` → types name → persona wizard → lands in client
- Commit-early: kill tab between step-3 submit and step-4 render; verify player is in L2 roster via `/state`
- Scenario-3 trap: verify the window now only exists around Q&A submit, not around confirm tap

**Manual checklist:**
- Create debug game via `/admin/create-debug` → open `/j/CODE` in incognito → full flow → in-game
- Designer flow: share `/j/CODE` → recipient lands without signup bounce → persona wizard → in-game
- Legacy `mode='DEBUG_PECKING_ORDER'` row renders in `/admin` without crash

---

## Risks

- **Middleware matcher edit** — add `/j/*` must NOT match (it's unauth). Verify with an actual request before merging. Matcher globs can be subtle.
- **Nullable-email type audit** is spec-committed but needs grep discipline. Missing a consumer site silently runtimes-breaks for `/j/*` users. TypeScript strict-null checks will catch most.
- **Wizard commit-early** loses the "change my mind" escape between Q&A and confirm. If users complain, mitigation is a bigger locking callout on step 3, not revert.
- **Rate-limiting `claimSeat`** — easy to over-restrict. Start at 10/hr/IP, tighten only if abused.
- **Status-flip side effects** — JWTs survive (verified). No current D1 triggers on status change. Any future additions must be audited.
- **L1 state subscription** — L1 already observes L2 snapshots; `INTERNAL.GAME_STARTED` event adds an observable edge case to the existing stream. Verify L1's inspector bridge handles it without contention.

---

## Implementation phases (sequencing)

Sized for independent PRs / review gates:

**Phase 1 — Foundation** (~1-2 days)
- §5 Waiting-room invite form un-gate (UI-only)
- §8 `/create-game` script rewrite + new `/api/admin/create-debug` endpoint (no deprecations yet)

**Phase 2 — Frictionless + admin** (~3-5 days — migration is the careful part)
- §2 Schema migration + nullable-email type audit
- §1 `/j/[code]` route + `claimSeat`
- §6 `/admin/create-debug` page + `createDebugGame()` action
- Deprecations (DEBUG_OVERRIDE, startDebugGame, enum)

**Phase 3 — Trap mitigation** (~3-5 days — L2/L3 touches)
- §3 Wizard commit-early + confirm-read-only
- §4 Auto-redirect after wizard
- §7 `INTERNAL.GAME_STARTED` L2 action + L1 callback + `/api/game-started` endpoint + email send + status-flip completion

Phases are independently revertable. Phase 3 does not depend on Phase 2, but sequencing reduces total surface at any given merge point.
