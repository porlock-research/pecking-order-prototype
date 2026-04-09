# Server Refactor & Dynamic Days

## Goal

Refactor server.ts from a 1300-line monolith into focused modules, introduce a proper GameType shared type (replacing string matching), and lay the groundwork for dynamic day resolution. Each phase is independently deployable with verification gates between them.

## Constraints

- Zero regressions to the playtest-proven Pecking Order game
- Remove DEBUG_PECKING_ORDER and standard PECKING_ORDER game modes (they were scheduling strategies, not game types)
- Build toward a future where game types are self-contained packages (like cartridges)
- Every phase ends with: `npm run build` + speed run + e2e tests passing

## Current State

### server.ts (1331 lines) — 5 responsibilities in one file

| Responsibility | Lines (approx) | Key methods |
|---|---|---|
| Lifecycle & persistence | ~200 | `onStart`, `constructor`, `wakeUpL2` |
| Scheduling | ~60 | `scheduleManifestAlarms` |
| HTTP API | ~300 | `handleInit`, `handleAdmin`, `handleCleanup`, `handleGetState`, `handlePlayerJoined`, `handlePushGameEntry`, `handleFlushTasks`, `handleScheduledTasks` |
| WebSocket | ~250 | `onConnect`, `onMessage`, `onClose`, presence, typing |
| Subscription callback | ~200 | `actor.subscribe(...)` — sync, ticker, push, D1, gold payout |

### Game modes — 3 modes, but really 1 game + 2 scheduling strategies

| Current `gameMode` | Reality | Branches in code |
|---|---|---|
| `PECKING_ORDER` | Hardcoded 2-day test schedule | 2 (l2-timeline.ts, server.ts) |
| `DEBUG_PECKING_ORDER` | Admin-triggered scheduling | 4 (l2-timeline.ts) |
| `CONFIGURABLE_CYCLE` | Lobby-configured schedule | 3 (l2-timeline.ts, server.ts) |

All 3 play the same game. The `if (gameMode === ...)` branches are scattered across `l2-timeline.ts` (4 checks) and `server.ts` (2 checks).

---

## Phase 1: Extract server.ts into focused modules

**Goal**: server.ts goes from ~1300 lines to ~300 lines. Zero behavioral changes.

### New files

**`apps/game-server/src/scheduling.ts`**
- `scheduleManifestAlarms(ctx, manifest)` — current scheduling logic
- `scheduleDayAlarms(ctx, day)` — schedule alarms for a single day (new, prep for dynamic days)
- Types: `SchedulingContext { scheduler, storage }`
- server.ts calls these instead of owning the logic

**`apps/game-server/src/http-handlers.ts`**
- All `handle*` methods extracted as standalone functions
- Each takes a context object: `{ actor, env, scheduler, ... }`
- server.ts `onRequest` dispatches to these

**`apps/game-server/src/ws-handlers.ts`**
- `onConnect`, `onMessage`, `onClose` logic
- Presence management (`connectedPlayers`, `broadcastPresence`)
- Typing relay
- server.ts delegates to these

**`apps/game-server/src/subscription.ts`**
- The `actor.subscribe(...)` callback body
- Sync broadcast, ticker, push notifications, D1 game-end writes, gold payout
- Takes a context object with all the state it needs

### server.ts becomes

```
Class shell (~300 lines):
  - State declarations (actor, scheduler, tickerHistory, etc.)
  - constructor
  - onStart (persistence + actor creation — already refactored to SQL)
  - Thin delegation methods (onRequest → http-handlers, onConnect/onMessage/onClose → ws-handlers)
  - The .provide() block (platform capabilities injected into L2)
  - Subscription setup (calls subscription.ts)
```

### Verification

- `npm run build` — no type errors
- `npm run test` (vitest) — event-coverage test passes
- Speed run — full game cycle, identical behavior
- e2e: `npx playwright test e2e/tests/game-lifecycle.spec.ts` — passes
- Manual: create game via API, send chat/DM/vote via WebSocket, inspect snapshot

