# Granular Orchestration — Deploy Strategy for Live Games

## Status: Architectural Guideline (not immediate refactor)

**Decision**: The full L3 refactor is deferred. The existing Russian Doll architecture already handles the most common deploy scenario — changed L4 cartridges are ephemeral and registry-driven. L2 and L3 have been stable since Feb 26, 2026 (zero changes during the live playtest). The refactor's risk-reward doesn't justify execution now, but its principles should guide all new work.

**What to defer:**
- Extracting existing L3 regions into sub-machines (Phases 1-4 below)
- Retroactive tag application across all existing cartridges
- `sync.ts` migration to tag-based queries

**When to revisit:** When (a) tests exist for L2/L3 behavioral parity, AND (b) a new feature requires significant L3 changes, OR (c) a deploy actually breaks a live game.

---

## Context

Every code deploy restarts Durable Objects, recreating XState actors from persisted snapshots. If the machine definition changed, the snapshot may be incompatible.

**Current risk profile** (based on git history):
- **L4 cartridges** (voting/game/prompt): Change frequently. Already safe — ephemeral, registry-driven, spawn fresh each phase.
- **L3 session**: Changes occasionally. Risk exists but L3 is stable in practice. Last modified Feb 26.
- **L2 orchestrator**: Rarely changes. Same stability profile as L3.
- **L1 server**: Changes regularly but only infrastructure (push, admin, CORS). Machine definition untouched.

**Root cause (for the future)**: L3 is a monolithic parallel state machine. If it grows further (new social features, new game modes), changes to any region risk the entire snapshot. The granular orchestration pattern below prevents this by design.

**The spec says**: *"Trust the Architecture. The complexity feels heavy at first, but it pays off on Day 4 when you need to hot-fix a voting bug without kicking everyone offline."* The Russian Doll design already provides fault isolation for cartridges. This plan extends that principle to L3's internal regions.

## Architecture: Granular Orchestration

### Current (monolithic L3)

```
L2 (orchestrator) — game lifecycle, roster, economy
 L3 (big parallel machine) — 301 lines config + ~500 lines actions
      social region: always-on, DMs, channels, perks, silver guards (baked into L3)
      mainStage region: groupChat -> dailyGame -> voting (baked into L3)
           spawns voting cartridge (L4)
           spawns game cartridge (L4)
      activityLayer region: idle -> playing -> completed (baked into L3)
           spawns prompt cartridge (L4)
```

L3 owns: cartridge spawn/cleanup actions, event forwarding, domain-specific guards, DM/channel state, perk logic, silver mutation, INJECT_PROMPT handler.

### Proposed (L3 as thin orchestrator)

```
L2 (orchestrator) — game lifecycle, roster, economy
 L3 (session router) — event routing, lifecycle orchestration, roster, chatLog
      SocialEngine (long-lived sub-machine) — DMs, channels, perks, silver transfers
      VotingOrchestrator (ephemeral sub-machine) — voting lifecycle, spawns voting L4s
      GameOrchestrator (ephemeral sub-machine) — game lifecycle, spawns game L4s
      ActivityOrchestrator (ephemeral sub-machine) — activity lifecycle, spawns prompt L4s
```

L3 becomes: event router (by namespace prefix), sub-machine lifecycle manager, chatLog + roster owner. ~100 lines of machine config.

### Two sub-machine lifecycles

**Ephemeral** (VotingOrchestrator, GameOrchestrator, ActivityOrchestrator):
- Spawned per phase (e.g., `INTERNAL.OPEN_VOTING` -> spawn VotingOrchestrator)
- Short-lived — dies when phase ends (`xstate.done.actor.*`)
- Spawns its own L4 cartridges internally
- Emits results to L3 via `sendParent()` (facts, rewards)
- Old snapshot from previous deploy? Next phase spawns fresh with new code. Non-issue.

