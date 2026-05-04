# Player Intro — Pregame Onboarding + Cast Intro Overlay

**Date:** 2026-05-03
**Status:** Draft — awaiting user approval
**Author:** Manu + Claude
**Related:**
- `docs/reports/playtest-SBCSJT-engagement.md` — playtest data driving this spec (2/6 played Day 1; "didn't know what to do" was the dominant signal)
- `docs/reports/pulse-mockups/24-pregame-features-tabbed.html` — interactive mockup (canonical visual reference; do not read 16–23)
- `apps/client/src/shells/pulse/CLAUDE.md` — Pulse shell conventions
- `apps/client/src/shells/pulse/components/chat/PregameRevealCard.tsx` — existing magazine treatment we extend, not replace
- `apps/client/src/shells/pulse/components/pregame/PregameDossierSheet.tsx` — chip-tap dossier; complementary surface
- `apps/game-server/src/machines/l3-pregame.ts` — emits `PREGAME_PLAYER_JOINED` and (on first connect) `PREGAME_REVEAL_ANSWER` facts
- `memory/project_pregame_reveals_accumulate.md` — reveals are one-per-player-join, never pre-rendered
- `spec/PECKING ORDER.md` — host voice + "8 strangers" framing
- Feature 2 (Pregame Duels) — separate spec, deferred until this lands and engagement is validated

## Why

Last playtest (game `SBCSJT`, 6 players, 2026-05-02) had two clear engagement failures. This spec addresses one of them.

1. **Players didn't know how the game works.** Multiple players opened the app, saw a chat surface with no apparent goal, and never returned. The pregame Cast Strip and dossier are passive — you have to tap a chip to learn anything. Nothing on first mount tells the new player: "you are catfishing as Felix; here is how a day works; here is what silver and gold are."
2. **The room felt empty before Day 1.** *(Out of scope for this spec — addressed by Pregame Duels.)*

This spec proposes **Player Intro**: two distinct client surfaces that share one server trigger.

- **Joining-player onboarding** — a 5-step welcome the new player sees on their first connect. Reveals their fake persona, frames the catfish premise in the host's voice, walks the daily rhythm, explains silver vs gold, and ends with the cast they're walking into.
- **Cast intro overlay** — a full-screen dramatic arrival the rest of the room sees when a new player lands. Hero portrait, name reveal, the player's pre-game answer rendered as a pull-quote, "tap to continue."

Both surfaces ride on existing facts (`PREGAME_PLAYER_JOINED` + `PREGAME_REVEAL_ANSWER`). **No server work.**

## Guiding principles

- **Two audiences, one trigger.** The same fact stream lights up two surfaces. Don't conflate them in code (separate components, separate gating) but treat them as one feature for product framing.
- **Host voice is load-bearing.** Onboarding copy is the reality-TV-show host from `spec/PECKING ORDER.md`: confident, conspiratorial, slightly amused at the players. "I've put eight strangers in a room. Everyone's wearing a mask." Don't water it down for clarity — the catfish framing IS the clarity.
- **The arrival is dramatic by intent.** Cast intro overlays interrupt chat for the moment of arrival, then dismiss. This is the same beat as `PregameRevealCard` (existing) but at hero scale — not a duplicate, an amplification. The chat card remains the persistent record; the overlay is the moment.
- **Once per game per player.** Onboarding fires once. Reconnects don't replay it. Gating uses `(gameId, playerId)`-namespaced localStorage per Pulse convention.
- **Catch-up doesn't fire overlays.** A player who joins late and receives 4 prior reveals via SYNC tickerHistory must not see 4 cast intro overlays in sequence — those moments already happened.
- **Don't regress the chat reveal.** `PregameRevealCard` ("ON THE RECORD") stays exactly as it is. Reveals still accumulate one-per-arrival in chat. The overlay is a NEW additive surface, not a replacement.
- **Skip means skip.** The Skip control closes onboarding and persists the seen flag. It does NOT jump to the last panel — that pattern in the mockup is iteration scaffolding for product review, not the shipping behavior.

## Scope boundaries

**In scope:**
- 5-panel joining-player onboarding (mounts as Pulse-z `modal` overlay over the shell).
- Cast intro overlay (full-screen, separate component, mounts in Pulse z `reveal`).
- Once-per-game-per-player gating via localStorage (two flags: intro-seen, per-player overlay-seen map).
- Self-suppression for the cast intro overlay (joining player doesn't see their own arrival; their experience is the onboarding).
- Queue strategy for overlapping arrivals (single overlay at a time; new arrivals queue behind; on dismiss, next overlay shows).
- One new memory entry for cross-session continuity.
- Vitest unit tests for gating logic + queue.
- One Playwright e2e for the joining-player happy path.

**Out of scope:**
- Server work. No new facts, no new ticker categories, no new push triggers, no schema migrations.
- Pregame Duels (Feature 2). Separate spec, deferred.
- Animation polish beyond Pulse's existing `PULSE_SPRING` recipes — we use `pop` for panel entry, `page` for full-screen overlay slide, `gentle` for cross-fade between panels.
- Onboarding for non-Pulse shells. Classic / Immersive / Vivid keep their current behavior (this is a Pulse-only feature; other shells already have their own pregame treatments).
- Localization / i18n — copy ships in English only.
- Onboarding analytics events. Add later if engagement metrics need it.
- **Returning-player re-orientation (Day 2+)** — a returning player after a 24h gap, after elimination, or to a finished game has different orientation needs than a first-timer. Addressed in a separate spec; flagged here so it's not lost. (Added 2026-05-04 per harden audit.)

## Architecture

### Data sources (all existing)

- **`useGameStore.pregame.revealedAnswers`** — `Record<playerId, { qIndex, question, answer, revealedAt }>`. Populated from SYNC's `context.pregame` slice while phase === `PREGAME`. Server emits the entry from `l3-pregame.ts` on each player's first WebSocket connect via `SYSTEM.PLAYER_CONNECTED` (idempotent via `firstConnectedAt` flag).
- **`useGameStore.roster`** — full persona data including `personaName`, `bio`, `avatarUrl`, `qaAnswers`. Server-projected for self (full QA visible) and obscured for others (sealed answers default to empty `answer` strings).
- **`useGameStore.manifest`** — provides `startTime` (Day 1 begins) for the day-rhythm panel's "the clock starts at X" copy.
- **`useGameStore.phase`** — pregame phase gate (`DayPhases.PREGAME`).
- **`useGameStore.playerId`** — local player identity.
- **`useGameStore.gameId`** — namespacing for localStorage keys.

The cast intro overlay listens to `pregame.revealedAnswers` for new entries. The joining-player onboarding reads its own persona data + manifest at mount time and doesn't need to subscribe to anything dynamic except the cast list (which updates as more players join while you're mid-onboarding — see Edge cases).

