# Game Master + Inactivity Rules Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename director → game-master, add long-lived lifecycle with modular observations, implement inactivity-based elimination as the first observation module.

**Architecture:** The Game Master is a long-lived XState actor (pregame → tournament → postgame) spawned once at SYSTEM.INIT in dynamic mode. It delegates observation concerns to pure-function modules behind a common `ObservationModule<TState>` contract. The inactivity module tracks per-player activity via forwarded FACT.RECORD events and produces ELIMINATE actions that L2 processes generically at nightSummary.

**Tech Stack:** TypeScript, XState v5, Vitest, Zod (shared-types schemas)

**Design doc:** `docs/plans/2026-03-09-game-master-inactivity-design.md`

---

## Isolation Guarantee

The CONFIGURABLE_CYCLE / static manifest path is **read-only** during this work:

- `processNightSummary` in `l2-elimination.ts` — NOT modified
- `l3-session.ts` — NOT touched
- L4 cartridges — NOT touched
- `l2-timeline.ts`, `l2-initialization.ts`, `l2-economy.ts`, `l2-facts.ts` — NOT modified

The only existing files modified are:
- `packages/shared-types/src/events.ts` — add new constants (additive)
- `packages/shared-types/src/index.ts` — add new types/exports (additive)
- `apps/game-server/src/machines/director.ts` → renamed to `game-master.ts`
- `apps/game-server/src/machines/actions/l2-day-resolution.ts` — rename references + add `processGameMasterActions`
- `apps/game-server/src/machines/l2-orchestrator.ts` — rename references + add nightSummary action + new events
- `apps/game-server/src/machines/__tests__/director.test.ts` → renamed to `game-master.test.ts`

---

## Task 1: Add shared-types constants and types

**Files:**
- Modify: `packages/shared-types/src/events.ts` (lines 11-94, add to Events object)
- Modify: `packages/shared-types/src/index.ts` (near line 479, add new exports)

**Step 1: Add `Events.GameMaster` namespace to events.ts**

In `packages/shared-types/src/events.ts`, add a new namespace inside the `Events` object (after the `Economy` block, before the closing `} as const`):

```ts
  GameMaster: {
    PREFIX: 'GAME_MASTER.',
    RESOLVE_DAY: 'GAME_MASTER.RESOLVE_DAY',
    DAY_ENDED: 'GAME_MASTER.DAY_ENDED',
    GAME_ENDED: 'GAME_MASTER.GAME_ENDED',
  },
```

**Step 2: Add `GameMasterActionTypes` and `GameMasterAction` to index.ts**

In `packages/shared-types/src/index.ts`, after the `GAME_MASTER_ID` constant (line 479), add:

```ts
// --- Game Master Action Types ---
export const GameMasterActionTypes = {
  ELIMINATE: 'ELIMINATE',
} as const;
export type GameMasterActionType = typeof GameMasterActionTypes[keyof typeof GameMasterActionTypes];

export interface GameMasterAction {
  action: GameMasterActionType;
  playerId: string;
  reason: string;
}
```

**Step 3: Build shared-types to verify**

Run: `npm run build --workspace=packages/shared-types`
Expected: Clean build, no errors.

**Step 4: Commit**

```bash
git add packages/shared-types/src/events.ts packages/shared-types/src/index.ts
git commit -m "feat: add Events.GameMaster namespace and GameMasterAction types"
```

---

## Task 2: Create the observation module contract and inactivity module

**Files:**
- Create: `apps/game-server/src/machines/observations/types.ts`
- Create: `apps/game-server/src/machines/observations/inactivity.ts`
- Create: `apps/game-server/src/machines/__tests__/inactivity.test.ts`

**Step 1: Write the ObservationModule contract**

Create `apps/game-server/src/machines/observations/types.ts`:

```ts
import type { SocialPlayer, GameMasterAction, PeckingOrderRuleset } from '@pecking-order/shared-types';

/**
 * Contract for Game Master observation modules.
 * Each module is a set of pure functions — no XState dependency.
 * The Game Master machine holds module states on context and delegates to these.
 */
export interface ObservationModule<TState> {
  /** Initialize module state from roster + ruleset. */
  init(roster: Record<string, SocialPlayer>, ruleset: PeckingOrderRuleset): TState;

  /** Called at the start of each day. May produce actions (e.g. ELIMINATE). */
  onResolveDay(
    state: TState,
    dayIndex: number,
    roster: Record<string, SocialPlayer>,
    ruleset: PeckingOrderRuleset,
  ): { state: TState; actions: GameMasterAction[] };

  /** Called for each FACT.RECORD event during the day. */
  onFact(
    state: TState,
    fact: { type: string; actorId: string; targetId?: string; payload?: any; timestamp: number },
  ): TState;

  /** Called when the day ends. Settle day-level bookkeeping. */
  onDayEnded(
    state: TState,
    dayIndex: number,
    roster: Record<string, SocialPlayer>,
  ): TState;
}
```

**Step 2: Write failing tests for the inactivity module**

