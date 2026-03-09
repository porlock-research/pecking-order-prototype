# Feature: Dynamic Days

**Status**: Phase 3a+3b+3c+3d complete
**Branch**: `feature/dynamic-days`
**ADRs**: [094] Dynamic Days, [066-068] CONFIGURABLE_CYCLE, [092] DO Persistence, [093] Alarm Delivery

---

## Why This Exists

Pecking Order started with static manifests — the host configures every day upfront at game creation. This works for controlled playtests and small groups, but breaks down as games scale:

1. **Day count is wrong.** An 8-slot game where only 5 join still runs 7 days. Players get bored or confused.
2. **No adaptation.** If a vote type needs 4+ players but only 3 remain alive, the game breaks or falls back silently.
3. **Social limits are frozen.** DM character limits, partner limits, and silver costs are baked in at creation. There's no way to tighten communication as the game narrows.
4. **Inactive players drag the game.** No mechanism to shorten or adjust when players disengage.
5. **Every game feels the same.** The host picks everything upfront; there's no surprise or strategic evolution.

The fix isn't to make static manifests smarter — they serve their purpose for admin-controlled playtests. Instead, we add a second manifest kind that resolves each day at runtime.

## How It Evolved

### Phase 1-2: Foundation (complete, merged to main)

The server refactor (Phase 1) extracted `server.ts` from a 1300-line monolith into focused modules. Phase 2 replaced scattered `gameMode` string matching with a typed `scheduling` strategy (`ADMIN` | `PRE_SCHEDULED`), killing the dead `PECKING_ORDER` and `DEBUG_PECKING_ORDER` modes.

These weren't dynamic days work, but they removed the tech debt that would have made dynamic days risky.

### Phase 3a: Type Foundation (complete)

The manifest became a discriminated union:

```
GameManifest = StaticManifest | DynamicManifest
```

Keyed on `kind: 'STATIC' | 'DYNAMIC'`. Every existing manifest gets `kind: 'STATIC'` — either explicitly (lobby, speed-run, E2E fixtures now emit it) or implicitly (`normalizeManifest()` adds it to legacy snapshots missing the field).

The `GameRuleset` is also a discriminated union (`PeckingOrderRuleset` as the first variant), so adding a new game type means adding a new variant, not modifying existing code.

`DailyManifest` gained optional `dmCharsPerPlayer` and `dmPartnersPerPlayer` fields. L3's `buildL3Context()` reads these with defaults matching the old hardcoded constants.

**Key decision**: No runtime behavior changed. Every game still runs exactly the same. The type system is in place; the runtime follows later.

### Phase 3b: Director Actor + L2 Wiring (complete, superseded by 3d)

The original director was a per-day XState actor spawned by L2 in dynamic mode. Phase 3d replaced it with the long-lived Game Master (see below).

### Phase 3d: Game Master + Inactivity Rules (complete)

The director was renamed to Game Master and extended with a long-lived lifecycle (pregame → tournament → postgame). Key changes:

1. **Long-lived actor.** Spawned once at `preGame` entry (dynamic mode only), lives until game end. Accumulates knowledge across the entire tournament.

2. **Modular observations.** Each observation concern is a pure-function module behind a common `ObservationModule<TState>` contract. The Game Master holds module states on context and delegates to module functions at lifecycle events.

3. **Inactivity module.** First observation module. Tracks per-player activity via `FACT.RECORD` events, evaluates consecutive inactive days against `ruleset.inactivity.thresholdDays`, produces `ELIMINATE` actions. Guards: skip day 1, skip if disabled, never leave fewer than 2 alive.

4. **Generic L2 processing.** New `processGameMasterActions` runs at nightSummary (after `processNightSummary`). Reads `gameMasterActions` from Game Master snapshot and applies eliminations. Uses typed constants (`GameMasterActionTypes.ELIMINATE`, `PlayerStatuses.ALIVE`, `FactTypes.ELIMINATION`).

L2 wiring (all behind `manifest.kind === 'DYNAMIC'`):
- `preGame` entry spawns the Game Master
- `morningBriefing` sends `GAME_MASTER.RESOLVE_DAY` → captures resolved day into `manifest.days[]`
- `activeSession` forwards `FACT.RECORD` to Game Master
- `nightSummary` runs `processGameMasterActions` → sends `GAME_MASTER.DAY_ENDED`
- `gameSummary` sends `GAME_MASTER.GAME_ENDED`

Static mode is completely untouched — the Game Master is never spawned.

### Phase 3c: Lobby Integration (complete)

The lobby gained a Static/Dynamic toggle. In dynamic mode, the per-day config is replaced by a Ruleset Builder:

1. **Whitelists.** Host selects which vote types, game types, and activity types the Game Master may use. The Game Master picks from these pools at runtime based on game state (alive count, history, variety).
2. **Social scaling.** DM characters and partners (FIXED or DIMINISHING with base/floor), DM cost, group DM toggle.
3. **Inactivity rules.** Enabled toggle, threshold days, action.
4. **Day count.** ACTIVE_PLAYERS_MINUS_ONE or FIXED, with optional max cap.
5. **Schedule preset.** DEFAULT, COMPACT, or SPEED_RUN — defines daily timing.