### Component layout

```
PulseShell
├── (existing surfaces unchanged — PulseHeader, CastStrip, PulseBar, ChatView, PulseInput, etc.)
├── PlayerIntroOverlay         ← NEW. Mounts when phase===PREGAME AND localStorage flag absent.
│                                Z: PULSE_Z.modal. Owns the 5-panel sequence + skip + step-in.
├── CastIntroOverlay           ← NEW. Subscribes to pregame.revealedAnswers via useCastIntroQueue
│                                hook; renders hero overlay when there's an unseen non-self reveal.
│                                Z: PULSE_Z.reveal (above modal so a late-arriving overlay can
│                                land while onboarding is open — but onboarding intercepts its
│                                own player's reveal first; see Self-suppression).
└── (other overlays — DmSheet, PregameDossierSheet, CartridgeOverlay — unchanged)
```

Both new components live in `apps/client/src/shells/pulse/components/pregame/` alongside `PregameDossierSheet.tsx`.

### Gating mechanism

**Joining-player onboarding** — fires when ALL of:
1. `phase === DayPhases.PREGAME`
2. `playerId` and `gameId` both populated (skip on first-render before SYNC hydrates)
3. `pregame.revealedAnswers[playerId]` exists (server has fired the auto-reveal — confirms our first-connect handler ran; defends against showing onboarding before the server has accepted us)
4. `localStorage.getItem('po-pulse-introSeen-${gameId}-${playerId}') !== 'true'`

On `Step in` or final `Skip`, set the flag and unmount.

**Cast intro overlay** — fires when ALL of:
1. `phase === DayPhases.PREGAME`
2. A reveal exists for `actorId !== playerId` that is NOT in `castIntroSeen` (per-(gameId, playerId) localStorage map of `actorId → true`)
3. The reveal's `revealedAt` is more recent than the local client's mount time minus a small grace (e.g., 5s) — distinguishes catch-up from live arrival

On first mount, the hook reads the current `pregame.revealedAnswers`, marks them all as seen WITHOUT showing overlays (catch-up suppression), then begins listening for new entries. New entries queue; one overlay at a time.

### Self-suppression

The joining player's own reveal triggers BOTH:
- their onboarding to mount (gating step 3 above)
- their cast intro overlay (no — see below)

The Cast Intro hook MUST skip `actorId === playerId` reveals entirely. Reason: the joining player is already inside their persona-reveal panel (panel 1 of onboarding). Rendering the overlay on top would double the reveal, defeat the onboarding's pacing, and feel weird ("I'm looking at myself"). The overlay is for THE ROOM, not the joiner.

This is a hard skip in the hook, not a gating side-effect — the local player's actorId is checked first.

### Queue strategy for the cast intro overlay

When two players join within seconds of each other, both reveals land in `pregame.revealedAnswers` ~at the same time. We queue:
- The hook maintains a FIFO queue of unseen non-self reveals.
- On dismiss (tap or auto-dismiss), pop the queue. If non-empty, the next overlay mounts.
- Each overlay uses `AnimatePresence` with `key={actorId}` so the cross-fade is clean.
- A short post-dismiss gap (~300ms) before the next overlay mounts so the chat (or onboarding) gets a moment of breath.

If the queue depth exceeds 3 (rare — would mean 4+ rapid arrivals), collapse: show the most recent only, mark the others as seen silently. The arrival drama for those players already lives in their PregameRevealCard chat entry.

### Auto-dismiss

Cast intro overlays auto-dismiss after a configurable timeout (proposed: 6 seconds — long enough to read the question + quote, short enough not to block conversation). Tap to dismiss earlier. The Skip button (top-right) dismisses + marks ALL pending queued overlays as seen so a player swarmed by reveals can opt out.

The onboarding does NOT auto-dismiss. It waits for the player.

## Joining-player onboarding (5 panels)

All panels share the chrome documented in the mockup: progress meta (`1 / 5`), skip control (top-right), 5-dot progress strip, panel body, fixed CTA bar (Back + Next, with last panel swapping Next → "Step in").

Panel content is data-driven where possible. Copy register is the host voice — first-person plural ("we"), confident, knowing. Never apologize, never hedge, never explain the game like a tutorial.

### Panel 1 — Persona reveal

**What it teaches:** "You're not yourself. You're catfishing as this person."

**Data:**
- `roster[playerId].personaName` (display name; "Felix Stage")
- `roster[playerId].avatarUrl` (full-bleed background; use `PersonaImage` component with `preferredVariant="full"`)
- `roster[playerId].bio` if present (rendered as the supporting tagline)
- A "stereotype" line — TBD, see Open questions Q3

**Treatment:** Full-bleed portrait, scrim from bottom, eyebrow "THE MASK" (gold tracked-caps), greeting "For the next seven days, you are", display-font name (last name in `--pulse-accent`), tagline below.