Create `apps/game-server/src/machines/__tests__/inactivity.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  createInactivityModule,
  type InactivityState,
} from '../observations/inactivity';
import type { PeckingOrderRuleset, SocialPlayer } from '@pecking-order/shared-types';
import { GameMasterActionTypes, GAME_MASTER_ID } from '@pecking-order/shared-types';

const baseRuleset: PeckingOrderRuleset = {
  kind: 'PECKING_ORDER',
  voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'FINALS'] },
  games: { mode: 'NONE', avoidRepeat: false },
  activities: { mode: 'NONE', avoidRepeat: false },
  social: {
    dmChars: { mode: 'FIXED', base: 1200 },
    dmPartners: { mode: 'FIXED', base: 3 },
    dmCost: 1,
    groupDmEnabled: true,
  },
  inactivity: { enabled: true, thresholdDays: 2, action: 'ELIMINATE' },
  dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' },
};

function makeRoster(count: number, alive?: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  const aliveCount = alive ?? count;
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: i < aliveCount ? 'ALIVE' : 'ELIMINATED',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

describe('Inactivity observation module', () => {
  const mod = createInactivityModule();

  describe('init', () => {
    it('initializes playerActivity for all alive players', () => {
      const state = mod.init(makeRoster(4), baseRuleset);
      expect(Object.keys(state.playerActivity)).toHaveLength(4);
      expect(state.playerActivity['p0'].consecutiveInactiveDays).toBe(0);
      expect(state.playerActivity['p0'].lastActiveDayIndex).toBe(0);
    });

    it('skips eliminated players', () => {
      const state = mod.init(makeRoster(4, 2), baseRuleset);
      expect(Object.keys(state.playerActivity)).toHaveLength(2);
      expect(state.playerActivity['p2']).toBeUndefined();
    });
  });

  describe('onFact', () => {
    it('marks a player as active for the current day', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state = mod.onFact(state, {
        type: 'CHAT_MSG', actorId: 'p0', timestamp: Date.now(),
      });
      expect(state.activeDuringCurrentDay.has('p0')).toBe(true);
    });

    it('ignores SYSTEM facts', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state = mod.onFact(state, {
        type: 'ELIMINATION', actorId: 'SYSTEM', timestamp: Date.now(),
      });
      expect(state.activeDuringCurrentDay.size).toBe(0);
    });

    it('ignores GAME_MASTER facts', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state = mod.onFact(state, {
        type: 'ELIMINATION', actorId: GAME_MASTER_ID, timestamp: Date.now(),
      });
      expect(state.activeDuringCurrentDay.size).toBe(0);
    });
  });

  describe('onDayEnded', () => {
    it('resets consecutive days for active players', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      // Simulate p0 was active, p1 was not
      state.activeDuringCurrentDay.add('p0');
      state.playerActivity['p1'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 1 };

      state = mod.onDayEnded(state, 1, makeRoster(4));

      expect(state.playerActivity['p0'].consecutiveInactiveDays).toBe(0);
      expect(state.playerActivity['p0'].lastActiveDayIndex).toBe(1);
      expect(state.playerActivity['p1'].consecutiveInactiveDays).toBe(2);
    });

    it('clears activeDuringCurrentDay set', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      state.activeDuringCurrentDay.add('p0');
      state = mod.onDayEnded(state, 1, makeRoster(4));
      expect(state.activeDuringCurrentDay.size).toBe(0);
    });
  });

  describe('onResolveDay', () => {
    it('skips day 1 (no eliminations possible)', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      // Even with a high consecutive count, day 1 should skip
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 5 };
      const result = mod.onResolveDay(state, 1, makeRoster(4), baseRuleset);
      expect(result.actions).toHaveLength(0);
    });

    it('eliminates a player who exceeds threshold', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      // p0 has been inactive for 2 consecutive days (= thresholdDays)
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 2 };
      const result = mod.onResolveDay(state, 3, makeRoster(4), baseRuleset);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].action).toBe(GameMasterActionTypes.ELIMINATE);
      expect(result.actions[0].playerId).toBe('p0');
    });

    it('does not eliminate if inactivity is disabled', () => {
      const disabledRuleset = {
        ...baseRuleset,
        inactivity: { ...baseRuleset.inactivity, enabled: false },
      };
      let state = mod.init(makeRoster(4), disabledRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 5 };
      const result = mod.onResolveDay(state, 3, makeRoster(4), disabledRuleset);
      expect(result.actions).toHaveLength(0);
    });

    it('does not eliminate if it would leave fewer than 2 alive', () => {
      // 2 alive players, one inactive past threshold
      let state = mod.init(makeRoster(4, 2), baseRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 5 };
      const result = mod.onResolveDay(state, 3, makeRoster(4, 2), baseRuleset);
      expect(result.actions).toHaveLength(0);
    });

    it('eliminates multiple players but leaves at least 2 alive', () => {
      // 5 alive players, 3 inactive past threshold
      const roster = makeRoster(5);
      let state = mod.init(roster, baseRuleset);
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 3 };
      state.playerActivity['p1'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 3 };
      state.playerActivity['p2'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 3 };

      const result = mod.onResolveDay(state, 4, roster, baseRuleset);
      // Should eliminate at most 3 (5 alive - 2 minimum = 3 max eliminations)
      expect(result.actions.length).toBe(3);
    });

    it('does not eliminate below threshold', () => {
      let state = mod.init(makeRoster(4), baseRuleset);
      // 1 day inactive, threshold is 2
      state.playerActivity['p0'] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 1 };
      const result = mod.onResolveDay(state, 3, makeRoster(4), baseRuleset);
      expect(result.actions).toHaveLength(0);
    });
  });
});
```

**Step 3: Run the tests — verify they fail**

Run: `npx vitest run apps/game-server/src/machines/__tests__/inactivity.test.ts`
Expected: FAIL — `../observations/inactivity` doesn't exist yet.

**Step 4: Implement the inactivity module**

Create `apps/game-server/src/machines/observations/inactivity.ts`:

```ts
import {
  GameMasterActionTypes,
  GAME_MASTER_ID,
  PlayerStatuses,
} from '@pecking-order/shared-types';
import type {
  SocialPlayer,
  PeckingOrderRuleset,
  GameMasterAction,
} from '@pecking-order/shared-types';
import type { ObservationModule } from './types';

export interface InactivityState {
  playerActivity: Record<string, {
    lastActiveDayIndex: number;
    consecutiveInactiveDays: number;
  }>;
  activeDuringCurrentDay: Set<string>;
}

const SYSTEM_ACTORS = ['SYSTEM', GAME_MASTER_ID];
const MIN_ALIVE_PLAYERS = 2;

export function createInactivityModule(): ObservationModule<InactivityState> {
  return {
    init(roster, _ruleset) {
      const playerActivity: InactivityState['playerActivity'] = {};
      for (const [id, player] of Object.entries(roster)) {
        if (player.status === PlayerStatuses.ALIVE) {
          playerActivity[id] = { lastActiveDayIndex: 0, consecutiveInactiveDays: 0 };
        }
      }
      return { playerActivity, activeDuringCurrentDay: new Set() };
    },

    onResolveDay(state, dayIndex, roster, ruleset) {
      const actions: GameMasterAction[] = [];

      // No eliminations on day 1 — no data yet
      if (dayIndex <= 1) return { state, actions };

      // Skip if inactivity rules are disabled
      if (!ruleset.inactivity.enabled) return { state, actions };

      const threshold = ruleset.inactivity.thresholdDays;
      const aliveIds = Object.entries(roster)
        .filter(([, p]) => p.status === PlayerStatuses.ALIVE)
        .map(([id]) => id);

      let aliveCount = aliveIds.length;

      for (const playerId of aliveIds) {
        if (aliveCount <= MIN_ALIVE_PLAYERS) break;

        const activity = state.playerActivity[playerId];
        if (!activity) continue;

        if (activity.consecutiveInactiveDays >= threshold) {
          actions.push({
            action: GameMasterActionTypes.ELIMINATE,
            playerId,
            reason: `Inactive for ${activity.consecutiveInactiveDays} consecutive days (threshold: ${threshold})`,
          });
          aliveCount--;
        }
      }

      return { state, actions };
    },

    onFact(state, fact) {
      // Only track player-originated facts, not system/game-master facts
      if (!fact.actorId || SYSTEM_ACTORS.includes(fact.actorId)) return state;

      // Only track players who are in our activity map
      if (!state.playerActivity[fact.actorId]) return state;

      if (state.activeDuringCurrentDay.has(fact.actorId)) return state;

      return {
        ...state,
        activeDuringCurrentDay: new Set([...state.activeDuringCurrentDay, fact.actorId]),
      };
    },

    onDayEnded(state, dayIndex, roster) {
      const updated: InactivityState['playerActivity'] = {};

      for (const [id, activity] of Object.entries(state.playerActivity)) {
        // Skip players no longer alive
        const player = roster[id];
        if (!player || player.status !== PlayerStatuses.ALIVE) continue;

        if (state.activeDuringCurrentDay.has(id)) {
          updated[id] = { lastActiveDayIndex: dayIndex, consecutiveInactiveDays: 0 };
        } else {
          updated[id] = {
            lastActiveDayIndex: activity.lastActiveDayIndex,
            consecutiveInactiveDays: activity.consecutiveInactiveDays + 1,
          };
        }
      }

      return { playerActivity: updated, activeDuringCurrentDay: new Set() };
    },
  };
}
```

**Step 5: Run the tests — verify they pass**

Run: `npx vitest run apps/game-server/src/machines/__tests__/inactivity.test.ts`
Expected: All tests PASS.

**Step 6: Commit**

```bash
git add apps/game-server/src/machines/observations/types.ts \
        apps/game-server/src/machines/observations/inactivity.ts \
        apps/game-server/src/machines/__tests__/inactivity.test.ts
git commit -m "feat: add ObservationModule contract and inactivity module with tests"
```

---

## Task 3: Rename director → game-master (no behavioral change)

