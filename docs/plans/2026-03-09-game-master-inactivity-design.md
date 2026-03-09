# Game Master Actor + Inactivity Rules — Design

**Date**: 2026-03-09
**Status**: Approved
**Branch**: `feature/dynamic-days`
**Depends on**: Phase 3a+3b (discriminated manifest union, director actor)

## Overview

Rename the existing director actor to Game Master. Extend it with a long-lived lifecycle (pregame → tournament → postgame), a modular observation system, and inactivity-based elimination as the first observation module.

All changes are additive — static mode / CONFIGURABLE_CYCLE path is untouched.

## Isolation Guarantee

The established CONFIGURABLE_CYCLE / static manifest path is read-only during this work:

- `processNightSummary` — not modified. Game Master actions run in a separate, new action.
- `l2-orchestrator.ts` — existing states/transitions/event handlers not modified. New actions are appended (not inserted) to entry arrays, and only fire when `manifest.kind === 'DYNAMIC'`.
- `l3-session.ts` — not touched.
- L4 cartridges — not touched.
- `l2-timeline.ts`, `l2-initialization.ts`, `l2-elimination.ts`, `l2-economy.ts`, `l2-facts.ts` — not modified.

The only existing file modified beyond renames is `l2-day-resolution.ts`, which was created specifically for dynamic mode and has zero static-mode code paths.

## 1. Rename (no behavioral change)

| Before | After |
|--------|-------|
| `director.ts` | `game-master.ts` |
| `createDirectorMachine()` | `createGameMasterMachine()` |
| `buildDirectorContext()` | `buildGameMasterContext()` |
| `DirectorInput/Context` | `GameMasterInput/Context` |
| `directorRef` on L2 | `gameMasterRef` |
| `directorResolvedDay` on L2 | `gameMasterResolvedDay` |
| `l2-day-resolution.ts` action names | `spawnGameMasterIfDynamic`, `captureGameMasterDay`, `forwardFactToGameMaster`, etc. |
| `director.test.ts` | `game-master.test.ts` |

Event types move into `Events.GameMaster` namespace in shared-types.

## 2. Lifecycle

The Game Master is spawned once at `SYSTEM.INIT` (dynamic mode only) and lives until game end.

```
States:
  pregame     → entered at spawn. No-op for now (future: player introductions).
  tournament  → entered on first GAME_MASTER.RESOLVE_DAY.
  postgame    → entered on GAME_MASTER.GAME_ENDED. No-op for now.
```

L2 wiring (all behind `manifest.kind === 'DYNAMIC'`):
- `initializeContext` — spawn Game Master
- `morningBriefing` — send `Events.GameMaster.RESOLVE_DAY` with roster + dayIndex
- `activeSession` — forward `FACT.RECORD` (rename existing action)
- `nightSummary` entry — read `gameMasterActions` from snapshot
- `gameSummary` entry — send `Events.GameMaster.GAME_ENDED`

## 3. Modular Observations

Each observation concern is a pure module following a common contract:

```ts
interface ObservationModule<TState> {
  init(roster, ruleset): TState;
  onResolveDay(state, dayIndex, roster): { state: TState; actions: GameMasterAction[] };
  onFact(state, fact): TState;
  onDayEnded(state, dayIndex, roster): TState;
}
```

The Game Master machine holds module states on context. Each event handler delegates to the relevant module functions. Modules are pure — no XState dependency, fully testable standalone.

First module: `inactivityModule`. Future modules (engagement scoring, adaptive difficulty) follow the same contract.

## 4. Inactivity Module

**State shape:**

```ts
interface InactivityState {
  playerActivity: Record<string, {
    lastActiveDayIndex: number;
    consecutiveInactiveDays: number;
  }>;
  activeDuringCurrentDay: Set<string>;
}
```

**Logic (all pure functions, using typed constants):**

- `onResolveDay` — For each alive player, check `consecutiveInactiveDays >= ruleset.inactivity.thresholdDays`. If exceeded, emit `{ action: GameMasterActionTypes.ELIMINATE, playerId, reason }`. Guards: skip day 1, skip if disabled, skip if would leave < 2 alive.

- `onFact` — If `fact.actorId` is a player (not SYSTEM, not GAME_MASTER_ID), add to `activeDuringCurrentDay`.

- `onDayEnded` — For each alive player: if in `activeDuringCurrentDay`, reset `consecutiveInactiveDays` to 0 and update `lastActiveDayIndex`. Otherwise, increment. Clear `activeDuringCurrentDay`.

## 5. L2 Processing of Game Master Actions

New action `processGameMasterActions` runs at `nightSummary` entry, after `processNightSummary`. Separate action — does not modify the existing elimination pipeline.

Guards: player still alive, >= 2 would remain after elimination.

Uses `GameMasterActionTypes.ELIMINATE` (typed constant), `PlayerStatuses.ALIVE`, `FactTypes.*` — no raw string comparisons.

## 6. Types (shared-types additions)

```ts
Events.GameMaster = {
  RESOLVE_DAY: 'GAME_MASTER.RESOLVE_DAY',
  DAY_ENDED: 'GAME_MASTER.DAY_ENDED',
  GAME_ENDED: 'GAME_MASTER.GAME_ENDED',
} as const;

export const GameMasterActionTypes = {
  ELIMINATE: 'ELIMINATE',
} as const;

export interface GameMasterAction {
  action: GameMasterActionType;
  playerId: string;
  reason: string;
}
```

## 7. Testing Strategy

- **Inactivity module** — Pure function tests. No XState. Threshold, consecutive days, clearance on activity, guard against < 2 alive, day 1 skip.
- **Game Master machine** — Actor tests. State transitions (pregame → tournament → postgame), fact accumulation, resolve day handling.
- **L2 integration** — Speed run with dynamic manifest. Verify Game Master actions processed at nightSummary.
- **Existing tests** — All pass unchanged. Static mode untouched.

## 8. Files

| File | Change |
|------|--------|
| `packages/shared-types/src/index.ts` | Add `Events.GameMaster`, `GameMasterActionTypes`, `GameMasterAction` |
| `apps/game-server/src/machines/game-master.ts` | Rename from director + new lifecycle + module orchestration |
| `apps/game-server/src/machines/observations/inactivity.ts` | NEW — pure inactivity module |
| `apps/game-server/src/machines/actions/l2-day-resolution.ts` | Rename actions + new `processGameMasterActions` |
| `apps/game-server/src/machines/l2-orchestrator.ts` | Updated action/actor names, new nightSummary action |
| `apps/game-server/src/machines/__tests__/game-master.test.ts` | Rename + new lifecycle tests |
| `apps/game-server/src/machines/__tests__/inactivity.test.ts` | NEW — pure module tests |

## Key Design Decisions

1. **Single long-lived actor** — not per-day. Accumulates knowledge across the entire tournament.
2. **Uses existing Game Master identity** — `GAME_MASTER_ID`. No new concept introduced.
3. **Modular observations** — each concern is a pure module behind a common contract. Testable without XState.
4. **Generic L2 actions** — Game Master outputs actions L2 already understands (ELIMINATE). Game-specific logic stays in the Game Master.
5. **Additive only** — static mode path is frozen. All new code behind `manifest.kind === 'DYNAMIC'`.