---

## Phase 2: GameType shared type + remove dead game modes

**Goal**: Replace `gameMode` string matching with a typed `GameType` enum. Remove `DEBUG_PECKING_ORDER` and `PECKING_ORDER` (hardcoded) modes. Add `scheduling` strategy field.

### Changes to shared-types

```ts
// New: GameType enum (replaces gameMode string matching)
export const GameTypeSchema = z.enum(['PECKING_ORDER']);
export type GameType = z.infer<typeof GameTypeSchema>;

// New: Scheduling strategy (orthogonal to game type)
export const SchedulingStrategySchema = z.enum(['ADMIN', 'PRE_SCHEDULED']);
export type SchedulingStrategy = z.infer<typeof SchedulingStrategySchema>;

// Updated manifest
export const GameManifestSchema = z.object({
  id: z.string().optional(),
  gameType: GameTypeSchema,
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
});
```

Note: `GameTypeSchema` already exists in shared-types for game cartridges (TRIVIA, GAP_RUN, etc.). The new game-level type needs a different name to avoid collision — use `GameModeSchema` → `GameType` or rename the cartridge-level one. Check the existing name and decide.

### Changes to l2-timeline.ts

Replace `if (gameMode === ...)` branches with `scheduling` strategy:

```ts
// Before
if (context.manifest?.gameMode === 'DEBUG_PECKING_ORDER') { return null; }
if (context.manifest?.gameMode === 'CONFIGURABLE_CYCLE') { ... }

// After
if (context.manifest?.scheduling === 'ADMIN') { return null; }
// All non-ADMIN modes use the same scheduling logic (the current CONFIGURABLE_CYCLE path)
```

The `CONFIGURABLE_CYCLE` scheduling logic becomes the default. The `PECKING_ORDER` hardcoded 2-day manifest is removed — the lobby already generates proper manifests.

### Changes to server.ts (scheduling.ts after Phase 1)

Same pattern — replace `gameMode` checks with `scheduling` checks.

### Changes to lobby

- `buildManifestDays`: remove `PECKING_ORDER` hardcoded branch, remove `DEBUG_PECKING_ORDER` branch
- Game creation always uses the configurable path
- Add `scheduling` field to manifest output (defaults to `PRE_SCHEDULED`)
- Admin "debug mode" in lobby sets `scheduling: 'ADMIN'` instead of `gameMode: 'DEBUG_PECKING_ORDER'`

### Backward compatibility

Old manifests with `gameMode: 'CONFIGURABLE_CYCLE'` should still work. The migration:
- Read `gameMode` if present, map to new fields:
  - `CONFIGURABLE_CYCLE` → `gameType: 'PECKING_ORDER'`, `scheduling: 'PRE_SCHEDULED'`
  - `DEBUG_PECKING_ORDER` → `gameType: 'PECKING_ORDER'`, `scheduling: 'ADMIN'`
  - `PECKING_ORDER` → `gameType: 'PECKING_ORDER'`, `scheduling: 'PRE_SCHEDULED'`
- Or: keep `gameMode` on the schema with `.optional()` for one release cycle, then remove

### E2E fixture update

`game-setup.ts` `buildManifest` currently sets `gameMode: 'CONFIGURABLE_CYCLE'`. Update to new schema.

### Verification

- `npm run build` — all packages
- `npm run test` — vitest passes
- Speed run — identical behavior
- e2e: all tests pass with updated fixtures
- Verify: lobby can create games with both `PRE_SCHEDULED` and `ADMIN` scheduling

---

## Phase 3: Dynamic day resolution

**Goal**: Days are computed at transition time based on game state, not looked up from a static array.

### Core: `resolveDay` pure function