**Long-lived** (SocialEngine):
- Spawned once at L3 init, lives until `INTERNAL.END_DAY`
- Owns the day's social state: channels, DM partners/chars, perk overrides, group DMs
- Expected to grow in complexity as social features expand
- NOT a permission-less forwarder — owns real guards (isDmAllowed, isSilverTransferAllowed, etc.)
- Receives `SOCIAL.*` events + gate events (`INTERNAL.OPEN_DMS`, `INTERNAL.CLOSE_DMS`, etc.)
- Does NOT own roster (silver balances) — receives roster as input, emits mutation intents back to L3

**Why SocialEngine doesn't own roster**: Roster silver is mutated by ALL domains (DM costs, transfers, game rewards, prompt rewards, perk costs). If SocialEngine owned it, every other sub-machine would need to coordinate with it. Instead, L3 keeps roster as shared state and applies mutations from all sub-machine events centrally. SocialEngine receives a roster snapshot as input and uses it for guards. When it needs to deduct silver (DM cost, perk, transfer), it emits an event like `{ type: 'SOCIAL.SILVER_MUTATED', mutations: [...] }` and L3 applies it.

### Why this solves deploy safety

| Concern | How it's addressed |
|---------|-------------------|
| **Mid-tournament deploy** (L2 changed) | L2 is a thin orchestrator that rarely changes. Context defaults + tags make it forward-compatible. |
| **Mid-day deploy** (L3 changed) | L3 is now a thin router (~100 lines). It almost never changes. Sub-machines are the things that change. |
| **Mid-voting deploy** (VotingOrchestrator changed) | Ephemeral — current instance finishes or recovers. Next voting phase gets new code automatically. |
| **Mid-cartridge deploy** (L4 changed) | L4s are spawned/cleared frequently. Stale snapshots are short-lived. |
| **Social feature deploy** (SocialEngine changed) | SocialEngine is long-lived BUT isolated. Its snapshot only contains social state. Context defaults + tags handle forward compat. |
| **New context fields** | Each sub-machine defines its own context with defaults. Old snapshots merge cleanly. |
| **New features** | Add as new sub-machines or new states in existing sub-machines. L3 router just adds event prefix routing. |

### Event-driven routing as the contract

L3 routes events by namespace prefix. The routing table is the API contract:

```ts
// L3 event routing (conceptual) — uses existing Events.*.PREFIX constants
'VOTE.*'     -> sendTo('voting-orchestrator')    // Events.Vote.PREFIX
'GAME.*'     -> sendTo('game-orchestrator')      // Events.Game.PREFIX
'ACTIVITY.*' -> sendTo('activity-orchestrator')  // Events.Activity.PREFIX
'SOCIAL.*'   -> sendTo('social-engine')          // Events.Social.PREFIX (new)
'INTERNAL.*' -> handle locally (lifecycle events from L2)
'FACT.*'     -> sendParent (forward to L2)
```

Adding new event types within a namespace doesn't require L3 changes. The wildcard prefix matching already exists in L3 (`'*'` guard with `startsWith(Events.Vote.PREFIX)`).

### Sub-machine persistence (mid-phase recovery)

Rely on XState's deep persistence. Since sub-machines are spawned children of L3, `getPersistedSnapshot()` already captures them in the `children` map. On restore, XState re-spawns them from that map. Requirements:
- Each sub-machine's registry key (e.g., `'voting-orchestrator'`) must stay in L3's `actors` map permanently
- Sub-machine context fields must have defaults (for forward compat)
- Sub-machine states must use tags for behavioral queries (not `state.matches()`)

## Centralized Tags (`StateTags`)

### Location & pattern

Add to `packages/shared-types/src/events.ts` following the existing `as const` object pattern used by `Events`, `FactTypes`, `VotingPhases`, etc. No raw tag strings anywhere — all consumers import from `StateTags`.