**Files:**
- Rename: `apps/game-server/src/machines/director.ts` → `apps/game-server/src/machines/game-master.ts`
- Rename: `apps/game-server/src/machines/__tests__/director.test.ts` → `apps/game-server/src/machines/__tests__/game-master.test.ts`
- Modify: `apps/game-server/src/machines/actions/l2-day-resolution.ts` (update imports + action names)
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts` (update imports + context field names)

**Step 1: Rename the source file and update its exports**

Rename `director.ts` → `game-master.ts`. In the new file:

1. Rename `DirectorInput` → `GameMasterInput`
2. Rename `DirectorContext` → `GameMasterContext`
3. Rename `buildDirectorContext` → `buildGameMasterContext`
4. Rename `createDirectorMachine` → `createGameMasterMachine`
5. Change machine id from `'director'` to `'game-master'`

All function bodies stay **identical** — this is a pure rename.

```bash
git mv apps/game-server/src/machines/director.ts apps/game-server/src/machines/game-master.ts
```

Then edit `game-master.ts` — find/replace:
- `DirectorInput` → `GameMasterInput`
- `DirectorContext` → `GameMasterContext`
- `buildDirectorContext` → `buildGameMasterContext`
- `createDirectorMachine` → `createGameMasterMachine`
- `id: 'director'` → `id: 'game-master'`

**Step 2: Rename the test file and update imports**

```bash
git mv apps/game-server/src/machines/__tests__/director.test.ts apps/game-server/src/machines/__tests__/game-master.test.ts
```

In `game-master.test.ts`:
- Update import path: `from '../director'` → `from '../game-master'`
- Update imported names: `createDirectorMachine` → `createGameMasterMachine`, `buildDirectorContext` → `buildGameMasterContext`, `DirectorInput` → `GameMasterInput`
- Update describe text: `'Director context resolution'` → `'Game Master context resolution'`, `'Director actor'` → `'Game Master actor'`

**Step 3: Update l2-day-resolution.ts imports and references**

In `apps/game-server/src/machines/actions/l2-day-resolution.ts`:
- Change import: `from '../director'` → `from '../game-master'`
- `createDirectorMachine` → `createGameMasterMachine`
- `DirectorInput` → `GameMasterInput`

Rename action keys:
- `spawnDirectorIfDynamic` → `spawnGameMasterIfDynamic`
- `captureDirectorDay` → `captureGameMasterDay`
- `forwardFactToDirector` → `forwardFactToGameMaster`
- `captureDirectorOutputForNextDay` → `captureGameMasterOutput`

Inside `spawnGameMasterIfDynamic`:
- `context.directorRef` → `context.gameMasterRef`
- Spawn id: `'director'` → `'game-master'`
- Return: `{ directorRef: ref }` → `{ gameMasterRef: ref }`

Inside `captureGameMasterDay`:
- `context.directorRef` → `context.gameMasterRef`

Inside `forwardFactToGameMaster`:
- `context.directorRef` → `context.gameMasterRef`

Inside `captureGameMasterOutput`:
- `context.directorRef` → `context.gameMasterRef`
- Return: `{ directorResolvedDay: null, directorRef: null }` → `{ gameMasterResolvedDay: null, gameMasterRef: null }`

Inside `resolveCurrentDay`:
- `context.directorResolvedDay` → `context.gameMasterResolvedDay`
- Return includes `gameMasterResolvedDay: null` instead of `directorResolvedDay: null`

**Step 4: Update l2-orchestrator.ts**

In `apps/game-server/src/machines/l2-orchestrator.ts`:
- Import: `from './director'` → `from './game-master'`
- `createDirectorMachine` → `createGameMasterMachine`
- `GameContext.directorRef` → `GameContext.gameMasterRef`
- `GameContext.directorResolvedDay` → `GameContext.gameMasterResolvedDay`
- Initial context: `directorRef: null` → `gameMasterRef: null`, `directorResolvedDay: null` → `gameMasterResolvedDay: null`
- Actors object: `directorMachine: createDirectorMachine()` → `gameMasterMachine: createGameMasterMachine()`
- `activeSession` entry: `['spawnDirectorIfDynamic', 'captureDirectorDay']` → `['spawnGameMasterIfDynamic', 'captureGameMasterDay']`
- `activeSession` exit: `['captureDirectorOutputForNextDay']` → `['captureGameMasterOutput']`
- `FACT.RECORD` actions: `'forwardFactToDirector'` → `'forwardFactToGameMaster'`

**Step 5: Run existing tests to confirm no behavioral change**

Run: `npx vitest run apps/game-server/src/machines/__tests__/game-master.test.ts`
Expected: All 15 tests PASS (same tests, just renamed).

Run: `npm run build --workspace=apps/game-server`
Expected: Clean build.

**Step 6: Commit**

```bash
git add -A apps/game-server/src/machines/
git commit -m "refactor: rename director → game-master (no behavioral change)"
```

---

## Task 4: Extend Game Master with long-lived lifecycle

**Files:**
- Modify: `apps/game-server/src/machines/game-master.ts`
- Modify: `apps/game-server/src/machines/__tests__/game-master.test.ts`

This is the core transformation: the Game Master goes from a per-day actor to a long-lived tournament actor with states pregame → tournament → postgame.

**Step 1: Write failing lifecycle tests**

Add to `game-master.test.ts`:

```ts
describe('Game Master lifecycle', () => {
  it('starts in pregame state', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeLifecycleInput(),
    });
    actor.start();
    expect(actor.getSnapshot().value).toBe('pregame');
    actor.stop();
  });

  it('transitions to tournament on GAME_MASTER.RESOLVE_DAY', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeLifecycleInput(),
    });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    expect(actor.getSnapshot().value).toBe('tournament');
    actor.stop();
  });

  it('accumulates actions from observation modules on RESOLVE_DAY', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeLifecycleInput(),
    });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    // Day 1: no actions expected (inactivity skips day 1)
    expect(actor.getSnapshot().context.gameMasterActions).toEqual([]);
    actor.stop();
  });

  it('transitions to postgame on GAME_MASTER.GAME_ENDED', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeLifecycleInput(),
    });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    actor.send({ type: 'GAME_MASTER.GAME_ENDED' });
    expect(actor.getSnapshot().value).toBe('postgame');
    actor.stop();
  });

  it('forwards FACT.RECORD to observation modules in tournament', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeLifecycleInput({ inactivityEnabled: true }),
    });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    actor.send({
      type: 'FACT.RECORD',
      fact: { type: 'CHAT_MSG', actorId: 'p0', timestamp: Date.now() },
    });
    const ctx = actor.getSnapshot().context;
    expect(ctx.inactivityState.activeDuringCurrentDay.has('p0')).toBe(true);
  });

  it('settles day on GAME_MASTER.DAY_ENDED', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeLifecycleInput({ inactivityEnabled: true }),
    });
    actor.start();
    actor.send({
      type: 'GAME_MASTER.RESOLVE_DAY',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    // p0 is active, p1 is not
    actor.send({
      type: 'FACT.RECORD',
      fact: { type: 'CHAT_MSG', actorId: 'p0', timestamp: Date.now() },
    });
    actor.send({
      type: 'GAME_MASTER.DAY_ENDED',
      dayIndex: 1,
      roster: makeRoster(4),
    });
    const ctx = actor.getSnapshot().context;
    // p0 was active → reset to 0
    expect(ctx.inactivityState.playerActivity['p0'].consecutiveInactiveDays).toBe(0);
    // p1 was not active → incremented to 1
    expect(ctx.inactivityState.playerActivity['p1'].consecutiveInactiveDays).toBe(1);
  });

  it('produces ELIMINATE actions when threshold exceeded', () => {
    const actor = createActor(createGameMasterMachine(), {
      input: makeLifecycleInput({ inactivityEnabled: true, thresholdDays: 2 }),
    });
    actor.start();

    // Day 1
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 1, roster: makeRoster(4) });
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 1, roster: makeRoster(4) });
    // All inactive → all get +1

    // Day 2
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 2, roster: makeRoster(4) });
    actor.send({ type: 'GAME_MASTER.DAY_ENDED', dayIndex: 2, roster: makeRoster(4) });
    // All inactive → all get +2 (meets threshold)

    // Day 3 — resolve should produce ELIMINATE actions
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 3, roster: makeRoster(4) });
    const ctx = actor.getSnapshot().context;
    // Should eliminate 2 of 4 (leave 2 alive minimum)
    expect(ctx.gameMasterActions.length).toBe(2);
    expect(ctx.gameMasterActions[0].action).toBe('ELIMINATE');
    actor.stop();
  });
});
```

Also add a `makeLifecycleInput` helper at the top of the test file (after `makeInput`):

```ts
function makeLifecycleInput(overrides?: {
  inactivityEnabled?: boolean;
  thresholdDays?: number;
}): GameMasterInput {
  return {
    roster: makeRoster(4),
    ruleset: {
      ...baseRuleset,
      inactivity: {
        ...baseRuleset.inactivity,
        enabled: overrides?.inactivityEnabled ?? false,
        thresholdDays: overrides?.thresholdDays ?? 2,
      },
    },
    schedulePreset: 'DEFAULT',
    gameHistory: [],
  };
}
```

**Step 2: Run tests — verify they fail**

Run: `npx vitest run apps/game-server/src/machines/__tests__/game-master.test.ts`
Expected: FAIL — new tests reference types/events that don't exist yet.

**Step 3: Rewrite the Game Master machine**

Replace the contents of `apps/game-server/src/machines/game-master.ts` with the new lifecycle-based implementation. Key changes:

1. **Input**: Remove `dayIndex` (no longer per-day). Keep `roster`, `ruleset`, `schedulePreset`, `gameHistory`.
2. **Context**: Add `inactivityState: InactivityState`, `gameMasterActions: GameMasterAction[]`. Remove `observations` (replaced by module states). Keep `resolvedDay` for backwards compat with existing day-resolution wiring.
3. **States**: `pregame` → `tournament` → `postgame`.
4. **Events**: Add `GAME_MASTER.RESOLVE_DAY`, `GAME_MASTER.DAY_ENDED`, `GAME_MASTER.GAME_ENDED`. Keep `FACT.RECORD` and `ADMIN.OVERRIDE_NEXT_DAY`.

The full implementation:

```ts
import { setup, assign } from 'xstate';
import type {
  PeckingOrderRuleset,
  SchedulePreset,
  SocialPlayer,
  VoteType,
  GameType,
  DailyManifest,
  GameHistoryEntry,
  GameMasterAction,
} from '@pecking-order/shared-types';
import { Events } from '@pecking-order/shared-types';
import { createInactivityModule, type InactivityState } from './observations/inactivity';