**Why this is panel 1:** The catfish premise is the most surprising and most foundational thing about the game. Lead with it. Players who weren't told before joining now know.

### Panel 2 — Pitch (catfish + clock)

**What it teaches:** "8 strangers, everyone's masked, vote each other out. Day 1 starts at X."

**Data:**
- Roster size: `Object.keys(roster).length` (drives "eight strangers" — see Open questions Q1)
- `manifest.startTime` formatted to local time + relative ("Day 1 starts at 5:00 PM today")

**Copy (verbatim):**
> "I've put eight strangers in a room. Everyone's wearing a mask."
> "Lie. Charm. Vote each other out. The last mask standing takes the gold."
> "Day 1 starts at 5:00 PM today. You have until then to feel out the room. After that, every day kills one of you."

The "I've put" voice is the host. Don't dilute it with "Players have been put" or other passive constructions.

**Why this is panel 2:** The mask premise from panel 1 needs scale. "Eight strangers" gives the social shape; "every day kills one of you" gives the stakes; the time anchor makes Day 1 real.

### Panel 3 — Day rhythm

**What it teaches:** "Days are clocked. Don't miss a beat."

**Data:** Hard-coded from `spec/PECKING ORDER.md` daily schedule. NOT pulled from the manifest — the schedule shape is consistent across `DEFAULT` preset (which is what shipping games use); other presets compress hours but the player-facing concepts (group chat → game → DMs all day → vote → elimination) stay the same. Keeping the panel hard-coded is simpler and matches the host's authoritative tone ("here's how a day goes" — not "here's how a day goes for THIS preset").

**Copy (table):**
| When | What |
| --- | --- |
| 9–10 am | Group chat opens. Make it count. |
| 10–12 pm | Daily game. Win silver, build the gold pool. |
| All day | DMs & whispers. *3 chats · 1200 chars* |
| 8–11 pm | The vote. Pick who walks tomorrow. |
| 12 am | Someone goes home. *Forever.* |

**Why this is panel 3:** Once they know they're catfishing, the question is "what do I do every day?" Answer it before silver/gold — those are abstract until they understand the rhythm.

### Panel 4 — Currencies (silver & gold)

**What it teaches:** "Silver is leverage. Gold is the trophy."

**Data:** Hard-coded copy. No dynamic values.

**Copy (verbatim):**
> **Silver** — Your social weight. Win it from games and quizzes. Send it. Spend it on powers. The poorest get cut at votes.
> **Gold** — The lifetime trophy. Builds in the prize pool all week. One winner walks out with it. Stays with you forever.
> Silver resets every game. **Gold is yours forever.**

**Why this is panel 4:** Once they know the rhythm, the question is "what am I playing for?" Two-tier currency is non-obvious; the "gold persists" framing is a hook that justifies why the game is worth seven days of your life.

### Panel 5 — Catch + cast + step in

**What it teaches:** "If two people guess your real name, you lose. Here are the people who'll try."

**Data:**
- The catfish-twist warning copy (hard-coded).
- `roster` filtered to non-self players who are already joined (`Object.keys(roster).filter(id => id !== playerId)`).
- For each, render their persona headshot + name in a 5-column grid. If fewer than 5 cast cards, the grid still uses 5 columns (empty cells stay open visually — implies "more coming").

**Copy:**
> "You're not Felix. They don't know that."
> "If two players guess your real name — you can't win."
> "Hide better than they hunt. Watch who's watching."

**CTA bar swap:** Last panel replaces `Next` with `Step in` — same visual weight, distinct copy.

**Why this is panel 5:** Mechanics covered. Now they need a face for who they're playing against. "Already in the room" turns abstract opponents into concrete people. The Step in CTA is the threshold — they're not entering a chat app, they're stepping into the room.

### Skip behavior

Skip control (top-right of every panel) closes onboarding and sets the seen flag. Players who skip don't get the cast peek; that's their call. **Do not implement the mockup's "Skip → jump to last panel" behavior** — it was an iteration shortcut for product review, not a shipping pattern. Skip means skip.

### Reconnect / refresh

The seen flag is `(gameId, playerId)`-namespaced and persisted. A player who closes the app mid-onboarding and reopens it resumes wherever they want — but the panel sequence does NOT track per-panel state. They restart from panel 1. If they Step in (or skip), the flag sets; they don't see onboarding again for THIS game.

A player who has already completed onboarding and reconnects sees the normal Pulse shell immediately — onboarding does not re-mount.

## Cast intro overlay

The room sees the new player's arrival as a single dramatic full-screen moment.

### Composition

- **Background:** `PersonaImage` at full-bleed, `preferredVariant="full"`, with the same scrim treatment as the existing PregameRevealCard (gradient from semi-transparent at top to opaque at bottom).
- **Top:** "JOINED" eyebrow in `--pulse-gold` tracked-caps with a hairline rule. Skip button (right) — same visual treatment as the PwaGate skip.
- **Bottom:** display-font name (first + last on separate lines, last in `--pulse-accent`), one-line stereotype, then the QA pull-quote with magazine framing (eyebrow = the question, body = the answer with leading `"`).
- **CTA:** "Tap to continue" pill — same surface treatment as the dossier's close button. Tap also dismisses.

### Source data

- `roster[actorId].personaName` for the name (split on first space; first → top line, rest → accent line).
- `roster[actorId].avatarUrl` for the portrait.
- `pregame.revealedAnswers[actorId].question` and `.answer` for the pull-quote.

If the reveal entry exists, all three are guaranteed (the server only emits `PREGAME_REVEAL_ANSWER` when the player has at least one QA pair). The graceful-fallback branch in `l3-pregame.ts` (player has no QAs → `firstConnectedAt` set, no reveal emitted) means there's no overlay for that player — their PregameRevealCard ALSO doesn't render in chat. Consistent.

### When it fires

