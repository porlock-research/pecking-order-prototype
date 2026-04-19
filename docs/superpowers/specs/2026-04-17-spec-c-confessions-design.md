# Spec C — Confessions: Anonymized Phase + Match Cartridge

**Date:** 2026-04-17
**Status:** Draft — awaiting user approval
**Author:** Manu + Claude
**Related:**
- Memory note: `project_gm_intelligence.md` (deferred Spec C stub)
- Existing prompt cartridge being repurposed: `apps/game-server/src/machines/cartridges/prompts/confession-machine.ts`
- ADR-096 — channel capability system
- ADR-112 — parallel layer pattern (dilemmaLayer precedent)

---

## Why

Pecking Order has a single confession-shaped feature today: the `CONFESSION` prompt cartridge (`confession-machine.ts`), which collects one anonymous confession per player and votes for a winner. It is a one-shot activity, not a phase. There is no "drop-in zone" where players can vent multiple times under cover of anonymity, no extended intrigue window, and no game-mechanical payoff to figuring out who wrote what.

Spec C introduces a **Confession Phase** — a manifest-configurable window during which alive players post anonymously into a dedicated channel under stable per-phase handles ("Confessor #3"). The phase is intrigue infrastructure: mass venting, alliance-fishing, mischief, drama-seeding. Posts are stored as first-class facts.

The (rewritten) confession cartridge becomes the **Match Cartridge** — a follow-up activity that consumes a prior confession-phase archive and asks each player to identify the author of one assigned handle. Scoring rewards correct guesses; the reveal exposes the full handle-to-author mapping as the closing dramatic beat.

The two are decoupled at the manifest level: a game can run confession phases without ever scheduling a match cartridge (anonymity preserved forever), or run them paired (intrigue resolved into a guessing game).

## Guiding principles

- **First-class confessions.** Confessions are NOT chat messages with a flag. They have their own event namespace, fact type, channel type, and L3 region. Pipelines (D1 journal, SYNC, ticker, push) treat them as a distinct concept.
- **Anonymity is enforced at the SYNC boundary.** The server holds the `handle → authorId` map; clients never see it during the phase. The match cartridge is the only legitimate path to authorship reveal.
- **Capability-driven channel.** The CONFESSION channel exposes only the `'CONFESS'` capability. Silver transfers, nudges, reactions, whispers, and normal chat messages are physically rejected at validator time — no special-casing required in the message handlers.
- **Configurable, additive, opt-in.** If a manifest never schedules `START_CONFESSION_CHAT`, the new layer sits in `idle` forever and the game runs identically to today. Ruleset flag gates the feature; default disabled.
- **One-pass match game.** The match cartridge assigns each player exactly one handle to investigate. Single guess. Low cognitive load, high engagement.

## Scope

**In scope:**
- New L3 parallel region: `confessionLayer` (`idle → posting → idle`)
- New channel type `CONFESSION` with capability `'CONFESS'`
- New event namespace `Events.Confession.*` — v1 contains `POST` only
- New fact type `FactTypes.CONFESSION_POSTED` (journalable; SYNC-anonymized)
- New fact types `FactTypes.CONFESSION_PHASE_STARTED` / `CONFESSION_PHASE_ENDED` (journalable; drive phase-open ticker narration + telemetry)
- New ticker category `TickerCategories.SOCIAL_PHASE` (generic phase-narration category; `CONFESSION_PHASE_STARTED` routes to it; Pulse `ChatView.narratorTickers` filter extended to include it)
- New manifest timeline actions: `START_CONFESSION_CHAT`, `END_CONFESSION_CHAT`
- New ruleset flag: `confessions.enabled: boolean` (default `false`)
- Rewrite `confession-machine.ts` as the new `CONFESSION_MATCH` prompt cartridge (the old vote-for-best-confession mechanic retires)
- New D1 read helper `loadConfessionArchive(gameId, sourceDayIndex)` consumed at match cartridge spawn
- SYNC projection extension for `confessionPhase` and `CONFESSION_POSTED` fact author-stripping
- Push-phase trigger on phase open — exact copy: **"A confession phase has opened."** (public-social-proof framing; no viewer-relative phrasing per the narrator-intrigue guardrail). This is a spec decision, not left to `push-triggers.ts`.
- Ticker narrator line on phase open (deliberately distinct voice from the push copy): **"The confession booth is open."** — the ticker line lands in the in-app narrator feed and uses the more literary "booth" framing; the push copy uses the more mechanical "phase" vocabulary. Same length, different register. Keep both verbatim.
- One narrator ticker line per phase open (no per-post lines, no phase-close line)
- Pulse client: CONFESSION channel render path (composer + feed); match cartridge UI
- E2E + unit + integration test coverage
- Vitest coverage of capability rejection, handle assignment determinism, snapshot round-trip mid-phase
- DemoServer impact check (per CLAUDE.md rule)