Lobby builds a `DynamicManifest` with empty `days[]` and a populated `ruleset` + `schedulePreset`. Same `/init` endpoint, same two-phase init as CONFIGURABLE_CYCLE.

Type changes: voting/games/activities rules gained optional `allowed` whitelist arrays. `DailyManifest` gained optional `activityType`. Resolution functions in `game-master.ts` check `allowed` before `sequence`/`pool` — fully backward compatible.

**Key fix**: XState v5 batches entry actions, so `enqueueActions` with `sendTo` queues delivery until after ALL entry actions complete. Combined send + capture into `sendAndCaptureGameMasterDay` using direct `.send()` on the spawned actor ref for synchronous processing.

## Key Architectural Decisions

### Why a discriminated union, not feature flags?

Feature flags (`isStatic: boolean`, `hasDynamicDays: boolean`) create a combinatorial explosion. A discriminated union on `kind` gives TypeScript exhaustive checking and forces every consumer to handle each variant explicitly. Adding a third manifest kind is a compile-time checklist, not a runtime bug hunt.

### Why a long-lived actor, not per-day?

The Game Master accumulates knowledge across the entire tournament — inactivity tracking, engagement scoring (future), adaptive difficulty (future). A per-day actor loses this state. The long-lived lifecycle (pregame → tournament → postgame) also enables future features like player introductions during pregame.

### Why modular observations, not inline logic?

Each observation concern (inactivity, engagement, adaptive difficulty) is a pure-function module behind a common contract. This gives us: standalone testability (no XState), independent development (add a module without touching others), and clean separation of concerns inside the Game Master.

### Why `days[]` grows instead of a separate field?

The Game Master appends each resolved day to `manifest.days[]`. This means L3's input pattern (`manifest.days.find(d => d.dayIndex === context.dayIndex)`) works identically in both modes. It also creates an audit trail — you can inspect the manifest to see every day the Game Master resolved.

### Why two game-over guards?

`isGameComplete` (used in `nightSummary`) checks `dayIndex >= days.length` — the day has finished, so `>=` is correct. `isDayIndexPastEnd` (used in `dayLoop.always`) checks `dayIndex > days.length` — the day hasn't run yet, so `>` avoids blocking the last valid day. Collapsing these into one guard caused a regression where the last day was skipped.

## Related Documents

| Document | Purpose |
|----------|---------|
| `plans/architecture/dynamic-days-design.md` | Architectural design (types, director contract, data flow) |
| `plans/architecture/2026-03-08-dynamic-days.md` | Implementation plan (10 tasks, step-by-step) |
| `plans/architecture/server-refactor-and-dynamic-days.md` | Phased roadmap (Phases 1-4) |
| `plans/architecture/granular-orchestration.md` | L3 refactor strategy (deferred, but relevant to future game types) |
| `docs/plans/2026-03-09-game-master-inactivity-design.md` | Game Master + inactivity design doc |
| `docs/plans/2026-03-09-game-master-inactivity.md` | Implementation plan (7 tasks) |
| `docs/plans/2026-03-09-phase-3c-lobby-integration-design.md` | Phase 3c design doc |
| `docs/plans/2026-03-09-phase-3c-lobby-integration.md` | Phase 3c implementation plan (7 tasks) |
| `plans/DECISIONS.md` → ADR-094 | Atomic decision record |

## Key Files

| File | Role |
|------|------|
| `packages/shared-types/src/index.ts` | `GameManifest`, `GameRuleset`, `normalizeManifest()`, `SchedulePreset` |
| `apps/game-server/src/machines/game-master.ts` | Game Master actor + lifecycle (pregame → tournament → postgame) |
| `apps/game-server/src/machines/observations/types.ts` | `ObservationModule<TState>` contract |
| `apps/game-server/src/machines/observations/inactivity.ts` | Inactivity observation module (pure functions) |
| `apps/game-server/src/machines/actions/l2-day-resolution.ts` | L2 wiring (spawn, lifecycle events, processGameMasterActions, guards) |
| `apps/game-server/src/machines/l2-orchestrator.ts` | L2 machine (Game Master lifecycle integrated) |
| `apps/game-server/src/machines/l3-session.ts` | `buildL3Context()` reads social params from manifest |
| `apps/lobby/app/page.tsx` | Lobby UI (Static/Dynamic toggle, game config) |
| `apps/lobby/app/actions.ts` | Server actions (`createGame()` builds Static or Dynamic manifest) |
| `apps/lobby/app/components/DynamicRulesetBuilder.tsx` | Ruleset builder component (whitelists, social, inactivity, schedule) |
| `apps/game-server/src/snapshot.ts` | `normalizeManifest()` on snapshot restore |