Per gating rules above. The trigger is: `pregame.revealedAnswers[X]` becomes present for some `X !== playerId`, X is not in `castIntroSeen`, and the entry's `revealedAt` is recent enough to be a live arrival.

### Self-reveal still updates the dossier

The joining player's own reveal entry is still added to `pregame.revealedAnswers[playerId]`. The PregameDossierSheet reads this and renders their auto-revealed QA as "public." Onboarding doesn't suppress that — it's data the dossier needs.

### Dismissal

- Tap "Tap to continue" → dismiss
- Tap anywhere on the overlay (outside the dismiss CTA) → dismiss
- Tap Skip (top-right) → dismiss + mark ALL queued overlays as seen
- Auto-dismiss after 6s (no input)

On dismiss, the actorId is added to `castIntroSeen`, persisted to localStorage. Queue advances if non-empty.

## File changes

### New

- `apps/client/src/shells/pulse/components/pregame/PlayerIntroOverlay.tsx`
  - Mounts the 5-panel onboarding flow.
  - Owns step state (1..5), navigation (Back/Next/Skip/Step in), localStorage flag write.
  - Uses `framer-motion` `AnimatePresence` for cross-fade between panels.
- `apps/client/src/shells/pulse/components/pregame/PlayerIntroPanels.tsx` (or 5 separate files in `panels/`)
  - One component per panel. Splitting keeps each panel's data wiring + copy contained and testable.
  - Suggested file names: `Panel1Persona.tsx`, `Panel2Pitch.tsx`, `Panel3Rhythm.tsx`, `Panel4Currencies.tsx`, `Panel5CastStepIn.tsx`.
- `apps/client/src/shells/pulse/components/pregame/CastIntroOverlay.tsx`
  - Single-overlay component. Reads from the queue hook, renders one at a time with AnimatePresence.
- `apps/client/src/shells/pulse/hooks/useCastIntroQueue.ts`
  - Subscribes to `pregame.revealedAnswers`. On mount, marks all current entries as seen (catch-up suppression). On change, enqueues new non-self unseen entries. Exposes `{ current, dismiss }`.
- `apps/client/src/shells/pulse/components/__tests__/PlayerIntroOverlay.test.tsx`
- `apps/client/src/shells/pulse/components/__tests__/CastIntroOverlay.test.tsx`
- `apps/client/src/shells/pulse/hooks/__tests__/useCastIntroQueue.test.ts`
- `e2e/tests/player-intro.spec.ts` — happy path: new player joins → sees onboarding → steps in → flag persists; second connection does not replay.

### Modified

- `apps/client/src/shells/pulse/PulseShell.tsx`
  - Mount `<PlayerIntroOverlay />` and `<CastIntroOverlay />` near the bottom of the shell tree (before `<Toaster />` and `<PwaGate />`). Both gate themselves; PulseShell is just the mount point.
- `apps/client/src/store/useGameStore.ts`
  - Add `introSeen` and `castIntroSeen` to the Phase 4 hydration map (parallel to `lastSeenCartridge`, `revealsSeen`, etc.). Add markers `markIntroSeen()` and `markCastIntroSeen(actorId)`. Mirror the existing `(gameId, playerId)`-namespaced localStorage write pattern (lines 1158–1198 are the templates). Hydrate on `hydratePhase4FromStorage` (lines 1137–1156).
- `apps/client/src/shells/pulse/zIndex.ts`
  - Confirm `modal` and `reveal` tiers are sufficient for the two new overlays. (Existing tiers should be enough; PlayerIntroOverlay sits at `modal`, CastIntroOverlay at `reveal`. No new tier needed.)

### Not modified

- `apps/game-server/*` — zero server work. The fact pipeline already emits everything we need.
- `packages/shared-types` — no new event/fact/ticker types.
- `apps/client/src/shells/{classic,immersive,vivid}` — Pulse-only feature.
- `apps/lobby` — no lobby work.

## Edge cases