```ts
export const StateTags = {
  // L2 orchestrator
  L2: {
    PRE_GAME: 'l2:pre-game',
    DAY_ACTIVE: 'l2:day-active',
    NIGHT: 'l2:night',
    GAME_OVER: 'l2:game-over',
    POST_GAME: 'l2:post-game',
  },
  // L3 session router
  L3: {
    RUNNING: 'l3:running',
    FINISHING: 'l3:finishing',
    SOCIAL_ACTIVE: 'l3:social-active',
    VOTING_ACTIVE: 'l3:voting-active',
    GAME_ACTIVE: 'l3:game-active',
    ACTIVITY_ACTIVE: 'l3:activity-active',
    DMS_OPEN: 'l3:dms-open',
    GROUP_CHAT_OPEN: 'l3:group-chat-open',
  },
  // Cartridge-level (shared across all cartridge types)
  Cartridge: {
    ACTIVE: 'cartridge:active',
    COMPLETED: 'cartridge:completed',
    ACCEPTING_INPUT: 'cartridge:accepting-input',
    CALCULATING: 'cartridge:calculating',
  },
  // Voting-specific
  Voting: {
    COLLECTING_VOTES: 'voting:collecting',
    CLOSED: 'voting:closed',
  },
  // Game-specific
  Game: {
    LOADING: 'game:loading',
    PLAYING: 'game:playing',
    WAITING: 'game:waiting',
  },
  // Prompt-specific
  Prompt: {
    COLLECTING: 'prompt:collecting',
    VOTING_PHASE: 'prompt:voting',
    GUESSING: 'prompt:guessing',
  },
} as const;
```

### Why tags on cartridges too

Tags on cartridges serve two purposes:
1. **Projection logic** (`sync.ts`): Instead of `state.matches('active')` (which breaks if state is renamed), use `hasTag(StateTags.Cartridge.ACTIVE)`. This is especially important because different cartridges use different state names for equivalent phases (e.g., `active` vs `electing` vs `calculating`).
2. **Deploy safety**: Adding a new state to a cartridge is always safe if the behavioral intent is expressed via tags. Old snapshots in old states still have correct tags. New states can add new tags without breaking existing queries.

### Application across all machines

| Machine | Tags to add |
|---------|-------------|
| L2 orchestrator | `StateTags.L2.*` on each top-level state |
| L3 session | `StateTags.L3.*` on running/finishing + sub-machine presence |
| Voting cartridges (8 types) | `StateTags.Cartridge.ACTIVE/COMPLETED` + `StateTags.Voting.*` |
| Game cartridges (12+ types) | `StateTags.Cartridge.ACTIVE/COMPLETED` + `StateTags.Game.*` |
| Prompt cartridges (6 types) | `StateTags.Cartridge.ACTIVE/COMPLETED` + `StateTags.Prompt.*` |
| Orchestrators (new) | `StateTags.Cartridge.*` (they follow the cartridge pattern) |

## Implementation Plan

### Phase 0: Foundation (zero behavioral change)

All work in this phase is additive. No state machine behavior changes. No regressions possible.

**0a. KV -> SQL migration** — Move snapshot from opaque KV to queryable SQL (`snapshots` table). Fixes ADMIN-001.

**0b. `StateTags` const in shared-types** — Add the `StateTags` object to `events.ts`. No machine changes yet.

**0c. Tags on L2/L3 states** — Add `tags: [StateTags.L2.DAY_ACTIVE]` etc. to existing states. Tags are purely additive — they don't change transitions, guards, or actions.

**0d. Tags on all cartridges** — Add `StateTags.Cartridge.ACTIVE`, `StateTags.Cartridge.COMPLETED`, and domain-specific tags to all voting/game/prompt machines. Same additive-only principle.

**0e. Migrate `sync.ts` and consumers to use tags** — Replace `state.matches('active')` with `hasTag(StateTags.Cartridge.ACTIVE)` in projection logic. Behavioral parity: same output, different query mechanism.

**0f. Context defaults on L3** — Change `context: ({ input }) => ({...})` to merge with defaults object, so restored snapshots with missing fields get safe defaults instead of `undefined`.

**Verification**: `npm run build` + speed run + existing behavior unchanged.

### Phase 1: Extract ActivityOrchestrator (safest, most isolated)