// ── Input / Context types ───────────────────────────────────────────────

export interface GameMasterInput {
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  gameHistory: GameHistoryEntry[];
}

export interface GameMasterContext {
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  gameHistory: GameHistoryEntry[];
  // Day resolution (set on each RESOLVE_DAY)
  dayIndex: number;
  totalDays: number;
  resolvedDay: DailyManifest | null;
  reasoning: string;
  // Observation module states
  inactivityState: InactivityState;
  // Actions produced by observation modules for the current day
  gameMasterActions: GameMasterAction[];
}

// ── Pure resolution functions (unchanged) ───────────────────────────────

function countAlivePlayers(roster: Record<string, SocialPlayer>): number {
  return Object.values(roster).filter(p => p.status === 'ALIVE').length;
}

function computeTotalDays(alive: number, rules: PeckingOrderRuleset['dayCount']): number {
  let total: number;
  if (rules.mode === 'FIXED') {
    total = rules.fixedCount ?? alive - 1;
  } else {
    total = alive - 1;
  }
  if (rules.maxDays !== undefined) {
    total = Math.min(total, rules.maxDays);
  }
  return Math.max(total, 1);
}

function resolveVoteType(
  dayIndex: number,
  totalDays: number,
  rules: PeckingOrderRuleset['voting'],
  alivePlayers: number,
): VoteType {
  if (dayIndex >= totalDays) return 'FINALS';
  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    const candidate = rules.sequence[idx];
    if (rules.constraints) {
      const constraint = rules.constraints.find(c => c.voteType === candidate);
      if (constraint && alivePlayers < constraint.minPlayers) {
        return 'MAJORITY';
      }
    }
    return candidate;
  }
  if (rules.mode === 'POOL' && rules.pool) {
    const idx = (dayIndex - 1) % rules.pool.length;
    return rules.pool[idx];
  }
  return 'MAJORITY';
}

function resolveGameType(
  dayIndex: number,
  rules: PeckingOrderRuleset['games'],
  gameHistory: GameHistoryEntry[],
): GameType {
  if (rules.mode === 'NONE') return 'NONE';
  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    return rules.sequence[idx];
  }
  if (rules.mode === 'POOL' && rules.pool) {
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastGame = gameHistory[gameHistory.length - 1];
      const filtered = rules.pool.filter(g => g !== lastGame?.gameType);
      if (filtered.length > 0) {
        return filtered[(dayIndex - 1) % filtered.length];
      }
    }
    return rules.pool[(dayIndex - 1) % rules.pool.length];
  }
  return 'NONE';
}

function scaleValue(
  dayIndex: number,
  totalDays: number,
  rule: { mode: string; base: number; floor?: number },
): number {
  if (rule.mode === 'FIXED') return rule.base;
  if (rule.mode === 'DIMINISHING') {
    const floor = rule.floor ?? Math.floor(rule.base * 0.3);
    const progress = Math.min((dayIndex - 1) / Math.max(totalDays - 1, 1), 1);
    return Math.round(rule.base - (rule.base - floor) * progress);
  }
  if (rule.mode === 'PER_ACTIVE_PLAYER') {
    return rule.base;
  }
  return rule.base;
}

function resolveSocialParams(
  dayIndex: number,
  totalDays: number,
  rules: PeckingOrderRuleset['social'],
): { dmCharsPerPlayer: number; dmPartnersPerPlayer: number } {
  return {
    dmCharsPerPlayer: scaleValue(dayIndex, totalDays, rules.dmChars),
    dmPartnersPerPlayer: scaleValue(dayIndex, totalDays, rules.dmPartners),
  };
}

// ── Day resolution (called on RESOLVE_DAY) ──────────────────────────────

function resolveDay(
  dayIndex: number,
  roster: Record<string, SocialPlayer>,
  ruleset: PeckingOrderRuleset,
  gameHistory: GameHistoryEntry[],
): { resolvedDay: DailyManifest; totalDays: number; reasoning: string } {
  const alive = countAlivePlayers(roster);
  const totalDays = computeTotalDays(alive, ruleset.dayCount);
  const voteType = resolveVoteType(dayIndex, totalDays, ruleset.voting, alive);
  const gameType = resolveGameType(dayIndex, ruleset.games, gameHistory);
  const social = resolveSocialParams(dayIndex, totalDays, ruleset.social);

  return {
    resolvedDay: {
      dayIndex,
      theme: `Day ${dayIndex}`,
      voteType,
      gameType,
      timeline: [],
      ...social,
    },
    totalDays,
    reasoning: `Day ${dayIndex}/${totalDays}: ${voteType} vote, ${gameType} game, ${social.dmCharsPerPlayer} DM chars`,
  };
}