```ts
// apps/game-server/src/machines/actions/resolve-day.ts (or in the future, inside PO package)

interface DayResolutionInput {
  dayIndex: number;
  roster: Record<string, SocialPlayer>;  // current state (who's alive)
  totalPlayerCount: number;              // how many started
  gameHistory: GameHistoryEntry[];
  completedPhases: CompletedPhase[];
  manifest: GameManifest;                // has days[] and optional rules
}

/**
 * Resolve the shape of the next day.
 * If manifest has static days for this dayIndex, returns it.
 * If manifest has rules, computes the day dynamically.
 * Pure function — no side effects, highly testable.
 */
export function resolveDay(input: DayResolutionInput): DailyManifest { ... }
```

This function handles:
- **Day count**: If 6 players configured but 5 joined → 4 days (players - 1, capped at configured count)
- **Last day = FINALS**: Always. Regardless of what was configured.
- **Vote progression**: Can follow a configured sequence or use rules
- **DM character scaling**: Decrease over the tournament
- **Game type selection**: Per-day or from a pool

### L2 changes

New action in `morningBriefing`:

```ts
morningBriefing: {
  entry: [
    'incrementDay',
    'resolveCurrentDay',       // NEW — computes and stores the day
    'clearRestoredChatLog',
    raise({ type: 'PUSH.PHASE', trigger: 'DAY_START' })
  ],
  always: 'activeSession'
},
```

`resolveCurrentDay` action:
- Calls `resolveDay()` with current context
- Appends resolved day to `manifest.days` (or a `resolvedDays` array)
- The resolved day is now in the snapshot for inspection

`activeSession` invoke input change:
```ts
// Before: static lookup
manifest: context.manifest?.days.find(d => d.dayIndex === context.dayIndex),

// After: use the just-resolved day
manifest: context.manifest?.days.find(d => d.dayIndex === context.dayIndex),
// (same code — resolveCurrentDay already put it there)
```

### DailyManifest additions (optional social config)

```ts
export const DailyManifestSchema = z.object({
  dayIndex: z.number(),
  theme: z.string(),
  voteType: VoteTypeSchema,
  gameType: GameTypeSchema.default("NONE"),
  gameMode: z.enum(["SOLO", "LIVE"]).optional(),
  timeline: z.array(TimelineEventSchema),
  // NEW: social parameters (optional, backward-compatible defaults)
  dmCharsPerPlayer: z.number().optional(),    // default: 1200
  dmPartnersPerPlayer: z.number().optional(), // default: 3
});
```

### L3 changes (minimal)

L3 reads social config from input instead of hardcoded constants:

```ts
// L3 context initialization
context: ({ input }) => ({
  ...existing,
  dmCharsLimit: input.manifest?.dmCharsPerPlayer ?? 1200,  // was hardcoded
  dmPartnersLimit: input.manifest?.dmPartnersPerPlayer ?? 3, // was hardcoded
})
```

Guards (`isDmAllowed`, etc.) read from context instead of constants. Defaults maintain backward compatibility.

### L2 context: totalPlayerCount

Add to `GameContext`:
```ts
totalPlayerCount: number;  // set once at init, never changes
```

Set in `initializeContext`:
```ts
totalPlayerCount: Object.keys(event.payload.roster).length,
```

Used by `resolveDay` to compute day count: `Math.min(totalPlayerCount - 1, manifest.days.length)`.

### Unit tests for resolveDay

```ts
// apps/game-server/src/machines/actions/__tests__/resolve-day.test.ts

describe('resolveDay', () => {
  it('reduces day count when fewer players join', () => {
    // 6-day manifest, but only 5 players → 4 days
    const result = resolveDay({ dayIndex: 1, totalPlayerCount: 5, ... });
    // totalDays should be 4
  });

  it('always makes last day FINALS', () => {
    const result = resolveDay({ dayIndex: 4, totalPlayerCount: 5, ... });
    expect(result.voteType).toBe('FINALS');
  });

  it('scales DM characters down over tournament', () => {
    const day1 = resolveDay({ dayIndex: 1, ... });
    const day3 = resolveDay({ dayIndex: 3, ... });
    expect(day3.dmCharsPerPlayer).toBeLessThan(day1.dmCharsPerPlayer);
  });

  it('falls back to static days when no rules provided', () => {
    // manifest has days[] but no rules → returns days[dayIndex] unchanged
  });
});
```

