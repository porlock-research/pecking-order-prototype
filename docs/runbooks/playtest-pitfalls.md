# Playtest Pitfalls — Lessons from 2026-04-22/23 Staging Run

> Read before any future staging playtest. Each section names a real gap that
> bit us live and the workaround / fix that exists today (or doesn't).

This is the post-mortem from the demo-prep session on `fix/create-game-flow`
that pushed a 13-commit fix branch then ran a real staging playtest. The
fixes themselves landed; the gaps below are the *next-layer* problems that
only became visible once we exercised the deployed branch end-to-end.

---

## 1. Confession phase is not first-class in the admin UI

**What:** `START_CONFESSION_CHAT` does not appear in `currentDay.timeline`
for any game type. The admin TimelineTab's "Fire Now" buttons only render
events that exist in `state.manifest.days[currentDay].timeline`, so there
was zero UI path to fire confession on a live game.

**Why this is the way it is:** Confession is a **parallel L3 state**, not a
serial day phase. Adding it to `generateDayTimeline()` (the obvious-looking
fix) would force a scheduled fire-time per preset and could pre-empt the
admin's intent to drop it manually. Per ADR direction, confession is
admin-triggered, not scheduled.

**Fix shipped:** `apps/lobby/app/admin/games/[id]/_tabs/OverviewTab.tsx` now
has a **Start Confession** button in Global Controls (next to NEXT_STAGE /
Flush Alarms). Fires `INJECT_TIMELINE_EVENT` with `action: 'START_CONFESSION_CHAT'`.
L2 already gates on `ruleset.confessions.enabled` — safe no-op when off.

**Future risk:** Same pattern likely applies to any other "parallel layer"
events (whisper phases, DM-mode toggles, etc.). If a fact has no scheduled
template entry, the admin needs an explicit button. **Add inject buttons
proactively when you build new parallel-layer features.**

---

## 2. Day timeline is generated ONCE per day; code changes are not retroactive

**What:** `morningBriefing.entry` runs `sendAndCaptureGameMasterDay` which
appends the resolved day to `manifest.days[]` *if `dayIndex` doesn't already
exist*. Once Day N is resolved, no code change to `generateDayTimeline()`
will retroactively update Day N's timeline.

**Where:** `apps/game-server/src/machines/actions/l2-day-resolution.ts:24,87`
(the `alreadyExists` short-circuit).

**Practical implication:**
- Deploy a timeline template change → only **next day onward** picks it up
- For an in-flight game's current day → you need a runtime override (admin
  inject) or to wait for the next day transition
- For all NEW games created post-deploy → fine, picks up on Day 1