- **SYNC arrives mid-onboarding.** Panel 5 reads `roster` reactively (Zustand selector) so new arrivals appear in the cast grid live. No special handling.
- **Player joins, doesn't connect for 30 minutes, then connects.** Server emits `PREGAME_REVEAL_ANSWER` only on first connect (idempotent). Onboarding fires correctly when they finally land. The room got their reveal late — that's the existing behavior and matches the design (the "arrival" beat is the first connect, not the join).
- **Player connects, browser crashes, reconnects.** localStorage flag absent (didn't make it to Step in / Skip). Onboarding mounts again. Acceptable — they didn't see it through. If we discover players churning here, revisit.
- **Player is in onboarding when ANOTHER player joins.** Cast intro overlay queue logs the new arrival. Because PlayerIntroOverlay is at `modal` and CastIntroOverlay is at `reveal`, the new overlay would render ABOVE onboarding. **This is wrong** — the joiner shouldn't be interrupted. Mitigation: `useCastIntroQueue` checks for `localStorage.po-pulse-introSeen-${gameId}-${playerId}` and suppresses the overlay until the flag is set. Pending overlays still queue (so they fire after Step in / Skip). If the queue is non-empty when onboarding closes, the first one fires immediately.
- **Player has no QA answers** (graceful-fallback branch in `l3-pregame.ts`). Server doesn't emit a reveal for them. PregameRevealCard doesn't render. CastIntroOverlay doesn't fire. Their cast chip still appears in the strip. Consistent.
- **Player joins after Day 1 starts.** `phase` no longer === `PREGAME`. Onboarding doesn't mount. Late arrivals see chat directly. Acceptable for v1 — late joiners are rare and have a different problem (catch-up on what happened).
- **Persona has no `bio` field.** Panel 1's tagline falls back to a hard-coded line per stereotype, OR is omitted (see Open questions Q3).
- **Multiple tabs / multiple devices.** localStorage is per-origin per-device. A player who completes onboarding on phone and reconnects on laptop sees onboarding again on laptop. Acceptable (and arguably correct — they're seeing it for the first time on that device). The seen flag is intentionally not synced server-side.
- **PwaGate is open.** PwaGate is non-dismissible (per `feedback_gates_are_principled.md`). It mounts at `popup` z-tier in the PulseShell tree. PlayerIntroOverlay should mount BELOW PwaGate's z-tier so the gate wins; PwaGate already blocks interaction with everything beneath it. Once the gate dismisses (push subscribed or fallback path), onboarding becomes visible. Verify against the actual PwaGate z-index in `zIndex.ts`.

## Testing

### Unit (Vitest + React Testing Library — already set up per `reference_client_test_infra.md`)

`PlayerIntroOverlay.test.tsx`:
- Does NOT mount when `phase !== PREGAME`.
- Does NOT mount when `pregame.revealedAnswers[playerId]` is absent.
- Does NOT mount when `localStorage` flag is set.
- Mounts when all gates pass.
- Next/Back navigates panels 1 → 5.
- Skip closes overlay + sets localStorage flag.
- Step in closes overlay + sets localStorage flag.
- Reads roster size for "eight strangers" copy correctly.

`CastIntroOverlay.test.tsx`:
- Does NOT render when no unseen non-self reveals are queued.
- Renders the queued reveal correctly (name, question, answer, portrait).
- Tap dismisses + advances queue.
- Auto-dismisses after 6s.

`useCastIntroQueue.test.ts`:
- On first mount, marks all existing non-self reveals as seen WITHOUT enqueueing.
- New reveal arrives → enqueued (if non-self, unseen).
- Self-reveal arrives → NEVER enqueued.
- Dismiss advances queue.
- Skip-all marks queue as seen.
- Suppresses while `introSeen` is false (joiner is in onboarding).

### E2E (Playwright)

`player-intro.spec.ts`:
- Create test game with 2 players. Player 1 joins via lobby URL.
- Assert: onboarding mounts on Pulse shell.
- Click Next 4× then Step in.
- Assert: onboarding gone; localStorage `po-pulse-introSeen-<gameId>-p1 === 'true'`.
- Refresh page. Assert: onboarding does not re-mount.
- Player 2 joins (separate browser context). Assert: Player 1's CastIntroOverlay fires for Player 2.
- Tap Player 1's overlay → dismisses.
- Refresh Player 1. Assert: overlay does NOT re-mount (seen).

## Risks

1. **The "eight strangers" line is wrong if roster size != 8.** Roster size is dynamic at game creation. Fix: read `Object.keys(roster).length` and use the literal number ("six strangers", "ten strangers"). Less iconic but correct. (See Open questions Q1.)
2. **Z-index battles.** PlayerIntroOverlay must sit between cast intro overlay (above) and PwaGate (also above). Verify with the existing `PULSE_Z` tiers; add a new tier if needed (the spec calls out modal vs reveal, but the actual existing values may need adjustment).
3. **Catch-up suppression is timing-sensitive.** If `useCastIntroQueue` mounts BEFORE `pregame.revealedAnswers` hydrates from SYNC, it sees an empty map and marks nothing as seen — then SYNC arrives with 4 entries and queues 4 overlays. Mitigation: gate the "mark all current as seen" step on `gameId && playerId && pregame !== null` so it runs after the first SYNC. Verified in unit tests.
4. **Skip control discoverability.** Top-right corner is the convention but easy to miss. If playtest data shows churn at panel 1, consider adding a subtle "you can skip" affordance below the persona reveal. Defer to playtest.
5. **Copy register drift.** Future copy edits may water down the host voice toward generic tutorial speak. Memory entry will document the voice constraint.

## Amendments from 2026-05-04 audit

A `/harden`-lens audit (run 2026-05-04) of this spec against `/.impeccable.md`, `apps/lobby/.impeccable.md`, the SBCSJT playtest report, and the existing pregame surfaces in code surfaced gaps that should land before implementation. A separate `/critique` of the live Pulse shell + targeted playtester feedback (Ainge, game SBCSJT, points 1–5 of 2026-05-04 batch) corroborated three of these as P0. This section consolidates the proposed changes; integrate into the panels above before building.

Source artifacts:
- `docs/reports/playtest-SBCSJT-engagement.md` (4 of 6 dark on Day 1; 2 of those silent because push never enabled)
- `memory/project_desktop_brave_push_loop.md` (Layer 1+2 shipped; Layer 3 banner shipped 2026-05-04 on `feat/push-off-banner`)
- `apps/lobby/.impeccable.md` (catfish is the load-bearing word; "mask" metaphor is retired — see §"Drop 'mask'", lines 199–200)

### A. Voice-coherence fix — retire "mask" in onboarding copy

**Change:** Replace "mask"/"masks" with "catfish" wherever it appears in this spec (Panel 1 eyebrow, Panel 2 hero lines, prose like "the mask premise").

**Why:** Lobby brief explicitly retires the mask metaphor (`apps/lobby/.impeccable.md:199–200`): "The mask metaphor doesn't follow through anywhere else in the product. Don't use it on any new surface." This spec is a new surface. Cross-app voice drift here would re-establish the metaphor that the lobby just dropped.

**Proposed copy (Panel 2 verbatim block, line 162–166):**
> "I've put eight strangers in a room. Every one of them is a catfish."
> "Lie. Charm. Vote each other out. The last catfish standing takes the gold."
> "Day 1 starts at 5:00 PM today. You have until then to feel out the room. After that, every day kills one of you."

**Proposed eyebrow (Panel 1, line 150):** Replace `eyebrow "THE MASK"` with `eyebrow "THE COVER"` or `eyebrow "YOUR CATFISH"`. Recommendation: `"YOUR CATFISH"` — uses the load-bearing word as the panel anchor.

**Defer:** if the user prefers the original mask language for poetic reasons, treat this section as an open question and resolve in copy review (added to Definition of done below).

### B. New Panel 4.5 — Pings (push permission as first-class panel)

**Change:** Insert a new panel between Panel 4 (Currencies) and Panel 5 (Cast) — making the flow 6 panels total, OR replace Panel 4 with an integrated "Currencies + Pings" surface (recommendation: insert; the two concepts are distinct).

**Why (P0):** Playtest data shows ~33% of joiners never enabled push, going dark by Day 1. Spec currently routes around PwaGate via Edge case line 311 ("mount BELOW PwaGate's z-tier"). Routing-around is not earning. The single highest-impact onboarding moment in the entire flow is treated as someone else's problem.

**Treatment:** Show a fake push notification card composition (matches Pulse's reveal grammar — character portrait + bold name + line of copy). Three sample pings cycle or tile:
- "Quill nudged you" — silver pip
- "Felix sent you 12 silver"
- "Day 1 vote opens"

**Copy (proposed):**
> Eyebrow: "PINGS"
> Heading: "These are the moments that matter."
> Body: "Silver hits. DMs. The vote opening. Without notifications, you'll miss them. We don't email."
> CTA in panel body: "Turn them on" — taps to dismiss panel + trigger PwaGate's subscribe path (closes onboarding modal briefly while gate is up; resumes after gate dismisses).

**Coordination with PwaGate:** PwaGate stays non-dismissible per `feedback_gates_are_principled.md`. The Pings panel doesn't replace the gate — it provides meaning before it. If the user already granted permission (entered onboarding via a deferred-then-allowed flow), skip this panel (`isSubscribed === true → skip`).

**Optional:** fire a real test push on permission grant — the GM sends a "you're in" message to verify the loop end-to-end before anything matters. Per the SBCSJT engagement report recommendation 3.

### C. Late-joiner branch — phase-aware gating

**Change:** Replace gating step 1 (line 94) `phase === DayPhases.PREGAME` with a phase-aware variant. Split panels by phase-applicability:

| Panel | Pregame | In-progress (Day N) |
|---|---|---|
| 1 — Persona reveal | ✓ | ✓ (always) |
| 2 — Pitch | ✓ ("Day 1 starts at X") | adapt: "You're walking into Day N. Voting closes in Xh." |
| 3 — Day rhythm | ✓ | ✓ (manifest-driven; see D below) |
| 4 — Currencies | ✓ | ✓ |
| 4.5 — Pings | ✓ | ✓ |
| 5 — Cast | ✓ ("first impressions" pulls) | adapt: drop pull-quotes; show grid + eliminated-state markers |

**Why (P0):** Current spec line 308 dismisses late joiners as "acceptable for v1 — late joiners are rare." Unsupported. CONFIGURABLE_CYCLE games allow mid-game joining; SBCSJT had 4 of 6 dark Day 1 — not rare. Late joiners hit the same mental-model failure as pregame joiners; offering zero of two solutions for the same person is not a v1 stance.

**Implementation:** read `useGameStore.dayIndex` + `useGameStore.phase` at mount; choose copy variants accordingly. No new server work.

**Edit § Edge cases line 308:** delete "Acceptable for v1." Replace with: "Late-joiner panels run with phase-adapted copy per Amendment §C below."

### D. Panel 3 — manifest-driven anchors (replace hard-coded times)

**Change:** Replace the hard-coded daily schedule table (lines 178–184) with manifest-driven labels and times.

**Why (P1):** Hard-coded "9–10 am" times are wrong for late-evening start times (the most common playtest cadence). A new player reading "9–10 am: group chat opens" at 8pm Tuesday will misinterpret the schedule. Anchored expectations have to be true to anchor.

**Proposed:** read `useGameStore.manifest.days[0].events` (already in store per spec line 67). Render hard-coded labels ("Group chat opens", "Daily game", "DMs all day", "The vote", "Someone goes home") with manifest-anchored times. For times far in the future, use clock format ("at 5:00 PM"); for near-future, use relative ("in 2h", "tonight at 11pm").

**Risks update (line 355):** Risk #1 ("eight strangers") is the wrong call-out; the dynamic-day risk is bigger. Replace risk text accordingly.

### E. Cast intro overlay — add cohort signal

**Change:** § Composition (lines 233–238). Below the QA pull-quote, add one quiet line: cohort progress.

**Why (P1):** The overlay fires on a NEW player joining — that's a social moment, not just a presence moment. Currently surfaces identity only. Free social signals available:
- "Now 5 of 6 in the room" (cohort progress)
- "arrived 6m before you" (tempo)
- "you'll meet them in DMs once Day 1 starts" (anchoring next moment)

**Proposed treatment:** single tracked-caps line below QA pull-quote: `NOW 5 OF 6 IN THE ROOM` (or `4TH IN` for the joiner's own banner). Per `feedback_verify_existing_signals.md`, cast strip owns per-player signals — this is a one-time echo, not a duplicate surface.

### F. Step in → first-message scaffolding

**Change:** Add a § "After Step in" subsection between § "Skip behavior" (line 219) and § "Reconnect / refresh" (line 223).

**Why (P2):** Most predictive engagement event after onboarding is whether the player sends their first message in the first 60s. SBCSJT data: 2 engaged players sent 2–4 chats during pregame; disengaged sent 1 or 0. Spec doesn't address what happens between Step in and first chat.

**Proposed:**
1. Prefill `PulseInput` placeholder with persona context: `"Say hi as ${personaName}…"` (replace existing pregame placeholder when introSeen flips true).
2. Surface a one-shot HintChip (using existing `HintChips.tsx:144–188` mechanism) that taps-to-paste the player's bio's first sentence into the input. "Open with a line from your bio →"

Both interventions sit in the input bar where the eye lands after the modal unmounts. Neither is a tutorial.

### G. Panel 5 — social-proof eyebrow

**Change:** § Panel 5 (line 201–217). Add an eyebrow above the cast grid.

**Why (P2):** Lobby knows who invited whom (`apps/lobby/app/j/[code]/page.tsx:31–44`). Surfacing it: "Maya cast you" is stronger commitment framing than "you tapped a link."

**Proposed eyebrow:** `"${hostPersonaName} CAST YOU."` (gold tracked-caps, above the cast grid). Optional: render host portrait at slightly larger scale than rest. Pull from `manifest.host` if available; else from existing `PersonaImage` lookup. If host data isn't in the SYNC payload, this is the one place where light server work would be justified — but check first.

### H. Onboarding replay door

**Change:** Add to § File changes / Modified — `apps/client/src/shells/pulse/components/pregame/PregameDossierSheet.tsx`.

**Why (P2):** Skip = skip is correct. But players who skipped (or tapped through quickly) have no "wait, what was that thing about silver?" door. Discovery-based onboarding requires that the *information* remain reachable.

**Proposed:** in the player's OWN dossier (self only — not on other personas' dossiers), add a single eyebrow link `"REPLAY THE INTRO →"`. Tap clears `introSeen` + remounts `PlayerIntroOverlay`.

### I. Curiosity teasers vs roster grid (Panel 5 — judgment call)

**Change (proposed):** Replace the 5-column persona headshot grid in Panel 5 with redacted timeline-event teaser cards.

**Why (P0 from harden audit, but contested):** Reality TV teasers seed *what's about to happen*, not *who's in the room*. Per `memory/project_pregame_reveals_accumulate.md`, reveals already arrive one-per-join in chat — the player has seen everyone. The grid is therefore redundant for identity (chat already covers it).

**Proposed:** pull next ~2 timeline events (`useGameStore.manifest.days[0].events`) and render as redacted cards — "Day 1 game · 6:30 PM · [blurred name]"; "First vote · 9 PM tonight." Optionally surface one already-visible teaser like "Mack confessed something. Read it in chat →" with a deep-link that closes onboarding and scrolls.

**Trade-off:** This loses the social grounding ("here are the people who'll try to catch you") in service of variable-reward seeding. **Recommendation:** keep the grid (more visible identity beat) and ADD a second beat below it ("Coming up tonight: …") rather than replace. Grid + teaser, two beats, same panel.

### J. Edge cases — additions

Append to § Edge cases (line 312, after the existing list):

- **PwaGate denied mid-onboarding loses the moment.** Player taps "I'll do this later" on PwaGate (PwaGate.tsx ~line 226), bypasses to onboarding without push. Spec offers no second-chance prompt anywhere in the panels. **Recovery:** the new Pings panel addresses this for mid-onboarding flow; for post-onboarding, the Layer 3 push-off banner (shipped 2026-05-04 on `feat/push-off-banner`) provides persistent visibility.
- **SYNC fails or is delayed past gate threshold.** Gate 3 is `pregame.revealedAnswers[playerId]` exists. If SYNC is slow (Cloudflare cold start, network blip), player sees Pulse shell with no onboarding, no overlay, no fallback timer. **Recovery:** if SYNC hasn't hydrated `revealedAnswers` within ~10s, fall back to a minimal "still pulling your room together…" shell (chrome only, no chat content). Onboarding mounts when the gate clears.
- **Player has no QAs but is otherwise valid.** Server graceful-fallback (line 246–247) doesn't emit reveal. Joiner's onboarding gates on `revealedAnswers[playerId]` existing — they'd never see onboarding. **Recovery:** parallel gate path — if `roster[playerId]` is set but no reveal entry AND `firstConnectedAt` is past, fire onboarding using a hard-coded fallback for Panel 1's pull-quote ("New face. No name yet.").
- **localStorage write blocked** (private mode, quota exceeded, iOS PWA quirks). Seen-flag write is unguarded (line 99). On iOS PWA with strict storage policies, write fails silently → onboarding mounts again on every reload. Cast intro overlay's `castIntroSeen` map ALSO uses localStorage with same risk. **Recovery:** wrap localStorage writes in try/catch (already common in `useGameStore.ts`); fall back to in-memory Map. Add unit test for localStorage-throws case.
- **Skip is too easy on accidental tap.** Per `feedback_no_long_press.md`, teens trigger accidental taps. Skip is currently zero-friction. **Recovery:** Per Pulse principle 7 (`.impeccable.md:46`), a 3-second undo countdown after Skip would be consistent. Tap-to-undo restores onboarding to Panel 1.
- **PWA install gate triggers AFTER onboarding sets the flag.** On iOS, install creates a new standalone window — sessionStorage clears; localStorage *might* survive (browser-version-dependent). Spec assumes localStorage persists through install. **Recovery:** test on real iOS device. Possible fallback: store seen-flag in IndexedDB (survives Safari→PWA bridge more reliably).
- **Multiple tabs racing the cast intro overlay queue.** Same-device, multiple tabs (rare on mobile, common on desktop) can both fire the overlay. Seen-flag is localStorage-shared, but in-memory queue isn't. **Recovery:** BroadcastChannel API to dedupe across tabs, OR check localStorage timestamp before showing each overlay. Document as known limitation if not fixed.
- **Roster size 1 ("eight strangers" → "one stranger").** Open question Q1 lands on "literal," but `Object.keys(roster).length === 1` (host alone, no one else has joined the client yet) makes Panel 2 say "I've put one stranger in a room." **Recovery:** floor at 2 ("strangers in a room" only triggers at ≥2). For solo case, swap pitch copy: "Your room is filling. Day 1 starts at 5:00 PM today." Don't say "stranger" until there is one.
- **Bio missing AND bio-as-tagline lookup fails.** Open question Q3 lands on "use bio if present; if not, omit the tagline." Doesn't address layout when tagline is omitted — Panel 1 expects three copy lines. **Recovery:** either always render a fallback line (per stereotype), OR design Panel 1 to be tagline-optional and verify both compositions read.
- **Player closes app between Panel 1 and Panel 5.** Line 224–225: "they restart from panel 1." Sunk-cost erosion (lobby invested ~90s; another 30–60s of onboarding gone). **Recovery:** per-panel state IS worth tracking (low cost: localStorage write on Next/Back). Resume at the panel they left.

### K. Cross-surface coordination notes

For implementation:

- **PwaGate z-tier.** PwaGate uses raw `z-[60]` overlay + `z-[70]` content (PwaGate.tsx:154–155). PULSE_Z has drawer=60, modal=70 (zIndex.ts:32–34). Spec proposes mounting onboarding at `PULSE_Z.modal` — same numeric z as PwaGate's drawer content. Currently render-order-dependent. Verify on Brave Desktop + iOS Safari before shipping.
- **PREGAME_REVEAL_ANSWER triple-rendering.** Same fact already drives chat card + cast intro overlay; the spec adds Panel 1 as a third surface. Room-watcher sees BOTH overlay AND chat card. Decide whether the chat card is suppressed on the room-side until the overlay has played, or accept the double-drama as additive.
- **PregameDossierSheet auto-revealed answer overlap.** Dossier renders auto-revealed QA with "Your first impression — public" badge (line 211). Panel 1 surfacing the same answer = double exposure. Decide single-home rule: dossier is canonical; Panel 1 surfaces it differently (eyebrow only, no body) OR not at all.
- **CastStrip pregame-tap routes to dossier behind modal.** If onboarding is open and player taps a cast strip chip behind it, the dossier opens BEHIND the modal (CastStrip.tsx:56–59). Define behavior: either disable cast-strip taps while onboarding is up, or close onboarding on cast-strip tap.

### L. Definition of done — additions

Append:
- [ ] Copy review by user. "Mask" → "catfish" rewrite (Amendment §A) approved verbatim.
- [ ] Late-joiner panel variants verified at Day 2+ (Amendment §C).
- [ ] Pings panel + PwaGate handoff verified end-to-end on Chrome Desktop + iOS Safari + Brave Desktop.
- [ ] Replay-the-intro door tested in PregameDossierSheet (Amendment §H).

---

## Open questions

**Q1: "Eight strangers" — literal or dynamic?**
The line is iconic for a reason ("8 players, 7 days" is in the spec masthead). But roster sizes can be 6–10. Options:
- (a) Always "eight strangers" — iconic, sometimes wrong.
- (b) Always literal — "six strangers" / "nine strangers" — accurate, less iconic.
- (c) Round to "a roomful of" / "a small group of" — vague, dodges the issue.
**Recommendation:** (b) literal. Accuracy beats iconography when the player can count the cast strip. Single source of truth: `Object.keys(roster).length` at panel 2 mount.

**Q2: Cast intro overlay duration — auto-dismiss at 6s, or wait for tap?**
6s is long enough to read but short enough not to block. But auto-dismiss might feel rushed during emotional peaks. Options:
- (a) Auto-dismiss at 6s.
- (b) Never auto-dismiss; require tap.
- (c) Auto-dismiss but reset on user interaction (hover / scroll prevents close).
**Recommendation:** (a). Pulse pattern is "calm by default, event-driven, settles" — auto-dismiss matches the grammar. Most players will tap to continue earlier anyway.

**Q3: Stereotype line — where does it come from?**
Mockup shows "The Showmance" / "Here for love and protein" — punchy character archetype + tagline. Two paths:
- (a) Add a `Persona.stereotype` field to roster + lobby admin to author. Heavy.
- (b) Reuse `Persona.bio` (already present, optional). Bios are 280 chars max — render the first sentence, fall back to nothing.
- (c) Hard-code per-persona lookup table at client. Brittle.
**Recommendation:** (b). Use `bio` if present; if not, omit the tagline. Single field, no schema work, no admin UI work. The bio IS the character's voice; using it as a tagline reinforces that the bio is meaningful.

**Q4: Queue collapse threshold (3 vs other).**
If 4+ players land within seconds, do we cap at most-recent only? Or queue all and let the player tap through?
- (a) Cap at most-recent (silent-mark older).
- (b) Cap at most-recent 2 (one in flight, one queued; everything beyond marked silent).
- (c) Queue all.
**Recommendation:** (b). At 6s auto-dismiss × 4 = 24 seconds blocked. (a) loses information; (c) blocks too long. Two is the natural rhythm.

**Q5: Onboarding position relative to PwaGate.**
PwaGate is non-dismissible and mounts above shell content. Should onboarding mount before, after, or be wrapped inside PwaGate's own surface?
- Best answer: PwaGate first (non-dismissible by design), then onboarding when gate clears. Confirm by reading `PwaGate.tsx` z-tier.

## Definition of done

- [ ] All unit tests pass (`npm run test` in `apps/client`).
- [ ] E2E test `player-intro.spec.ts` green (`npm run test:e2e` from root).
- [ ] `npm run build` clean in `apps/client`.
- [ ] PlayerIntroOverlay verified in browser: 5-panel flow + skip + step-in + flag persists across reload.
- [ ] CastIntroOverlay verified in browser: live arrival → overlay; reload → no overlay; rapid arrivals → queue.
- [ ] Self-suppression verified: joiner sees onboarding, not their own cast intro overlay.
- [ ] Catch-up suppression verified: late joiner mounts, sees no overlay flood for prior arrivals.
- [ ] Skipped onboarding stays skipped on reload.
- [ ] Copy reviewed by user; host voice not diluted.
- [ ] `project_player_intro.md` memory entry written; cross-references `project_pulse_shell.md`.
- [ ] No regression in PregameRevealCard chat rendering or PregameDossierSheet behavior.
- [ ] Mockup file `docs/reports/pulse-mockups/24-pregame-features-tabbed.html` left in place (still useful as a visual reference; not deleted).