### Verification

- `npm run build` — all packages
- `npm run test` — vitest passes, including new resolveDay tests
- Speed run with dynamic days enabled — verify day count adjusts, DM limits decrease
- Speed run with static days — verify backward-compatible behavior unchanged
- e2e: all existing tests pass (they use static days)
- Manual: create 6-player game with only 4 joining, verify game runs 3 days + FINALS
- Inspect snapshot: `sqlite3 <do>.sqlite "SELECT value FROM snapshots WHERE key = 'game_state';" | python3 -m json.tool` — verify resolved days visible

---

## Phase 4 (Future): Game type package extraction

Not part of this plan. Tracked in `plans/architecture/granular-orchestration.md`.

When motivated (second game type, or significant PO refactoring):
- Move L2, L3, actions, cartridges, persistence, sync into `packages/game-types/pecking-order/`
- Define platform interface from what remains in server.ts
- Each game type exports: machine, persistence, syncProjection, manifestSchema

---

## Files Overview

### Phase 1 (server.ts extraction)

| File | Status | Purpose |
|------|--------|---------|
| `apps/game-server/src/server.ts` | Simplify | Thin shell (~300 lines) |
| `apps/game-server/src/scheduling.ts` | NEW | Alarm scheduling logic |
| `apps/game-server/src/http-handlers.ts` | NEW | All HTTP endpoint handlers |
| `apps/game-server/src/ws-handlers.ts` | NEW | WebSocket connect/message/close + presence |
| `apps/game-server/src/subscription.ts` | NEW | Actor subscription callback (sync, ticker, push, D1) |

### Phase 2 (GameType + scheduling)

| File | Status | Purpose |
|------|--------|---------|
| `packages/shared-types/src/index.ts` | Modify | Add GameType, SchedulingStrategy types |
| `apps/game-server/src/machines/actions/l2-timeline.ts` | Modify | Replace gameMode branches with scheduling |
| `apps/game-server/src/scheduling.ts` | Modify | Replace gameMode branches |
| `apps/lobby/app/actions.ts` | Modify | Update manifest generation |
| `e2e/fixtures/game-setup.ts` | Modify | Update test manifest |

### Phase 3a (types + manifest union) — COMPLETE

| File | Status | Purpose |
|------|--------|---------|
| `packages/shared-types/src/index.ts` | DONE | Discriminated manifest union, GameRuleset, SchedulePreset, social params |
| `apps/game-server/src/machines/actions/l2-initialization.ts` | DONE | normalizeManifest on init |
| `apps/game-server/src/snapshot.ts` | DONE | normalizeManifest on restore |
| `apps/lobby/app/actions.ts` | DONE | Emit `kind: 'STATIC'` |
| `e2e/fixtures/game-setup.ts` | DONE | Emit `kind: 'STATIC'` |
| `.claude/commands/speed-run.md` | DONE | Emit `kind: 'STATIC'` |
| `apps/game-server/src/machines/l3-session.ts` | DONE | Extract buildL3Context, read social params from manifest |
| `apps/game-server/src/machines/actions/l3-social.ts` | DONE | Use context limits instead of constants |

### Phase 3b (director actor + dynamic days) — COMPLETE (superseded by 3d)

| File | Status | Purpose |
|------|--------|---------|
| `apps/game-server/src/machines/game-master.ts` | DONE | Originally `director.ts` — renamed + extended in Phase 3d |
| `apps/game-server/src/machines/__tests__/game-master.test.ts` | DONE | 28 tests (resolution + whitelist + actor behavior) |
| `apps/game-server/src/machines/actions/l2-day-resolution.ts` | DONE | spawnGameMasterIfDynamic, sendAndCaptureGameMasterDay, forwardFactToGameMaster, processGameMasterActions, guards |
| `apps/game-server/src/machines/l2-orchestrator.ts` | DONE | Game Master spawn at preGame, lifecycle events, guard consolidation |