**Workaround if you need it now:** admin button (#1 above) for the specific
event, or curl `INJECT_TIMELINE_EVENT` directly.

**Open architectural question:** A "re-resolve current day" admin button
would let timeline-template fixes apply to in-flight games. Not built yet;
flag if it becomes recurring.

---

## 3. Chat-stream narrator lines are bad UX for active phase state

**What:** The original "The confession booth is open." narrator was emitted
via `factToTicker(CONFESSION_PHASE_STARTED)` and rendered through
`NarratorLine` in chat. Two real problems:

1. **Gets buried** as soon as anyone sends a message after — players who
   land cold (async game, opening hours later) had to scroll back to find it.
2. **Persists past phase close** — once `confessionPhase.active` flipped back
   to false, the narrator line stayed in chat history. Tappable link said
   "live" but routed to a closed booth. Misleading.

**Fix shipped:** Removed the narrator entirely (`factToTicker` returns null
for `CONFESSION_PHASE_STARTED`). Pulse `ConfessionPhaseBanner` (sticky strip
below header) is now the sole "booth open" surface — visible for the
duration of the phase, hides automatically when `active=false`.

**Pattern to apply:** Any "this is happening RIGHT NOW" state belongs in
**persistent chrome** (banner, header badge, sticky strip), not in the chat
stream. Chat is for *events that happened*, not for *state that is active*.
The chat-stream narrator pattern is fine for "Alice started talking to
someone" (an event); it is not fine for "voting is open" (a state).

---

## 4. PWA service worker caches old bundles on deploy

**What:** Successful staging deploy ≠ users see new code on next page load.
`vite-plugin-pwa` with `autoUpdate` strategy needs the SW update cycle to
fire, which can take a refresh or two — or a hard refresh (Cmd+Shift+R) to
bypass SW cache entirely.

**Symptom we hit:** Pushed the confession banner commit, CI green, deploy
done. User: "I don't see the change in the live game." Banner code WAS
deployed; SW was serving the old bundle. Hard refresh fixed it.

**Pre-playtest checklist:** Before the playtest starts, on EACH device that
will be in the demo:
1. Hard refresh (Cmd+Shift+R or device-equivalent)
2. Or: DevTools → Application → Service Workers → "Update on reload" → reload
3. Confirm new code is active before going live

---

## 5. `/state` is L2 only — confession state lives in L3

**What:** `GET /parties/game-server/<id>/state` returns L2 context only
(state value, dayIndex, manifest, roster). Confession state, channels,
chatLog, day phase all live in L3 under `snapshot.children['l3-session']`.

**Already documented** in `apps/game-server/CLAUDE.md` and surfaced as a
guardrail. Re-flagging because we hit it during this session's debugging:
"the booth is open per /state" was wrong — /state can't see L3.

**Diagnostic for L3 state:** WebSocket SYNC payload, or `INSPECT.SUBSCRIBE`
admin event. Don't bet on /state for anything below L2.

---

## 6. `confessionPhase.active` is per-recipient projection (T12)

**What:** Even when admin fires `START_CONFESSION_CHAT` and L2 transitions
correctly, an individual player's client may not see `confessionPhase.active
= true` because the projection is per-recipient and **T12 of Spec C Plan 1**
was the next item to ship per the project memory.

**Symptom:** Admin button fires, confession booth opens for SOME players but
not others; banner doesn't render for the players who didn't get the
projection.

**Pre-playtest verify:** For each player who needs to see confession, confirm
the projection is reaching their client:
```js
// In Pulse client devtools console (after exposing __pulseStore):
useGameStore.getState().confessionPhase
// Expect: { active: true, myHandle: 'Confessor #N', ... }
```

If half the cast sees the banner and half doesn't, projection ships are
the suspect, not the banner code.

---

## 7. CC games auto-start — there is no "Start Game" button

**What:** All CONFIGURABLE_CYCLE game variants auto-start without a host tap:
- **DYNAMIC + PRE_SCHEDULED**: alarm fires at `manifest.startTime`
- **STATIC + PRE_SCHEDULED**: alarms fire at each timeline event
- **DYNAMIC + ADMIN**: admin uses `NEXT_STAGE` from admin panel

**Footgun we shipped + reverted in this session:** Adding a host-facing
"Start Game" button to `/game/<id>/waiting` would pre-empt the alarm if
clicked on a DYNAMIC PRE_SCHEDULED game. Reverted before merge.

**Rule:** Don't add manual-start UI to CC games. If a host needs to
"start now" early, they use admin NEXT_STAGE.

---

## 8. Server actions returning everyone's tokens is a host-impersonation footgun

**What:** A server action that returns `tokens: Record<playerId, jwt>` for
all accepted players gets used by the client like:
```ts
const myPlayerId = tokens ? Object.keys(tokens)[0] : null;
```

If the host hasn't self-joined, `Object.keys(tokens)[0]` returns p1 (lowest
slot index) — and the host enters the client *impersonating p1*.

**Caught in code review.** Fix: server action should mint and return ONLY
the caller's token (looked up by `session.userId`). Other players fetch
their own via `/api/refresh-token/[code]` when they navigate to /play/CODE.

**Rule:** Never broadcast other players' tokens through a server action.
One token per request, scoped to the caller.

---

## 9. Sentry auto-instruments fetch 4xx as errors

**What:** Lobby endpoints returning `401` for unauth or `400` for
"game-not-started" got logged as errors by Sentry's fetch instrumentation,
drowning the staging dashboard. None were actual server bugs — all were
benign "no token available right now" states.

**Fix shipped:** `/api/refresh-token/[code]` and `/api/my-active-game`
return `200 + {token:null|games:[], reason: 'unauthenticated'|'no_invite'|...}`
for every benign no-token state. Client checks the `reason` field and
treats it identically to a 4xx (no behavior change), but Sentry stays clean.

**Rule for new lobby endpoints:** Default to 200 + null/empty body for
"the user just doesn't have access right now" states. Reserve 4xx for
genuine errors (404 for not-found, 500 for actual server problems).

---

## 10. WebSocket reconnect storms — server now caps at 4008 after 4 rejects

**What:** PO playtest 2026-04-21 showed 30+ WS reject events for the same
playerId over 3 minutes. `useGameEngine.ts onClose` already redirects on
4001/4003 (ADR-088/089) but the redirect didn't fire reliably from a
backgrounded PWA whose pathname no longer matched `/game/CODE`.

**Fix shipped:** `apps/game-server/src/ws-handlers.ts` keeps a per-token
reject cache. After 4 rejects in 30s, closes with code **4008** (permanent
— "stop reconnecting"). Client honors 4008 with `?noRecover=1&reason=rejected`.

**Local dev caveat:** workerd dev recycles the worker isolate aggressively,
so the cache wipes mid-burst — local tests show 4003-4003-4003-4008 cycles.
Production DOs stay warm; the cache works as designed there.

---

## 11. Pulse must be the default shell

**What:** `getActiveShellId()` used to fall back to `'vivid'` when no
`po_shell` was set in localStorage. Existing users with a stale `po_shell`
value (vivid/classic/immersive) kept landing on those shells.

**Fix shipped:** `apps/client/src/shells/pulse/registry.ts` —
`getActiveShellId()` is now hardcoded to return `'pulse'`, ignoring any
stored preference. ShellPicker writes still go to localStorage so a future
relax-back is one line.

**Rule:** If you're running a playtest, **verify on a fresh browser session
that Pulse loads**, not just your own tab where you've manually picked it.

---

## 12. `/j/[code]` welcome page has no session-aware state

**What:** The frictionless welcome page renders the same form regardless of
whether the visiting user has already joined the game. Reload mid-wizard
or after completing the wizard → still sees "What should we call you?"
with empty handle field.

**Why:** `page.tsx` is a server component that just renders welcome unless
the user submits the form. The "alreadyJoined → /play/CODE" redirect lives
in the `claimSeat` server action, not in the GET path.

**Not blocking the demo**, but real UX gap. Future fix: make `page.tsx`
session-aware — pre-fill handle if known, or redirect to /play directly
if `alreadyJoined`.

---

## 13. Manifest is frozen at game-create time for pre-existing games

**Per existing memory** `feedback_manifest_freeze_on_create.md`, but worth
re-stating: a code change to `buildManifestDays` / `resolveDay` only
affects games CREATED after the deploy. In-flight games keep the manifest
they were created with.

**Implication for playtest fixes:** Any change that touches manifest shape,
ruleset defaults, or day resolution → create a FRESH game on staging to
verify, don't reuse an existing in-flight game.

---

## 14. Local D1 can be missing migrations

**What:** Hit a `D1_ERROR: no such column: u.contact_handle` 500 during
smoke test. Local `pecking-order-lobby-db-local` was missing migration 0015
(plus 0016). Production/staging had them; local fell behind.

**Pre-session checklist for local dev:**
```bash
cd apps/lobby
ls migrations/  # newest file
npx wrangler d1 execute pecking-order-lobby-db-local --local --command "PRAGMA table_info(Users)" | grep contact_handle
# If missing: apply latest migrations
npx wrangler d1 execute pecking-order-lobby-db-local --local --file=migrations/0015_*.sql
npx wrangler d1 execute pecking-order-lobby-db-local --local --file=migrations/0016_*.sql
```

Same applies to `pecking-order-journal-db-local` for game-server changes.

---

## 15. `next dev` + `next build` on the same `.next` corrupts the cache

**What:** Running `npm run build` in `apps/lobby` while `next dev` is also
running on the same `apps/lobby/.next` directory corrupts the cache:
```
Error: ENOENT: no such file or directory, open '.next/routes-manifest.json'
Error: Cannot find module './784.js'
```
All routes return 500 until cache is cleared.

**Fix:** `rm -rf apps/lobby/.next` then restart turbo from repo root
(`npm run dev`). Killing only `next dev` doesn't bring it back — turbo
won't restart child processes; you need to kill the whole turbo session.

**Rule:** If you need to verify a production build, do it in a separate
worktree or after stopping `next dev`. Don't share a `.next` between dev
and prod runs.

---

## 16. Dev server worktree contamination (recurring)

**Per existing memory** `feedback_dev_server_worktree.md`. Hit again this
session: dev servers were running from `.worktrees/pulse-eliminated-cast/`
while we were editing in main repo. Code changes invisible to the browser
until we killed the stale turbo and restarted from main.

**Verify before debugging "code changes don't take effect":**
```bash
lsof -i :3000 :5173 :8787 | grep LISTEN
lsof -p <pid> | grep cwd
# cwd MUST be the directory you're editing in
```

---

## 17. ADR-145 fixed the L2-wedge-from-missing-schedulePreset class

**Already fixed** but worth knowing the diagnostic signal:

If a `START_CONFESSION_CHAT` (or any) inject returns OK but L2 silently
no-ops the transition, subscribe `INSPECT.SUBSCRIBE` and look for
`xstate.error.actor.game-master`. If present, the GM crashed (most
historical cause: missing `schedulePreset`). ADR-145 added Zod safeParse
on `/init` + DEFAULT preset default + L2 onError handler — should make
this class unreachable for games created post-2026-04-21.

---

## Pre-Playtest Checklist (consolidated)

**T-30 minutes:**
- [ ] Branch with all fixes is on `origin/main` (or staging deploys from your branch). Confirm via `git log origin/main`.
- [ ] CI for the latest commit is green (all 4 deploys: lobby / game-server / client / sentry-tunnel).
- [ ] Local D1s have latest migrations applied (#14)
- [ ] Local dev servers are running from main repo, not a worktree (#16)
- [ ] If you ran `npm run build` recently, clear stale `.next` (#15)
- [ ] Hard-refresh the staging URL on every device that will be in the demo (#4)
- [ ] Verify Pulse loads on a fresh browser session, not just your tab (#11)
- [ ] Pre-warm staging Workers: `curl -s https://staging-api.peckingorder.ca/parties/game-server/warmup/state | head`
- [ ] Open Sentry + Axiom dashboards for live monitoring

**During playtest:**
- [ ] Need to fire confession? → admin Overview "Start Confession" button (#1)
- [ ] Banner doesn't appear for some players? → check `confessionPhase.active` per-recipient (#6)
- [ ] WS rejects spamming? → server now caps at 4008 (#10), client redirects automatically
- [ ] Anything in chat looking stale ("the booth is open" for a closed phase)? → known issue, ignore (#3 — was fixed but pre-deploy chat history still shows it)

**Post-playtest:**
- [ ] Capture session-replay links from Sentry for any errors
- [ ] Note any NEW gaps in `.remember/today-*.md` for next session
- [ ] If a recurring symptom hits: add a guardrail rule in `.claude/guardrails/` (root repo only)

---

## Architectural notes for future contributors

- **Parallel L3 states (confession, etc.) are admin-triggered, not scheduled.**
  Don't bake them into `generateDayTimeline()` templates.
- **Day timelines are immutable post-resolution.** Code changes to template
  generation only affect future days / future games.
- **Per-recipient projections (T12 confessions, future similar)** must be
  the source of truth for client state — chat-stream narrators are
  events-not-states and should not be the only signal.
- **Persistent chrome (banner, sticky strip) > chat-stream narrator** for
  "this is happening right now" UI.
- **Server actions: one token per request, scoped to caller** — never
  broadcast other players' tokens (#8).
- **Lobby endpoints: 200 + null for benign no-data states** — reserve 4xx
  for true errors so Sentry stays signal-rich.