**Out of scope:**
- Replies to confessions (mono-directional posts only in v1; threading deferred)
- Reactions on confessions (deferred — would need anonymized reaction author handling)
- Lobby visual builder for confession timeline events (v1 accepts JSON manifests; admin scheduling UX is backlog)
- Game Master scheduling confession phases dynamically (deferred — GM Intelligence Spec A on hold; manifest-driven only in v1)
- Cross-game persona persistence of confession handles (each phase gets fresh handles; persistent pseudonyms deferred)
- Eliminated-player confession participation (v1: alive only — eliminated players don't post)

## Architecture

### L3 layer addition

`l3-session.ts` gains a new parallel region as a sibling to existing regions. This mirrors `dilemmaLayer` (ADR-112), whose actual state shape is `idle → dilemmaActive → completed → idle`. Our analog is `idle → posting → idle` (no `completed` intermediate in v1 — phase close flips state and archives in one step; the `completed` state is only needed when a cartridge's `done.actor` and a forced-exit event can race, which isn't the case here since a phase close is timeline-driven, not cartridge-driven).

```
running (parallel)
├── social               (existing)
├── mainStage            (existing — voting / dailyGame / groupChat)
├── activityLayer        (existing — prompt cartridges; CONFESSION_MATCH spawns here)
├── dilemmaLayer         (existing)
└── confessionLayer      (NEW)
        idle → posting → idle
```

`confessionLayer.idle` is the default. `START_CONFESSION_CHAT` (raised from L2's timeline processor) transitions to `posting`. `END_CONFESSION_CHAT` returns it to `idle`.

### L3 context additions

```ts
interface DailyContext {
  // ... existing fields ...

  /** Per-phase confession state. Cleared on phase close (posts already in D1 via facts). */
  confessionPhase: {
    active: boolean;
    /** Server-only: full handle assignment. NEVER broadcast intact — projected per-recipient at SYNC time. */
    handlesByPlayer: Record<string, string>;  // playerId → "Confessor #N"
    /** In-memory mirror for SYNC projection; truth lives in D1 via FactTypes.CONFESSION_POSTED. */
    posts: Array<{ handle: string; text: string; ts: number }>;  // authorId NEVER projected
  };
}
```

Initial value: `{ active: false, handlesByPlayer: {}, posts: [] }`.

**Per-recipient SYNC projection for `handlesByPlayer` (PRIVACY-CRITICAL):** the full map never leaves the server. `buildSyncPayload(deps, pid, ...)` in `sync.ts` is already per-recipient (iterates connections, builds per-pid payload). The projection layer reduces `handlesByPlayer` to `{ myHandle: handlesByPlayer[pid] ?? null, handleCount: Object.keys(handlesByPlayer).length }` before inclusion. Clients see only their own handle plus the total count (the count is public; the match cartridge UI needs it to render the roster picker later).

### Channel addition

```ts
ChannelTypes = { MAIN, DM, GROUP_DM, GAME_DM, CONFESSION }   // NEW: CONFESSION
// Full existing ChannelCapability union (packages/shared-types/src/index.ts:518-521):
//   'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES'
//   | 'GAME_ACTIONS' | 'NUDGE' | 'WHISPER'
// Extended with one new capability:
ChannelCapability = ... | 'CONFESS'   // NEW
```

CONFESSION channel's `capabilities` array is **exactly** `['CONFESS']` — none of the other eight are permitted. Validator-level rejection for any non-CONFESS event flowing to this channel.

A CONFESSION channel is created on `posting` entry and destroyed on exit. Membership = alive roster snapshot at phase start. Capabilities = `['CONFESS']` only.

Channel ID format: `CONFESSION-d{dayIndex}` (deterministic per day; supports snapshot restore).

### Event additions

```ts
Events.Confession = {
  PREFIX: 'CONFESSION.',
  POST: 'CONFESSION.POST',
};
```

Match cartridge guess events live under existing `Events.Activity.*`:

```ts
Events.Activity.CONFESSION_MATCH = {
  GUESS: 'ACTIVITY.CONFESSION_MATCH.GUESS',
};
```

(Following the existing pattern where each prompt type has its own sub-namespace under Activity.)

### Fact type addition

```ts
FactTypes.CONFESSION_POSTED = 'CONFESSION_POSTED'
```

Payload (write to D1):
```ts
{
  type: 'CONFESSION_POSTED',
  actorId: string,           // real playerId — preserved in D1, stripped in SYNC
  payload: {
    channelId: string,       // e.g. "CONFESSION-d2"
    handle: string,          // "Confessor #3"
    text: string,
    dayIndex: number,        // for cross-day query convenience
  },
  timestamp: number,
}
```

Journalable (`isJournalable: true` in `d1-persistence.ts`). The `actorId` field is the load-bearing piece for the match cartridge to retrieve authorship later. SYNC projection MUST strip `actorId` for `CONFESSION_POSTED` facts before broadcast (separate stripping path beyond the standard fact projection).

### Manifest timeline actions

```ts
TimelineActions = {
  // ... existing ...
  START_CONFESSION_CHAT,
  END_CONFESSION_CHAT,
}
```

Manifest example (DYNAMIC, single confession phase on day 2 → match cartridge on day 3):

```json
{
  "kind": "DYNAMIC",
  "ruleset": { "confessions": { "enabled": true } },
  "days": [
    {
      "dayIndex": 2,
      "timeline": [
        { "time": "...", "action": "START_CONFESSION_CHAT" },
        { "time": "...", "action": "END_CONFESSION_CHAT" }
      ]
    },
    {
      "dayIndex": 3,
      "activityType": "CONFESSION_MATCH",
      "activityConfig": { "sourceDayIndex": 2 },
      "timeline": [
        { "time": "...", "action": "START_ACTIVITY" },
        { "time": "...", "action": "END_ACTIVITY" }
      ]
    }
  ]
}
```

`sourceDayIndex` lives on the day's activity config (e.g., `day.activityConfig.sourceDayIndex`), NOT on the `START_ACTIVITY` timeline event payload. Putting it on the timeline event would leak activity-type-specific shape into a generic action. L3's activity-spawn path reads `day.activityConfig` as it already does for similar per-activity configuration.

### Ruleset addition

```ts
PeckingOrderRuleset.confessions: {
  enabled: boolean;          // default: false
  matchIncludesEliminated: boolean;  // default: false (eliminated authors excluded from match guess pool)
}
```

When `confessions.enabled === false`:
- L3 ignores `START_CONFESSION_CHAT` / `END_CONFESSION_CHAT` events (logged as `INTERNAL_REJECTED` with reason `confessions-disabled`)
- Match cartridge spawn with `activityType: 'CONFESSION_MATCH'` short-circuits to `completed` immediately with empty results

This means a manifest with confession events but `enabled: false` is non-functional but doesn't crash — defensive behavior for misconfigured manifests.

### Group chat coexistence

While `confessionLayer.posting` is active, `mainStage.groupChat` pauses via the existing `groupChatOpen=false` mechanism. MAIN reopens when the phase ends. No new pause invention.

## Components — file map

### New files

- `apps/game-server/src/machines/actions/l3-confession.ts` — phase entry/exit actions, POST handler, handle assignment helper
- `apps/game-server/src/machines/cartridges/prompts/confession-match-machine.ts` — the new match cartridge
- `apps/game-server/src/machines/__tests__/confession-layer.test.ts`
- `apps/game-server/src/machines/__tests__/confession-channel-capabilities.test.ts`
- `apps/game-server/src/machines/__tests__/confession-fact-projection.test.ts`
- `apps/game-server/src/machines/__tests__/confession-handle-assignment.test.ts`
- `packages/game-cartridges/__tests__/confession-match.test.ts` (or wherever cartridge tests live)
- `e2e/tests/confession.spec.ts`
- `apps/game-server/src/d1-confession-queries.ts` — `loadConfessionArchive(gameId, sourceDayIndex)` helper

### Modified files

- `packages/shared-types/src/events.ts` — add `Events.Confession.POST`, `Events.Activity.CONFESSION_MATCH.GUESS`, `FactTypes.CONFESSION_POSTED`, `TimelineActions.START_CONFESSION_CHAT`, `TimelineActions.END_CONFESSION_CHAT`
- `packages/shared-types/src/index.ts` — extend `ChannelTypes` with `CONFESSION`, extend channel capability union with `'CONFESS'`, extend `PromptTypes` with `CONFESSION_MATCH` (or rename existing `CONFESSION` registry entry — see "Naming decisions" below)
- `packages/shared-types/src/index.ts` — extend `PeckingOrderRulesetSchema` with optional `confessions: { enabled, matchIncludesEliminated }` block
- `apps/game-server/src/machines/l3-session.ts` — add `confessionLayer` parallel region, add `confessionPhase` to `DailyContext`, register `l3-confession` actions
- `apps/game-server/src/machines/cartridges/prompts/confession-machine.ts` — DELETED. The old vote-for-best-confession cartridge is retired entirely; `confession-match-machine.ts` replaces it.
- `packages/shared-types/src/index.ts` — retire `PromptTypes.CONFESSION`; add `PromptTypes.CONFESSION_MATCH`. Verify (grep) that no manifest in any test fixture or preset references `CONFESSION` as a prompt type before deleting.
- `apps/client/src/cartridges/prompts/PromptPanel.tsx` (or wherever the prompt cartridge lazy loader lives) — update the import/registry entry to point at the new cartridge component; remove the old `ConfessionPrompt.tsx` lazy import
- `apps/client/src/cartridges/prompts/ConfessionPrompt.tsx` — DELETED (replaced by `ConfessionMatch.tsx`)
- Any existing unit tests for the old cartridge (e.g., `confession-machine.test.ts`) — DELETED. New tests for `CONFESSION_MATCH` cover the new mechanic.
- `apps/game-server/src/d1-persistence.ts` — add `CONFESSION_POSTED`, `CONFESSION_PHASE_STARTED`, `CONFESSION_PHASE_ENDED` to `JOURNALABLE_TYPES`
- `apps/game-server/src/projections.ts` — per-fact author-stripping for `CONFESSION_POSTED`; **delete** the existing `projectPromptCartridge` branch that strips `ctx.confessions` during COLLECTING/VOTING (lines ~46–63) since the old cartridge is retired
- `apps/game-server/src/sync.ts` — `buildSyncPayload(deps, pid, ...)` gains per-recipient projection of `confessionPhase`: `handlesByPlayer` → `{ myHandle: handlesByPlayer[pid] ?? null, handleCount }` before client send; `posts` passes through (already anonymized at record time)
- `apps/game-server/src/ticker.ts` — branch for `CONFESSION_PHASE_STARTED` → `SOCIAL_PHASE` category narrator line. No `CONFESSION_PHASE_ENDED` ticker line. No `CONFESSION_POSTED` ticker lines.
- `apps/client/src/shells/pulse/components/chat/ChatView.tsx` — extend `narratorTickers` filter to include `TickerCategories.SOCIAL_PHASE`
- `apps/game-server/src/push-triggers.ts` — phase-open push handler; no per-post pushes
- `apps/game-server/src/machines/actions/l2-day-resolution.ts` (or wherever `processTimelineEvent` lives) — handle the two new timeline actions, raise to L3
- `apps/client/src/shells/pulse/components/chat/ChatView.tsx` (or shell-equivalent) — render path for CONFESSION channel
- `apps/client/src/shells/pulse/components/composer/` — composer for CONFESSION channel: text-only input, "Drop an anonymous confession..." placeholder, no silver/nudge/react controls, **character counter enforcing the 280-char limit** (visual + disable send past threshold; client-side mirror of the server validator)
- `apps/client/src/cartridges/prompts/ConfessionPrompt.tsx` — REWRITE as `ConfessionMatch.tsx` (or keep filename, change content): renders assigned handle + posts list + roster picker + reveal results
- `apps/client/src/store/useGameStore.ts` (or equivalent) — hydrate `confessionPhase` from SYNC. Client-facing shape after per-recipient projection:
  ```ts
  confessionPhase: {
    active: boolean;
    myHandle: string | null;   // set on phase open if the client is an alive member; null otherwise
    handleCount: number;       // public — number of handles in the phase
    posts: Array<{ handle: string; text: string; ts: number }>;
  }
  ```
  The full `handlesByPlayer` map and the cartridge's `handleAuthorIds` mapping are NEVER in this shape.
- `apps/lobby/app/admin/games/_lib/manifest.ts` (or schema validator) — accept the new timeline action strings + ruleset block
- `apps/game-server/src/demo/` — **required investigation** per CLAUDE.md "after L3 changes, check DemoServer" rule. Concrete steps: (a) grep DemoServer for any manifest fixtures that reference `activityLayer` or prompt types; (b) run DemoServer locally and verify the new `activityLayer.loading` sub-state doesn't affect the synthetic game's flow; (c) decide explicitly "no changes needed" or "update fixtures to add a confession phase for demo content." Budget: not a grep-and-forget; a 15-min check with a logged outcome.

## Data flow

### Phase open

1. Manifest timeline event `{ time, action: 'START_CONFESSION_CHAT' }` fires at scheduled time
2. L1 alarm → L2 `processTimelineEvent` → raises `INTERNAL.START_CONFESSION_CHAT` to L3
3. L3 ruleset guard: if `ruleset.confessions?.enabled !== true`, log `gm-confessions skip { reason: 'disabled' }` and remain in `idle`
4. L3 alive-count guard: if alive players < 2, log skip with `reason: 'insufficient-players'` and remain in `idle`
5. L3 `confessionLayer: idle → posting`. Entry actions, in order:
   - `assignConfessionHandles({ context })` — deterministic shuffle of alive playerIds, assign to `"Confessor #1"`..`"Confessor #N"`. Seed: `${gameId}:${dayIndex}:confession`. Result stored in `confessionPhase.handlesByPlayer`.
   - `openConfessionChannel({ context })` — append channel to `context.channels`:
     ```ts
     {
       id: `CONFESSION-d${dayIndex}`,
       type: 'CONFESSION',
       memberIds: [...aliveIds],
       createdBy: 'SYSTEM',
       createdAt: Date.now(),
       capabilities: ['CONFESS'],
     }
     ```
   - `pauseGroupChatForConfession` — `assign({ groupChatOpen: false })` (matches existing pause pattern; `mainStage.groupChat` continues to swallow `SOCIAL.SEND_MSG` events as already-blocked)
   - `setConfessionPhaseActive` — `assign({ confessionPhase: { ...context.confessionPhase, active: true, posts: [] } })`
   - `emitConfessionPhaseStartedFact` — raise a `FactTypes.CONFESSION_PHASE_STARTED` system fact (NEW — small addition; payload `{ dayIndex, channelId }`). Drives the ticker narrator line via the existing fact pipeline.
   - `sendParent({ type: 'PUSH.PHASE', trigger: 'CONFESSION_OPEN' } as any)` — entry action (same batch); triggers push broadcast to all alive players via the existing push-phase pipeline. Distinct from the fact emission above because the push path is opt-in per-trigger, not driven by fact-pipeline `handleFactPush` (which returns `null` for this fact — see pipeline table in "Player POSTs" section).
6. SYNC broadcast on context change. `buildSyncPayload(deps, pid, ...)` runs per-recipient and reduces `confessionPhase` to `{ active: true, myHandle: handlesByPlayer[pid] ?? null, handleCount: N, posts: [] }` before emitting the WS payload. Clients never see another player's handle assignment. The new CONFESSION channel is added to their `channels` map (they are members).

### Player POSTs a confession

1. Client sends `{ type: 'CONFESSION.POST', channelId: 'CONFESSION-d2', text }`
2. L1 injects `senderId`, forwards to L2, L2 forwards to L3 (existing routing — `Events.Confession.PREFIX` matches the catch-all forwarder pattern)
3. L3 routes to `confessionLayer.posting` handler. Validation chain:
   - Channel exists in `context.channels`: reject if not (logged as `CHANNEL.REJECTED`, reason `channel-not-found`)
   - Channel type is `CONFESSION` and the layer is in `posting`: reject if not (reason `wrong-channel-type` or `phase-not-active`)
   - Channel `capabilities` includes `'CONFESS'`: reject if not (reason `capability-missing`)
   - `senderId` is in `channel.memberIds`: reject if not (reason `not-a-member`) — covers players who weren't alive at phase start
   - **`senderId` is currently alive** (`context.roster[senderId]?.status === PlayerStatuses.ALIVE`): reject if not (reason `sender-eliminated`) — covers players eliminated AFTER phase start. L3 social handlers today check eliminated status on recipients/targets, NOT senders — verified by grep of `l3-social.ts`. Do not rely on an implicit block; this validator step is the local guarantor.
   - `text` length within `Config.confession.maxConfessionLength` (280 — confession-specific; tighter than `Config.chat.maxMessageLength`'s 1200, enforced at validator time): reject if not (reason `text-too-long`)
4. `recordConfession`:
   - Append `{ handle: handlesByPlayer[senderId], text, ts: Date.now() }` to `confessionPhase.posts` (no authorId in posts array — already anonymized at this layer)
   - Raise `FactTypes.CONFESSION_POSTED` fact via `sendParent({ type: 'FACT.RECORD', fact: { type: 'CONFESSION_POSTED', actorId: senderId, payload: { channelId, handle, text, dayIndex }, timestamp } })`
5. Fact pipeline (L2) — behaviors for all three new fact types:

   | Fact type | `applyFactToRoster` | `persistFactToD1` | `factToTicker` | `handleFactPush` |
   |---|---|---|---|---|
   | `CONFESSION_POSTED` | no-op | writes row with `actorId` (load-bearing for match cartridge) + payload | returns `null` (policy: silence during phase to avoid timing-based deanonymization) | returns `null` (policy: spam + deanonymization) |
   | `CONFESSION_PHASE_STARTED` | no-op | writes row (telemetry) | returns ticker entry with `category: TickerCategories.SOCIAL_PHASE` and text `"The confession booth is open."` | returns `null` — push is triggered separately via the explicit `sendParent({ type: 'PUSH.PHASE', trigger: 'CONFESSION_OPEN' })` action in the phase-open entry-actions batch (step 5); double-pushing through the fact path would duplicate delivery |
   | `CONFESSION_PHASE_ENDED` | no-op | writes row (telemetry) | returns `null` (no phase-close narration — match cartridge the next day is the drum beat) | returns `null` |
6. SYNC broadcast: `confessionPhase.posts` is updated in L3 context; `buildSyncPayload` passes `posts` through unchanged (already anonymized at `recordConfession` time — only `{ handle, text, ts }` in the array, no `authorId`). The same per-recipient call also re-emits `myHandle` and `handleCount` unchanged.

**Projection responsibility split — canonical terminology used across this spec:**
- `projections.ts` handles per-fact stripping (e.g., `CONFESSION_POSTED.actorId` removed before the fact reaches the client); used by the broadcast-fact path.
- `sync.ts` `buildSyncPayload(deps, pid, ...)` handles per-recipient L3-context reduction (e.g., `handlesByPlayer` → `{ myHandle, handleCount }`); used by the SYNC payload path.
- `extractL3Context(snapshot)` (also in `sync.ts`) is the read-side extractor — pulls the L3 child's context for the builder to consume. No privacy logic lives here; it returns the server-side shape as-is. The reduction happens inside `buildSyncPayload` after extraction.

### Phase close

1. Manifest timeline event `{ time, action: 'END_CONFESSION_CHAT' }` fires
2. L1 → L2 → raises `INTERNAL.END_CONFESSION_CHAT` to L3
3. L3 `confessionLayer: posting → idle`. Exit/entry actions:
   - `closeConfessionChannel` — remove channel from `context.channels` by ID; restore `groupChatOpen=true`
   - `clearConfessionPhase` — `assign({ confessionPhase: { active: false, handlesByPlayer: {}, posts: [] } })`. The D1 archive is the persistent record; in-memory state is hygiene.
   - `emitConfessionPhaseEndedFact` — raise `FactTypes.CONFESSION_PHASE_ENDED` (NEW). Used for telemetry; no narrator line in v1 (the next-day match cartridge is the drum beat).
4. No `PUSH.PHASE` broadcast (intentional silence)
5. SYNC broadcast: channel removed from `channels` map; `confessionPhase.active=false`

### Match cartridge spawn

**Async-load architecture (resolves the "sync spawn vs async D1 read" tension).**

Current cartridge spawn is synchronous (`spawnPromptCartridge` in `l3-activity.ts` uses `assign` + `spawn`). Loading the archive from D1 is async. To keep cartridges synchronous, we insert a loading step in `activityLayer` BEFORE the existing `playing` sub-state, conditional on activity type:

```
activityLayer
  idle
    ↓ INTERNAL.START_ACTIVITY
  loading        ← NEW (only entered when activityType needs async D1 load)
    invoke: fromPromise loadConfessionArchive(gameId, sourceDayIndex)
      onDone  → playing   (archive passed to cartridge input)
      onError → playing   with `input.loadError: true` — cartridge short-circuits to COMPLETED with `results.status: 'LOAD_ERROR'`
               + log('error', 'confession', 'archive-load-failed', { sourceDayIndex, error })
  playing          (existing — unchanged for all non-loading activity types)
    ↓ done.actor / END_ACTIVITY
  completed        (existing)
    ↓ always
  idle
```

For activity types that don't need async loads (HOT_TAKE, WOULD_YOU_RATHER, etc.), the guard on the `INTERNAL.START_ACTIVITY` transition routes directly to `playing`, skipping `loading`. Only `CONFESSION_MATCH` (and future activity types needing D1 pre-reads) enters `loading`.

**Snapshot-size tradeoff.** The loaded archive becomes part of cartridge input and therefore is persisted inside the cartridge's XState context. A chatty confession phase could mean hundreds of posts × ~280 chars = ~100KB in the cartridge snapshot. Acceptable for v1 (Cloudflare DO SQL handles this easily). A future optimization could lazy-load texts inside the cartridge via its own invoked actor, keeping input minimal — deferred unless snapshot bloat becomes measurable.

**D1 failure handling (NOT silent).** If the `fromPromise` rejects or times out, the implementation MUST:
1. Emit `log('error', 'confession', 'archive-load-failed', { gameId, sourceDayIndex, error: String(err) })` — this is the Axiom-facing signal an operator needs to debug D1 outages.
2. Transition `loading → playing` with `input.loadError: true`. Cartridge's `init` short-circuits to `COMPLETED` with `results.status: 'LOAD_ERROR'`.
3. Client distinguishes `results.status`:
   - `'OK'` → normal reveal card
   - `'EMPTY'` → "The confession booth was quiet" (no posts)
   - `'LOAD_ERROR'` → "Couldn't retrieve confessions right now." (honest; operator-visible via logs)

Retry-with-backoff is NOT in v1 — keep the failure path simple and noisy. A single invocation with explicit surfacing is preferable to silent-fall-through.

**Snapshot mid-loading.** If the DO hibernates and rehydrates while the `fromPromise` is in-flight, XState's standard behavior re-invokes the promise on restore (fromPromise actors are not persisted; they're re-invoked from the invoking state's entry). This is the existing pattern for every other invoked actor in the codebase. Tested by simulating a snapshot save during `loading` entry and restoring — expect the loader to re-fire, either complete or error, and the transition to proceed normally.

**Step by step:**

1. Manifest timeline event `{ time, action: 'START_ACTIVITY' }` fires for a day whose `activityType === 'CONFESSION_MATCH'` and whose `activityConfig.sourceDayIndex` is set (e.g., to the prior day)
2. L3 `activityLayer: idle → loading` (guard: `activityType === 'CONFESSION_MATCH'`)
3. `loading.invoke.src: loadConfessionArchive` — `fromPromise` actor that calls `d1-confession-queries.loadConfessionArchive(gameId, sourceDayIndex)` against env.DB
4. On done: `loading → playing` with the loaded archive staged into the event payload → `spawnPromptCartridge` reads the archive from the staged payload and builds cartridge input
5. Cartridge input:
   ```ts
   {
     promptType: 'CONFESSION_MATCH',
     confessions: archive,
     roster: aliveRoster,
     dayIndex: currentDayIndex,
     sourceDayIndex,
     gameId,
     ruleset: { matchIncludesEliminated },
   }
   ```
6. Cartridge `init`:
   - Compute unique handles in archive
   - Build `handleAuthorIds: Map<handle, authorId>` (server-side, never projected)
   - Filter handles by `matchIncludesEliminated`: if `false`, exclude handles whose `authorId` is not in alive roster
   - Assign each alive matcher exactly ONE handle, excluding their own (algorithm below)
   - If `assignedHandleByPlayer[me]` is undefined for some player (handle pool smaller than alive matcher count after exclusions), they get no assignment — the UI renders "no handle to match this round" and they're skipped from scoring
   - Initial state: `phase: 'GUESSING'`, `guesses: {}`, `assignedHandleByPlayer`

**Handle-assignment algorithm (derangement with self-exclusion).** A naive shuffle can leave a matcher holding their own handle. Repair pass:

```ts
// matchers: alive playerIds; handles: eligible handles after matchIncludesEliminated filter
function assignHandles(matchers: string[], handles: string[], seed: string, handleAuthorIds: Map<string, string>): Record<string, string | undefined> {
  const rng = createSeededRng(seed);            // deterministic: `${gameId}:${dayIndex}:match-assignment`
  const shuffled = fisherYates([...handles], rng);
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < matchers.length; i++) out[matchers[i]] = shuffled[i];  // undefined if i ≥ shuffled.length

  // Pass 1 — fixpoint swap: any matcher pointing at their own handle swaps with the next matcher (wrap).
  for (let i = 0; i < matchers.length; i++) {
    const mid = matchers[i];
    const h = out[mid];
    if (h !== undefined && handleAuthorIds.get(h) === mid) {
      const j = (i + 1) % matchers.length;
      [out[mid], out[matchers[j]]] = [out[matchers[j]], out[mid]];
    }
  }

  // Pass 2 — null-out survivors: the swap in Pass 1 is a no-op when matchers.length === 1
  // (j = 0 = i), so a single matcher stuck with their own handle stays self-pointing.
  // It can also happen in larger groups if a swap moves another matcher's self-fixpoint
  // into the current slot. Null any remaining self-assignments; cartridge treats as "no match this round".
  for (const mid of matchers) {
    const h = out[mid];
    if (h !== undefined && handleAuthorIds.get(h) === mid) {
      out[mid] = undefined;
    }
  }

  return out;
}
```

Degenerate cases:
- **N=1, only eligible handle is own**: Pass 1 no-op (j wraps to same index), Pass 2 nulls the assignment → `assignedHandleByPlayer[mid] = undefined`. Cartridge renders "no handle to match this round" for this player.
- **N=2, handles = `[ownA, ownB]`**: Pass 1 swap yields `A→ownB`, `B→ownA`; Pass 2 no-op; both valid.
- **Eligible-handle pool empty** (all eliminated, or no posts): all matchers start undefined; Pass 1/Pass 2 both no-op; cartridge short-circuits to `COMPLETED` with `results.status: 'EMPTY'`.
- **Second-order fixpoint** (a swap introduces a new self-match due to the wrap): Pass 2 catches it. Test explicitly.
7. SYNC projects cartridge state. Each client sees:
   - `assignedHandleByPlayer[me]` (their assigned handle)
   - `confessions` filtered to only the handle they're investigating (their handle's posts as a card)
   - The roster picker (alive players + optionally eliminated per ruleset)
   - `phase: 'GUESSING'`

### Player guesses

1. Client sends `{ type: 'ACTIVITY.CONFESSION_MATCH.GUESS', confessionMatchGuess: { guessedPlayerId } }` (event named to match the registry pattern)
2. Validation:
   - Cartridge phase is `GUESSING`
   - `senderId` is in `assignedHandleByPlayer` and hasn't guessed yet
   - `guessedPlayerId` is in the eligible target pool (alive, plus eliminated if flag set)
   - `guessedPlayerId !== senderId` (can't guess yourself)
3. Record guess: `guesses[senderId] = guessedPlayerId`
4. If every player with an assignment has guessed → transition to `completed` (auto-advance, like existing prompts)
5. Forced completion: `INTERNAL.END_ACTIVITY` triggers `completed` with partial guesses (existing pattern)

### Cartridge completion + reveal

1. `calculateResults`:
   ```ts
   {
     assignedHandleByPlayer,
     guesses,
     correctMap: Record<playerId, boolean>,
     fullReveal: Array<{ handle, authorId, posts: [...] }>,
     silverRewards: Record<playerId, number>,
   }
   ```
   Where `correctMap[playerId]` = `guesses[playerId] === handleAuthorIds.get(assignedHandleByPlayer[playerId])`.
   Silver: `silverRewards[playerId] = correctMap[playerId] ? Config.prompt.confessionMatch.silverCorrect : 0`.
2. Raise `FactTypes.PROMPT_RESULT` with `promptType: 'CONFESSION_MATCH'` and the results payload (full reveal included — the post-game narrative is the reveal of every handle → author)
3. `xstate.done.actor.activePromptCartridge` bubbles up; existing L3 handler applies silver locally and forwards to L2
4. `activityLayer: playing → completed → idle` per existing flow

### Client reveal

- The cartridge result card shows:
  - "You were assigned **Confessor #3**. You guessed **Ben**. The confessor was actually **Ada**. 0 silver."
  - Below that, the full reveal grid: every handle, its real author (with avatar), and a tiny preview of their posts. The "ah-ha" moment for the table.
- `completedPhases.silverRewards` populated via the standard prompt-result rewards path. No new client persistence work.

## Edge cases

| Case | Handling |
|---|---|
| `START_CONFESSION_CHAT` fires with `ruleset.confessions.enabled !== true` | L3 logs skip, stays in `idle`. No channel created, no SYNC change. |
| `START_CONFESSION_CHAT` fires with `< 2 alive players` | L3 logs skip with `reason: 'insufficient-players'`. No state change. |
| `END_CONFESSION_CHAT` fires while `confessionLayer.idle` (orphan close) | L3 idle handler logs warning and ignores. No state change. |
| Player POSTs after phase close (race) | `posting → idle` already happened; channel destroyed; `wrong-channel-type` rejection fires. |
| Match cartridge spawns with empty archive (no posts in source day) | Cartridge init sets `phase: 'COMPLETED'` immediately, `results.status: 'EMPTY'`. Client renders "The confession booth was quiet" card. No silver awarded. |
| Match cartridge: handle pool < alive matcher count (after eliminated-author exclusions) | Some matchers receive no assignment (`assignedHandleByPlayer[me]` undefined). Their UI shows "No handle to match this round" + 0 silver. Cartridge completes when all *assigned* matchers have guessed. |
| Match cartridge: all handle authors eliminated AND `matchIncludesEliminated=false` | Handle pool is empty after filter. All matchers get no assignment. Cartridge short-circuits to `COMPLETED` with `results.status: 'EMPTY'`. |
| Match cartridge: zero matchers have an assignment (N=1 self-only, or empty pool, or pool fully collapses under Pass 2) | Cartridge short-circuits to `COMPLETED { results.status: 'EMPTY' }` at init — does NOT wait for `INTERNAL.END_ACTIVITY` timeline force-end. |
| Snapshot restore mid-`posting` | `confessionPhase` in L3 context is snapshotted; channel exists in `channels`. Resume is identity-preserving (same handles, same posts). No shim needed. |
| Snapshot restore mid-`loading` (activity layer) | `fromPromise` actors are not persisted. On rehydrate, XState re-invokes the promise from `loading.entry`. The archive query re-runs; `onDone`/`onError` fires normally; `playing` entry proceeds. |
| Eliminated player between phase open and phase close | Their channel membership persists in `memberIds` snapshot (membership is frozen at phase start). They cannot POST further because the POST validator's `sender-eliminated` step rejects any sender whose current roster status is not `ALIVE`. Already-recorded confessions stay. Relies on the v1 invariant that eliminated-stays-eliminated; revisit if unelimination is ever added. |
| Snapshot restore mid-match cartridge | Cartridge state (`assignedHandleByPlayer`, `guesses`, `phase`) snapshotted. Resume restores all. The D1 archive consulted at spawn time is already in cartridge context, so even if the source day is far in the past, resume doesn't need to re-query D1. |
| Player tries to send `SOCIAL.SEND_MSG` to CONFESSION channel | Capability check fails (`'CHAT'` not in `['CONFESS']`); `CHANNEL.REJECTED` with `reason: 'capability-missing'`. |
| Player tries to send silver to CONFESSION channel | Same — `'SILVER_TRANSFER'` not in capabilities; rejected. |
| Multiple confession phases in one game (different days) | Allowed. Each phase independent: own handles (different shuffle seed per day), own facts (different `dayIndex` in payload), own match cartridge possible. Match cartridge `sourceDayIndex` selects which phase's archive. |
| Two confession phases on same day | Allowed but bizarre. Channel ID is `CONFESSION-d{dayIndex}` — second phase reuses the same channel ID, which would conflict with snapshot restore if the first hasn't been destroyed. **Decision: forbid** at L3 — `START_CONFESSION_CHAT` while `posting` logs skip with `reason: 'phase-already-active'`. |

## Privacy invariants (must hold; tested)

0. **`handlesByPlayer` is NEVER broadcast intact.** `buildSyncPayload(deps, pid, ...)` projects it to `{ myHandle, handleCount }` per recipient. No client payload contains another player's handle assignment. Tested in `confession-fact-projection.test.ts` via multi-pid payload comparison.
1. `CONFESSION_POSTED` facts NEVER expose `actorId` to clients. `projections.ts` strips it before broadcast. Tested via `confession-fact-projection.test.ts`.
2. `confessionPhase.posts` array NEVER contains `authorId` or `actorId` — only handle/text/ts. Compile-time guarantee via type definition; runtime asserted in `confession-layer.test.ts`.
3. The CONFESSION channel's `capabilities` array NEVER includes anything besides `'CONFESS'`. Tested via `confession-channel-capabilities.test.ts`.
4. Match cartridge SYNC projection NEVER exposes `handleAuthorIds` or any handle-to-author mapping during `phase: 'GUESSING'`. Only revealed in `phase: 'COMPLETED'` results payload. Tested in `confession-match.test.ts`. **Note:** the `PROMPT_RESULT` fact raised at cartridge completion INTENTIONALLY carries the full handle→author mapping in its `results.fullReveal` payload. This is the legitimate reveal path; do NOT add a generic `actorId`-strip rule in `projections.ts` that would scrub this fact (invariant #1's strip is `CONFESSION_POSTED`-specific).
5. The match cartridge result reveal is one-shot — there is no SYNC path that exposes authorship before cartridge completion. Tested by attempting to read cartridge SYNC context mid-guessing and asserting the field is absent.

## Naming decisions

1. **Cartridge name**: rewrite `confession-machine.ts` slot, rename to `confession-match-machine.ts`. Registry entry `PromptTypes.CONFESSION` retired; `PromptTypes.CONFESSION_MATCH` added. The old vote-for-best-confession mechanic is **deleted**, not preserved alongside (no in-game manifest references it; verified via grep before delete).
2. **Phase narration**: one phase-open narrator line via `FactTypes.CONFESSION_PHASE_STARTED` → ticker. No phase-close line. No per-post lines.
3. **Lobby UX (v1)**: JSON manifest only. Visual builder for confession timeline events deferred. Ruleset toggle "Enable confessions" exposed in the existing rules section.
4. **Handle format**: `"Confessor #1"` through `"Confessor #N"` where N = alive count. Sequential numbering after deterministic shuffle. (Future iteration could swap for adjective-noun like `"the raven"` if playtests want personality.)

## Testing strategy

### Unit tests (Vitest)

- `confession-layer.test.ts`:
  - `idle → posting` on `START_CONFESSION_CHAT` (when ruleset enabled + ≥ 2 alive)
  - `idle → idle` (no transition) when ruleset disabled
  - `idle → idle` when < 2 alive
  - `posting → idle` on `END_CONFESSION_CHAT`
  - `posting → posting` (no transition) on second `START_CONFESSION_CHAT` (forbidden)
  - Entry actions execute in order: handle assignment first, then channel creation, then phase active flag
  - Exit actions clear in-memory state but don't touch D1
  - Snapshot round-trip mid-`posting` preserves all state
  - **`activityLayer` routing guard**: `START_ACTIVITY` with `activityType: 'HOT_TAKE'` (or any non-`CONFESSION_MATCH` type) goes `idle → playing` directly, skipping `loading`. Regression guard so existing activity types don't hang on the new sub-state.
  - **D1 load failure path**: when `loadConfessionArchive` rejects, `loading → playing` still fires with `input.loadError: true`; cartridge short-circuits to `COMPLETED { results.status: 'LOAD_ERROR' }`; error log emitted.
  - **Snapshot mid-loading**: simulate snapshot during `loading`; on restore, the `fromPromise` re-invokes; resolution (success or failure) transitions normally.
- `confession-handle-assignment.test.ts`:
  - Same `(gameId, dayIndex)` produces same assignment (deterministic)
  - Different `dayIndex` produces different assignment
  - All N alive players receive a unique handle
  - Handle format matches `^Confessor #\d+$`
  - Eliminated players excluded from assignment pool
  - **Match-assignment N=1 with only own eligible handle**: `assignedHandleByPlayer[mid] === undefined` after Pass 2
  - **Match-assignment N=2 with `[ownA, ownB]`**: final assignment is `A→ownB`, `B→ownA`
  - **Second-order fixpoint**: construct a seed that produces a post-swap self-match; assert Pass 2 nulls it
  - **Empty eligible-handle pool**: all matchers get `undefined`; cartridge short-circuits
- `confession-channel-capabilities.test.ts`:
  - POST to MAIN channel (not CONFESSION type) → rejected with `wrong-channel-type`
  - CONFESSION channel rejects every non-`CONFESS` capability-gated event; one case per capability in the full union:
    - `CHAT` (SOCIAL.SEND_MSG) → rejected with `capability-missing`
    - `SILVER_TRANSFER` (SOCIAL.SEND_SILVER) → rejected
    - `INVITE_MEMBER` (channel-invite attempt) → rejected
    - `REACTIONS` (SOCIAL.REACT) → rejected
    - `REPLIES` (reply to confession) → rejected
    - `GAME_ACTIONS` (any GAME.* event) → rejected
    - `NUDGE` (SOCIAL.NUDGE) → rejected
    - `WHISPER` (SOCIAL.WHISPER) → rejected
  - Non-member POSTs to CONFESSION → rejected with `not-a-member`
  - Player eliminated BEFORE phase start (never in `memberIds`) POSTs → rejected with `not-a-member`
  - **Player eliminated MID-phase (in `memberIds` but `roster[pid].status === ELIMINATED`) POSTs → rejected with `sender-eliminated`.** Dedicated test for the R3 correctness fix; confirms the local validator catches the case that `memberIds` alone does not.
- `confession-fact-projection.test.ts`:
  - `CONFESSION_POSTED` fact projection in SYNC strips `actorId`
  - D1 row preserves `actorId`
  - `factToTicker` returns null for `CONFESSION_POSTED`
  - `handleFactPush` does not push for `CONFESSION_POSTED`
  - `CONFESSION_PHASE_STARTED` → ticker entry with `category === TickerCategories.SOCIAL_PHASE`
  - `CONFESSION_PHASE_ENDED` produces no ticker line
  - **Per-recipient `handlesByPlayer` projection (PRIVACY-CRITICAL)**: build SYNC for 3 different pids against the same L3 snapshot; assert each payload's `confessionPhase.myHandle` differs and `handlesByPlayer` full map is never present
- `confession-match.test.ts`:
  - Match cartridge init: each alive player gets exactly one handle, no player assigned own handle
  - Init with empty archive → cartridge completes immediately with `results.status: 'EMPTY'`
  - Init with all-own-handle matchers (zero assignments survive Pass 2) → cartridge completes immediately with `results.status: 'EMPTY'` — does NOT wait for timeline force-end
  - Init with handle pool < alive matcher count → some matchers receive no assignment, marked clearly
  - Correct guess → silver awarded
  - Wrong guess → no silver
  - All-players-guessed auto-advance to completed
  - `INTERNAL.END_ACTIVITY` forced completion with partial guesses
  - SYNC projection during `GUESSING` does NOT contain `handleAuthorIds`; during `COMPLETED` does (in results)
  - Snapshot round-trip preserves `assignedHandleByPlayer`, `guesses`, `phase`

### Integration tests

- L3 lifecycle: phase opens → POST flows → phase closes → archive available via D1 read helper → match cartridge consumes archive → guesses → results
- L2 timeline integration: `START_CONFESSION_CHAT` fires from a real PartyWhen alarm in SMOKE_TEST preset, transitions to `posting` correctly
- Snapshot restore mid-phase + mid-cartridge tested in their respective unit suites

### E2E tests (Playwright)

- `confession.spec.ts`:
  - Two browser profiles, SMOKE_TEST DYNAMIC game with confession phase scheduled on day 2 + match cartridge on day 3
  - Day 2: phase opens → both players see the new CONFESSION channel + their assigned handle → both post 2-3 confessions each → phase closes → channel disappears, MAIN reopens
  - Day 3: match cartridge spawns → each player sees their assigned handle + its posts → each guesses → cartridge completes → results show full reveal + silver awarded
  - Privacy assertion (per-recipient): inspect each client's WS SYNC payload directly during the phase. Assert:
    - `confessionPhase.myHandle` is set for that client and matches the handle the server assigned them
    - `confessionPhase.handlesByPlayer` is **absent** from every payload (never leaks)
    - Client A's payload contains only A's `myHandle`; client B's payload contains only B's — the values differ
    - No `CONFESSION_POSTED` fact across either client's payloads contains `actorId`

### Regression

- Existing prompt cartridge tests (`HOT_TAKE`, `WOULD_YOU_RATHER`, etc.) unaffected by registry changes — verified by running full game-cartridges test suite green
- Existing channel tests (MAIN, DM, GROUP_DM) unaffected by `CONFESSION` addition — `ChannelTypes` enum extension is purely additive

## Configuration

New constants (`packages/shared-types/src/index.ts`):

```ts
Config.prompt.confessionMatch = {
  silverCorrect: 15,    // silver per correct match (calibrate vs other prompt rewards)
  silverGuess: 0,       // silver just for participating (0 = no participation reward in v1)
};

Config.confession = {
  maxConfessionLength: 280,    // chosen over Config.chat.maxMessageLength (1200) to force brevity + Twitter-feel cadence
};
```

## Observability

Structured logs (using existing `log(level, component, event, data?)`):

- `confession phase-started { dayIndex, channelId, playerCount }`
- `confession phase-ended { dayIndex, postCount, channelId }`
- `confession post-recorded { dayIndex, handle, actorId, textLength }` — actorId logged server-side for debugging only. **If any client-facing log viewer / export is ever built, this field MUST be scrubbed** (server-side Axiom access is the only legitimate consumer)
- `confession skip { reason: 'disabled' | 'insufficient-players' | 'phase-already-active' }`
- `confession match-archive-loaded { dayIndex, sourceDayIndex, postCount, durationMs }` — success path latency tracking
- `confession match-archive-load-failed { dayIndex, sourceDayIndex, error }` — **error-level log**; Axiom dashboards alert on any occurrence
- `confession match-spawned { dayIndex, sourceDayIndex, handleCount, matcherCount }`
- `confession match-empty { dayIndex, sourceDayIndex }`
- `confession match-load-error { dayIndex, sourceDayIndex }` — cartridge short-circuited due to load failure
- `confession match-result { dayIndex, correctCount, totalGuesses }`

## Risks

1. **Deanonymization via post-timing.** A player connecting at exactly the moment another player posts could correlate. Mitigation: per-post pushes are intentionally OFF; ticker silence during phase; client should not surface "you posted" toasts that another player could see. If it becomes a real attack vector in playtests, add a small server-side post-debounce (random 0–3s delay before SYNC broadcast).
2. **Empty match cartridge feels bad.** If a phase had only 1-2 posts and most matchers get no assignment, the activity feels broken. Mitigation: (a) tune the manifest to schedule match cartridges only after phases with sufficient posts (admin discretion); (b) the empty card copy is deliberately clear ("the booth was quiet") to set expectation. Could later add a server-side guard: skip match cartridge spawn if archive is empty.
3. **Snapshot mid-phase inconsistency.** If the DO restarts mid-phase, channel + handles + posts must all restore consistently. Tested explicitly. Risk is low because everything is in `confessionPhase` context, which XState snapshots atomically.
3a. **Repeated mid-loading rehydrates re-query D1.** If the DO hibernates repeatedly during a CONFESSION_MATCH archive load, the `fromPromise` re-fires on each restore. Probability is low (DOs only hibernate under idleness, and the load is ~1s). Not rate-limited in v1. If observed in production via `match-archive-loaded` duration spikes, consider a per-cartridge-instance memoization keyed by `(gameId, sourceDayIndex)`.
4. **Capability-system regressions.** Adding `'CONFESS'` to the capability union must not break existing capability checks for other channels. Mitigation: explicit unit tests for every existing capability against every existing channel type post-change.
5. **Lobby manifest validation drift.** v1 accepts JSON manifests; if the schema validator doesn't allow the new timeline actions, manifests get rejected at submit time. Mitigation: schema update lives in the same plan; tested against round-trip parsing.

## Definition of done

- [ ] All unit tests pass (file list above)
- [ ] All integration tests pass
- [ ] Playwright e2e `confession.spec.ts` green
- [ ] Privacy invariant tests (all 6 listed, #0–#5) assert correctly
- [ ] `sender-eliminated` POST validator rejects mid-phase-eliminated players; verified via dedicated unit test + grep of `l3-social.ts` re-confirms no global alive-sender check would preempt this local guard
- [ ] DemoServer state confirmed unchanged OR explicitly updated in scope
- [ ] Old `confession-machine.ts` (vote-for-best variant) deleted; no manifest references remain (grep verified)
- [ ] Lobby ruleset builder exposes the `confessions.enabled` toggle
- [ ] Lobby manifest schema validator accepts `START_CONFESSION_CHAT` / `END_CONFESSION_CHAT` timeline actions and the `day.activityConfig.sourceDayIndex` field on CONFESSION_MATCH days
- [ ] `TickerCategories.SOCIAL_PHASE` added to shared-types; `ticker.ts` routes `CONFESSION_PHASE_STARTED` into it; Pulse `ChatView.narratorTickers` filter includes it
- [ ] `results.status: 'OK' | 'EMPTY' | 'LOAD_ERROR'` surfaces with distinct client copy; verified against the three paths
- [ ] Per-recipient `confessionPhase` projection confirmed live in SYNC via the E2E privacy assertion (multi-profile)
- [ ] Per-fact `actorId` strip for `CONFESSION_POSTED` confirmed via projection test
- [ ] One real SMOKE_TEST playtest with two browser profiles confirms the phase + match flow end-to-end
- [ ] Memory entry `project_confessions.md` written (architecture summary + key invariants)
- [ ] Guardrail rule in `.claude/guardrails/` documenting the privacy invariants (DM-partner-style: enforced at type-level + runtime + e2e)

## Open questions

None blocking. Reasonable defaults applied to:
- Eliminated-author handle policy → `matchIncludesEliminated: false` (default)
- Cartridge name → `CONFESSION_MATCH` (rename, retire old)
- Narration → phase-open only, via new `TickerCategories.SOCIAL_PHASE` category
- Lobby UX → JSON manifest only in v1
- Handle format → `"Confessor #N"` numbered
- Async-load architecture → `activityLayer.loading` intermediate sub-state with `fromPromise` invoke (snapshot-size tradeoff flagged; lazy-load alternative deferred)
- `sourceDayIndex` placement → on `day.activityConfig`, not on the timeline event payload
- Handle-assignment algorithm → shuffled-then-fixpoint-swap (derangement with self-exclusion)
- `handlesByPlayer` visibility → server-only; per-recipient SYNC reduces to `{ myHandle, handleCount }`

If any of these decisions feel wrong on review, easy to revisit before plan-writing.

## Future iterations (explicitly out of scope here)

- Replies to confessions (anonymized threads)
- Reactions to confessions (anonymized emoji)
- Persistent pseudonymous handles across multiple confession phases in the same game
- Game Master scheduling confession phases dynamically (depends on GM Intelligence)
- Visual lobby builder for confession timeline events
- Adjective-noun handle generator (`"the raven"`, `"the ghost"`) instead of numbered confessors
- Spectator mode for eliminated players to read post-phase confessions