### Phase 3c (lobby integration + whitelist resolution) — COMPLETE

| File | Status | Purpose |
|------|--------|---------|
| `packages/shared-types/src/index.ts` | DONE | `allowed` whitelist arrays on voting/games/activities rules; `activityType` on DailyManifest + GameHistoryEntry |
| `apps/game-server/src/machines/game-master.ts` | DONE | Whitelist-based resolution: `resolveVoteType`, `resolveGameType`, `resolveActivityType` check `allowed` before `sequence`/`pool` |
| `apps/game-server/src/machines/__tests__/game-master.test.ts` | DONE | 8 new whitelist resolution tests (28 total) |
| `apps/lobby/app/page.tsx` | DONE | Static/Dynamic toggle, `manifestKind` state, conditional panel rendering |
| `apps/lobby/app/components/DynamicRulesetBuilder.tsx` | DONE | Ruleset builder UI (whitelists, social scaling, inactivity, day count, schedule preset) |
| `apps/lobby/app/actions.ts` | DONE | `createGame()` builds `DynamicManifest` with empty `days[]` + populated `ruleset` |

### Phase 3d (Game Master + inactivity rules) — COMPLETE

| File | Status | Purpose |
|------|--------|---------|
| `apps/game-server/src/machines/game-master.ts` | DONE | Renamed director → Game Master. Long-lived lifecycle (pregame → tournament → postgame). Modular observations. |
| `apps/game-server/src/machines/observations/types.ts` | DONE | `ObservationModule<TState>` contract (pure functions) |
| `apps/game-server/src/machines/observations/inactivity.ts` | DONE | Inactivity module: tracks activity, produces ELIMINATE actions. Uses `Record<string, true>` (not Set) for JSON serialization. |
| `apps/game-server/src/machines/actions/l2-day-resolution.ts` | DONE | `sendAndCaptureGameMasterDay` (direct `.send()` for sync processing), `processGameMasterActions`, lifecycle sends |
| `apps/game-server/src/machines/l2-orchestrator.ts` | DONE | Game Master registered as `gameMasterMachine` in `setup({ actors })` for snapshot restoration. Spawn at preGame, lifecycle events at morningBriefing/nightSummary/gameSummary |

### Timeline generation + alarm pipeline — COMPLETE

| File | Status | Purpose |
|------|--------|---------|
| `packages/shared-types/src/index.ts` | DONE | `startTime` on DynamicManifest, `nextDayStart` on DailyManifest |
| `apps/game-server/src/machines/timeline-presets.ts` | NEW | `generateDayTimeline()`, `computeNextDayStart()`, preset configs (DEFAULT, COMPACT, SPEED_RUN) |
| `apps/game-server/src/machines/__tests__/timeline-presets.test.ts` | NEW | 10 tests covering all presets + nextDayStart computation |
| `apps/game-server/src/machines/game-master.ts` | DONE | `resolveDay()` calls timeline generator, produces `nextDayStart` |
| `apps/game-server/src/scheduling.ts` | DONE | Schedule `startTime` alarm for dynamic manifests, `nextDayStart` alarms per day |
| `apps/game-server/src/server.ts` | DONE | Re-schedule alarms in `onAlarm()` after WAKEUP for dynamic manifests |
| `apps/lobby/app/components/DynamicRulesetBuilder.tsx` | DONE | Start time picker with "Set to now + 2 min" button for SPEED_RUN |
| `apps/lobby/app/actions.ts` | DONE | `startTime` in dynamic manifest payload |
| `apps/lobby/app/page.tsx` | DONE | Pass `startTime` to `createGame()` |