/** Build initial Game Master context. Exported for unit testing. */
export function buildGameMasterContext(input: GameMasterInput): GameMasterContext {
  const inactivityModule = createInactivityModule();
  return {
    roster: input.roster,
    ruleset: input.ruleset,
    schedulePreset: input.schedulePreset,
    gameHistory: input.gameHistory,
    dayIndex: 0,
    totalDays: 0,
    resolvedDay: null,
    reasoning: '',
    inactivityState: inactivityModule.init(input.roster, input.ruleset),
    gameMasterActions: [],
  };
}

// ── Observation module singleton ─────────────────────────────────────────

const inactivityModule = createInactivityModule();

// ── XState machine ──────────────────────────────────────────────────────

export function createGameMasterMachine() {
  return setup({
    types: {
      input: {} as GameMasterInput,
      context: {} as GameMasterContext,
      events: {} as
        | { type: 'GAME_MASTER.RESOLVE_DAY'; dayIndex: number; roster: Record<string, SocialPlayer> }
        | { type: 'GAME_MASTER.DAY_ENDED'; dayIndex: number; roster: Record<string, SocialPlayer> }
        | { type: 'GAME_MASTER.GAME_ENDED' }
        | { type: 'FACT.RECORD'; fact: { type: string; actorId: string; targetId?: string; payload?: any; timestamp: number } }
        | { type: 'ADMIN.OVERRIDE_NEXT_DAY'; day: Partial<DailyManifest> },
    },
  }).createMachine({
    id: 'game-master',
    initial: 'pregame',
    context: ({ input }) => buildGameMasterContext(input),
    states: {
      pregame: {
        on: {
          'GAME_MASTER.RESOLVE_DAY': {
            target: 'tournament',
            actions: assign(({ context, event }) => {
              const { resolvedDay, totalDays, reasoning } = resolveDay(
                event.dayIndex, event.roster, context.ruleset, context.gameHistory,
              );
              const { state: inactivityState, actions } = inactivityModule.onResolveDay(
                context.inactivityState, event.dayIndex, event.roster, context.ruleset,
              );
              return {
                dayIndex: event.dayIndex,
                roster: event.roster,
                totalDays,
                resolvedDay,
                reasoning,
                inactivityState,
                gameMasterActions: actions,
              };
            }),
          },
        },
      },
      tournament: {
        on: {
          'GAME_MASTER.RESOLVE_DAY': {
            actions: assign(({ context, event }) => {
              const { resolvedDay, totalDays, reasoning } = resolveDay(
                event.dayIndex, event.roster, context.ruleset, context.gameHistory,
              );
              const { state: inactivityState, actions } = inactivityModule.onResolveDay(
                context.inactivityState, event.dayIndex, event.roster, context.ruleset,
              );
              return {
                dayIndex: event.dayIndex,
                roster: event.roster,
                totalDays,
                resolvedDay,
                reasoning,
                inactivityState,
                gameMasterActions: actions,
              };
            }),
          },
          'GAME_MASTER.DAY_ENDED': {
            actions: assign(({ context, event }) => ({
              inactivityState: inactivityModule.onDayEnded(
                context.inactivityState, event.dayIndex, event.roster,
              ),
              gameMasterActions: [],
            })),
          },
          'GAME_MASTER.GAME_ENDED': {
            target: 'postgame',
          },
          'FACT.RECORD': {
            actions: assign(({ context, event }) => ({
              inactivityState: inactivityModule.onFact(context.inactivityState, event.fact),
            })),
          },
          'ADMIN.OVERRIDE_NEXT_DAY': {
            actions: assign(({ context, event }) => ({
              resolvedDay: context.resolvedDay
                ? { ...context.resolvedDay, ...event.day }
                : null,
              reasoning: `${context.reasoning} [ADMIN OVERRIDE]`,
            })),
          },
        },
      },
      postgame: {
        type: 'final',
      },
    },
  });
}
```

**Step 4: Update existing context resolution tests**

The existing `buildDirectorContext` tests (now `buildGameMasterContext`) need updating since the input shape changed (no `dayIndex` at init). These tests verify the pure resolution functions, so update them to call `resolveDay()` directly — OR — update them to use the actor approach (send RESOLVE_DAY events).

Since the resolution functions are now internal, the best approach is to keep the existing tests as actor-based tests that send `GAME_MASTER.RESOLVE_DAY` events and read the resolved day from context.

Update the `'Game Master context resolution'` describe block: change each test to create an actor, send `GAME_MASTER.RESOLVE_DAY`, and assert on `actor.getSnapshot().context.resolvedDay`.

For example, replace:

```ts
it('resolves day 1 with SEQUENCE voting — picks first vote type', () => {
  const ctx = buildGameMasterContext(makeInput());
  // ...
});
```

with:

```ts
it('resolves day 1 with SEQUENCE voting — picks first vote type', () => {
  const actor = createActor(createGameMasterMachine(), { input: makeLifecycleInput() });
  actor.start();
  actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 1, roster: makeRoster(4) });
  const ctx = actor.getSnapshot().context;
  expect(ctx.resolvedDay?.voteType).toBe('MAJORITY');
  expect(ctx.resolvedDay?.dayIndex).toBe(1);
  actor.stop();
});
```

Update ALL 12 existing context resolution tests following this pattern. Key adjustment: use `makeLifecycleInput()` instead of `makeInput()` for creating the actor, and override `ruleset` on the input when needed.

**Step 5: Run tests**

Run: `npx vitest run apps/game-server/src/machines/__tests__/game-master.test.ts`
Expected: All tests pass (both updated resolution tests and new lifecycle tests).

**Step 6: Build**

Run: `npm run build --workspace=apps/game-server`
Expected: Clean build.

**Step 7: Commit**

```bash
git add apps/game-server/src/machines/game-master.ts \
        apps/game-server/src/machines/__tests__/game-master.test.ts
git commit -m "feat: extend Game Master with long-lived lifecycle and observation modules"
```

---

## Task 5: Update L2 wiring for long-lived Game Master

**Files:**
- Modify: `apps/game-server/src/machines/actions/l2-day-resolution.ts`
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts`

The Game Master is now spawned once at `SYSTEM.INIT` (not per-day in activeSession) and lives until game end. L2 sends lifecycle events instead of spawning/stopping each day.