The `activityLayer` parallel region is the most self-contained:
- 3 states: `idle`, `playing`, `completed`
- Spawns prompt cartridges (PROMPT_REGISTRY)
- Only handles `ACTIVITY.*` events + `INTERNAL.START_ACTIVITY` / `INTERNAL.END_ACTIVITY`
- No dependency on DM state, voting state, or game state
- Reads roster for eligible players, emits reward facts back to L3

**Steps**:
1. Create `apps/game-server/src/machines/orchestrators/activity-orchestrator.ts`
2. Register `'activity-orchestrator'` in L3's `actors` map (permanent key)
3. Replace L3's `activityLayer` parallel region: spawn `activity-orchestrator` on L3 init
4. L3 forwards `ACTIVITY.*` + `INTERNAL.START_ACTIVITY` + `INTERNAL.END_ACTIVITY` to child
5. Update `sync.ts`: extract prompt cartridge through orchestrator child layer

### Phase 2: Extract VotingOrchestrator + GameOrchestrator

Same pattern as Phase 1, applied to `mainStage`.

### Phase 3: Extract SocialEngine (most complex, deferred until Phases 1-2 proven)

Can be deferred indefinitely. Phases 1-2 already provide significant deploy safety for the most change-prone areas.

### Phase 4: Finalize L3 as thin router

After all extractions, L3 is ~100-150 lines of config: event router, sub-machine lifecycle manager, chatLog + roster owner.

## Design Conventions

1. **State names are immutable** — never rename. Change behavior via actions/guards.
2. **Context fields are additive** — always have defaults. Never remove mid-tournament.
3. **Registry keys are permanent** — never delete from `actors` maps. Deprecate with stub machines.
4. **Tags for behavioral queries** — consumers use `hasTag(StateTags.X)`, not `state.matches('x')`. All tags are `StateTags.*` constants from shared-types. No raw strings.
5. **Event namespacing is the routing contract** — `Events.Vote.PREFIX`, `Events.Game.PREFIX`, `Events.Activity.PREFIX`, `Events.Social.PREFIX`. All from `events.ts`.
6. **Sub-machines follow the cartridge pattern** — spawn, receive events, emit results, cleanup.
7. **Roster mutations are centralized** — L3 owns roster. Sub-machines emit intent events, L3 applies.

## Defensive Restore Logic (belt-and-suspenders)

1. **Context normalizer** — fill missing fields with defaults before `createActor()`. Each machine defines a `defaultContext` export.
2. **Dead child cleanup** — on restore, remove children whose `src` key isn't in the current `actors` registry.
3. **CI drift detection** — extend `generate-machine-docs.ts` to include tags. Compare generated docs across deploys to catch removed states/keys.

## Testing Gap (the real prerequisite)

The biggest blocker to any structural refactor isn't the plan — it's the absence of behavioral tests for L2/L3. Without tests, any change is a leap of faith.

**What needs testing before any L3 extraction:**
1. L2 lifecycle test
2. L3 activity lifecycle test
3. L3 voting lifecycle test
4. L3 game lifecycle test
5. L3 social guards test
6. SYNC payload snapshot test

**Testing approach**: XState v5 actors can be tested by creating them with `createActor(machine)`, sending events, and asserting state/context. No HTTP/WebSocket infrastructure needed for unit tests.

## Conventions to Adopt Now (for new work)

Even without the full refactor, these conventions prevent future debt:
1. **New machines get `StateTags`** — when creating new voting/game/prompt cartridges, add tags from the start.
2. **New context fields always have defaults** — never rely on `input` being present for new fields.
3. **State names are permanent** — never rename states in existing machines.
4. **New L3 features -> sub-machine pattern** — if a new feature would add a parallel region to L3, implement it as a spawned sub-machine instead.
5. **Event namespacing** — new event types must use `Events.*.PREFIX` constants. No raw strings.
6. **Registry keys are permanent** — never remove entries from `VOTE_REGISTRY`, `GAME_REGISTRY`, `PROMPT_REGISTRY`.

## Migration Safety

Each phase is independently deployable and backwards-compatible. Between phases, the game works exactly as before. Each phase is a separate PR with its own tests. No phase depends on a subsequent phase — you can stop after any phase and the system is stable.