**Step 1: Rewrite l2-day-resolution.ts**

Replace the contents of `l2-day-resolution.ts`. Key changes:

1. `spawnGameMasterIfDynamic` → runs once at init (moved to `initializeContext` or standalone entry). Spawns without `dayIndex` input.
2. Remove `captureDirectorOutputForNextDay` (no longer stopping/restarting each day).
3. `captureGameMasterDay` → reads `resolvedDay` from Game Master snapshot after sending RESOLVE_DAY.
4. New actions:
   - `sendResolveDayToGameMaster` — sends `GAME_MASTER.RESOLVE_DAY` with roster + dayIndex
   - `sendDayEndedToGameMaster` — sends `GAME_MASTER.DAY_ENDED` at nightSummary
   - `sendGameEndedToGameMaster` — sends `GAME_MASTER.GAME_ENDED` at gameSummary
   - `processGameMasterActions` — reads `gameMasterActions` from Game Master snapshot, applies eliminations

```ts
import { assign, enqueueActions, type AnyActorRef } from 'xstate';
import type { DailyManifest, DynamicManifest, GameMasterAction, SocialPlayer } from '@pecking-order/shared-types';
import { Events, FactTypes, PlayerStatuses, GameMasterActionTypes } from '@pecking-order/shared-types';
import { createGameMasterMachine, type GameMasterInput } from '../game-master';
import { log } from '../../log';

export const l2DayResolutionActions = {
  /**
   * Resolve the current day's manifest. For STATIC manifests, the day already
   * exists in manifest.days[] — no-op. For DYNAMIC manifests, read the
   * Game Master's resolved day and append it to manifest.days[].
   */
  resolveCurrentDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    const resolvedDay = context.gameMasterResolvedDay as DailyManifest | null;
    if (!resolvedDay) return {};

    return {
      manifest: {
        ...manifest,
        days: [...manifest.days, resolvedDay],
      },
      gameMasterResolvedDay: null,
    };
  }),

  /**
   * Spawn Game Master actor at game init (dynamic mode only).
   * Long-lived: lives from pregame through postgame.
   */
  spawnGameMasterIfDynamic: assign(({ context, spawn: spawnFn }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    const input: GameMasterInput = {
      roster: context.roster,
      ruleset: manifest.ruleset,
      schedulePreset: manifest.schedulePreset,
      gameHistory: context.gameHistory || [],
    };

    const ref = spawnFn(createGameMasterMachine(), {
      id: 'game-master',
      input,
    });

    return { gameMasterRef: ref };
  }),

  /**
   * Send RESOLVE_DAY to Game Master at the start of each day.
   * Then read its resolved day and append to manifest.days[].
   */
  sendResolveDayToGameMaster: enqueueActions(({ context, enqueue }: any) => {
    if (!context.gameMasterRef) return;
    enqueue.sendTo(context.gameMasterRef, {
      type: Events.GameMaster.RESOLVE_DAY,
      dayIndex: context.dayIndex,
      roster: context.roster,
    });
  }),

  /**
   * After RESOLVE_DAY, capture the resolved day from Game Master snapshot.
   */
  captureGameMasterDay: assign(({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest || manifest.kind !== 'DYNAMIC') return {};

    const gameMasterRef = context.gameMasterRef as AnyActorRef | null;
    if (!gameMasterRef) return {};

    const snap = gameMasterRef.getSnapshot();
    const resolvedDay = snap?.context?.resolvedDay as DailyManifest | null;
    if (!resolvedDay) return {};

    const alreadyExists = manifest.days.some((d: DailyManifest) => d.dayIndex === resolvedDay.dayIndex);
    if (alreadyExists) return {};

    return {
      manifest: {
        ...manifest,
        days: [...manifest.days, resolvedDay],
      },
    };
  }),

  /**
   * Forward FACT.RECORD events to the Game Master (dynamic mode only).
   */
  forwardFactToGameMaster: enqueueActions(({ context, event, enqueue }: any) => {
    if (!context.gameMasterRef) return;
    if (event.type !== Events.Fact.RECORD) return;
    enqueue.sendTo(context.gameMasterRef, event);
  }),

  /**
   * Send DAY_ENDED to Game Master at nightSummary entry.
   */
  sendDayEndedToGameMaster: enqueueActions(({ context, enqueue }: any) => {
    if (!context.gameMasterRef) return;
    enqueue.sendTo(context.gameMasterRef, {
      type: Events.GameMaster.DAY_ENDED,
      dayIndex: context.dayIndex,
      roster: context.roster,
    });
  }),

  /**
   * Send GAME_ENDED to Game Master at gameSummary entry.
   */
  sendGameEndedToGameMaster: enqueueActions(({ context, enqueue }: any) => {
    if (!context.gameMasterRef) return;
    enqueue.sendTo(context.gameMasterRef, {
      type: Events.GameMaster.GAME_ENDED,
    });
  }),

  /**
   * Process Game Master actions at nightSummary (after processNightSummary).
   * Reads gameMasterActions from Game Master snapshot and applies eliminations.
   * Separate action — does NOT modify the existing elimination pipeline.
   */
  processGameMasterActions: enqueueActions(({ context, enqueue }: any) => {
    const gameMasterRef = context.gameMasterRef as AnyActorRef | null;
    if (!gameMasterRef) return;

    const snap = gameMasterRef.getSnapshot();
    const actions: GameMasterAction[] = snap?.context?.gameMasterActions ?? [];
    if (actions.length === 0) return;

    const rosterUpdate = { ...context.roster };
    let rosterChanged = false;
    const aliveCount = Object.values(rosterUpdate).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
    let remaining = aliveCount;

    for (const action of actions) {
      if (action.action === GameMasterActionTypes.ELIMINATE) {
        const player = rosterUpdate[action.playerId];
        if (!player || player.status !== PlayerStatuses.ALIVE) continue;
        if (remaining <= 2) break;

        log('info', 'L2', 'Game Master eliminating player', {
          playerId: action.playerId,
          reason: action.reason,
        });

        rosterUpdate[action.playerId] = { ...player, status: PlayerStatuses.ELIMINATED };
        rosterChanged = true;
        remaining--;

        enqueue.raise({
          type: Events.Fact.RECORD,
          fact: {
            type: FactTypes.ELIMINATION,
            actorId: 'GAME_MASTER',
            targetId: action.playerId,
            payload: { mechanism: 'INACTIVITY', reason: action.reason },
            timestamp: Date.now(),
          },
        } as any);
      }
    }

    if (rosterChanged) {
      enqueue.assign({ roster: rosterUpdate });
    }
  }),
};

export const l2DayResolutionGuards = {
  /**
   * Check if the game should end after a completed day.
   * For STATIC: dayIndex >= manifest.days.length
   * For DYNAMIC: winner set or only 1 alive
   */
  isGameComplete: ({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest) return false;

    if (context.winner !== null) return true;

    if (manifest.kind === 'DYNAMIC') {
      const alive = Object.values(context.roster).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
      return alive <= 1;
    }

    return context.dayIndex >= (manifest.days.length ?? Infinity);
  },

  /**
   * Safety guard on the dayLoop state — catches overshoot.
   */
  isDayIndexPastEnd: ({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest) return false;

    if (manifest.kind === 'DYNAMIC') {
      const alive = Object.values(context.roster).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
      return alive <= 1;
    }

    return context.dayIndex > (manifest.days.length ?? 7);
  },
};
```

**Step 2: Update l2-orchestrator.ts wiring**

Changes to `l2-orchestrator.ts`:

1. Import from `'./game-master'` (already done in Task 3)
2. Context fields: `gameMasterRef`, `gameMasterResolvedDay` (already done in Task 3)
3. `initializeContext` in `l2-initialization.ts` now needs to call `spawnGameMasterIfDynamic`. Since we don't modify `l2-initialization.ts`, add `spawnGameMasterIfDynamic` to the `preGame` entry actions:

   Change `preGame` state to:
   ```ts
   preGame: {
     entry: ['spawnGameMasterIfDynamic'],
     on: { ... same as before ... }
   }
   ```

4. `morningBriefing` entry: add `'sendResolveDayToGameMaster'` after `'resolveCurrentDay'`:
   ```ts
   entry: ['incrementDay', 'sendResolveDayToGameMaster', 'captureGameMasterDay', 'resolveCurrentDay', 'clearRestoredChatLog', raise(...)]
   ```
   Note: order matters. `sendResolveDayToGameMaster` sends the event, XState processes it synchronously, `captureGameMasterDay` reads the result, then `resolveCurrentDay` handles the STATIC path.

5. `activeSession` entry: remove `'spawnGameMasterIfDynamic'`, `'captureDirectorDay'` (now done in morningBriefing).
   ```ts
   entry: [],  // or remove entry entirely
   ```

6. `activeSession` exit: remove `'captureGameMasterOutput'` (no longer stopping Game Master each day).

7. `nightSummary` entry: add `'sendDayEndedToGameMaster'` and `'processGameMasterActions'`:
   ```ts
   entry: ['recordCompletedVoting', 'processNightSummary', 'processGameMasterActions', 'sendDayEndedToGameMaster', raise(...)]
   ```
   Order: `processNightSummary` first (existing vote-based eliminations), then `processGameMasterActions` (inactivity eliminations), then `sendDayEndedToGameMaster` (settle the day after all eliminations).

8. `gameSummary` entry: add `'sendGameEndedToGameMaster'`:
   ```ts
   gameSummary: {
     entry: ['sendGameEndedToGameMaster'],
     invoke: { ... same ... },
     ...
   }
   ```

9. Remove `'captureDirectorOutputForNextDay'` / `'captureGameMasterOutput'` from the actions import/usage (it no longer exists).

10. Remove `directorMachine` / `gameMasterMachine` from the `actors` object (no longer using `invoke` — we use `spawn` directly).

**Step 3: Build**

Run: `npm run build --workspace=apps/game-server`
Expected: Clean build.

**Step 4: Run all game-server tests**

Run: `npx vitest run apps/game-server/`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add apps/game-server/src/machines/actions/l2-day-resolution.ts \
        apps/game-server/src/machines/l2-orchestrator.ts
git commit -m "feat: wire long-lived Game Master into L2 lifecycle"
```

---

## Task 6: Speed run verification

**Step 1: Verify the build**

Run: `npm run build --workspace=apps/game-server`
Expected: Clean build.

**Step 2: Start the dev server**

Run: `npm run dev --workspace=apps/game-server` (if not already running).

**Step 3: Run the speed run**

Use the `/speed-run` skill to run a full 4-player game cycle.
Expected: All phases complete. `preGame → dayLoop (×3) → gameSummary → gameOver`.

The speed run uses CONFIGURABLE_CYCLE (static mode), so the Game Master should NOT be spawned. This verifies the isolation guarantee — static mode is completely unaffected.

**Step 4: Run all tests**

Run: `npx vitest run`
Expected: All tests pass across the entire codebase.

**Step 5: Commit (if any fixes were needed)**

Only commit if Task 6 revealed issues that needed fixing.

---

## Task 7: Final cleanup and review

**Step 1: Remove any dead code**

Check for any remaining references to old names (`directorRef`, `DirectorInput`, etc.) that might have been missed.

Run: `grep -r "directorRef\|DirectorInput\|DirectorContext\|buildDirectorContext\|createDirectorMachine\|captureDirectorDay\|captureDirectorOutput\|forwardFactToDirector\|spawnDirectorIfDynamic" apps/game-server/src/`

Expected: No matches.

**Step 2: Verify shared-types build**

Run: `npm run build --workspace=packages/shared-types`
Expected: Clean build.

**Step 3: Update feature-dynamic-days.md**

Update `plans/architecture/feature-dynamic-days.md`:
- Phase 3d status: "complete"
- Update Key Files table: `director.ts` → `game-master.ts`, add `observations/inactivity.ts`, add `observations/types.ts`
- Update description: director → Game Master throughout

**Step 4: Commit**

```bash
git add plans/architecture/feature-dynamic-days.md
git commit -m "docs: update feature-dynamic-days.md — Phase 3d complete"
```
