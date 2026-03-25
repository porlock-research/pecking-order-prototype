# Dynamic Days Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill unit tests and write a multi-day L2 integration test to validate the dynamic days feature before the March 24 playtest.

**Architecture:** Three test files: timeline preset backfill (PLAYTEST/SMOKE_TEST/dilemma events), game master dilemma resolution backfill, and a multi-day L2 orchestrator integration test that drives a full 3-day dynamic tournament with voting and elimination.

**Tech Stack:** Vitest, XState v5 (`createActor`), shared-types constants (`Events`, `VoteEvents`, `PlayerStatuses`)

**Spec:** `docs/superpowers/specs/2026-03-23-dynamic-days-testing-design.md`

---

### Task 1: Timeline Presets — PLAYTEST preset tests

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/timeline-presets.test.ts`

- [ ] **Step 1: Add PLAYTEST preset describe block**

Add after the COMPACT preset block (around line 109):

```typescript
describe('PLAYTEST preset', () => {
  const startTime = '2026-03-10T00:00:00.000Z';

  it('generates calendar-based events from 10:00 to 17:00', () => {
    const events = generateDayTimeline('PLAYTEST', 1, startTime, {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'NONE',
    });
    expect(events[0].action).toBe('OPEN_GROUP_CHAT');
    expect(events[0].time).toBe('2026-03-10T10:00:00.000Z');
    const endDay = events.find(e => e.action === 'END_DAY');
    expect(endDay?.time).toBe('2026-03-10T17:00:00.000Z');
  });

  it('advances to next calendar day for Day 2', () => {
    const events = generateDayTimeline('PLAYTEST', 2, startTime, {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'NONE',
    });
    expect(events[0].time).toBe('2026-03-11T10:00:00.000Z');
  });

  it('has two OPEN_GROUP_CHAT events (re-opens at 15:01)', () => {
    const events = generateDayTimeline('PLAYTEST', 1, startTime, {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'NONE',
    });
    const opens = events.filter(e => e.action === 'OPEN_GROUP_CHAT');
    expect(opens).toHaveLength(2);
    expect(opens[0].time).toBe('2026-03-10T10:00:00.000Z');
    expect(opens[1].time).toBe('2026-03-10T15:01:00.000Z');
  });

  it('omits game/activity events when types are NONE', () => {
    const events = generateDayTimeline('PLAYTEST', 1, startTime, {
      gameType: 'NONE',
      activityType: 'NONE',
      dilemmaType: 'NONE',
    });
    const actions = events.map(e => e.action);
    expect(actions).not.toContain('START_GAME');
    expect(actions).not.toContain('END_GAME');
    expect(actions).not.toContain('START_ACTIVITY');
    expect(actions).not.toContain('END_ACTIVITY');
    expect(actions).not.toContain('START_DILEMMA');
    expect(actions).not.toContain('END_DILEMMA');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/timeline-presets.test.ts`
Expected: All new PLAYTEST tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/__tests__/timeline-presets.test.ts
git commit -m "test: add PLAYTEST preset timeline tests"
```

---

### Task 2: Timeline Presets — SMOKE_TEST preset tests

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/timeline-presets.test.ts`

- [ ] **Step 1: Add SMOKE_TEST preset describe block**

Add after the PLAYTEST block:

```typescript
describe('SMOKE_TEST preset', () => {
  const startTime = '2026-03-10T14:00:00.000Z';

  it('generates offset-based events with 5min day duration', () => {
    const events = generateDayTimeline('SMOKE_TEST', 1, startTime, {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'NONE',
    });
    const base = new Date(startTime).getTime();
    // First event at +0, last (END_DAY) at +5min
    expect(new Date(events[0].time).getTime()).toBe(base);
    expect(new Date(events[events.length - 1].time).getTime()).toBe(base + 5 * 60_000);
  });

  it('offsets Day 2 by dayDuration + interDayGap (6min)', () => {
    const events = generateDayTimeline('SMOKE_TEST', 2, startTime, {
      gameType: 'TRIVIA',
      activityType: 'NONE',
      dilemmaType: 'NONE',
    });
    const base = new Date(startTime).getTime();
    const day2Base = base + (5 + 1) * 60_000; // 6min offset
    expect(new Date(events[0].time).getTime()).toBe(day2Base);
  });

  it('uses same canonical event sequence as SPEED_RUN', () => {
    const smokeEvents = generateDayTimeline('SMOKE_TEST', 1, startTime, {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'NONE',
    });
    const speedEvents = generateDayTimeline('SPEED_RUN', 1, startTime, {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'NONE',
    });
    // Same actions, different timestamps
    expect(smokeEvents.map(e => e.action)).toEqual(speedEvents.map(e => e.action));
  });
});
```

- [ ] **Step 2: Add computeNextDayStart tests for PLAYTEST and SMOKE_TEST**

Append to the existing `computeNextDayStart` describe block:

```typescript
it('returns next calendar day at 10:00 for PLAYTEST', () => {
  const next = computeNextDayStart('PLAYTEST', 1, '2026-03-10T00:00:00.000Z');
  expect(next).toBe('2026-03-11T10:00:00.000Z');
});

it('returns offset-based start for SMOKE_TEST', () => {
  const startTime = '2026-03-10T14:00:00.000Z';
  const next = computeNextDayStart('SMOKE_TEST', 1, startTime);
  // Day 1 duration 5min + gap 1min = Day 2 at +6min
  const expected = new Date(new Date(startTime).getTime() + 6 * 60_000).toISOString();
  expect(next).toBe(expected);
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/timeline-presets.test.ts`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add apps/game-server/src/machines/__tests__/timeline-presets.test.ts
git commit -m "test: add SMOKE_TEST preset and computeNextDayStart tests"
```

---

### Task 3: Timeline Presets — Dilemma conditional events

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/timeline-presets.test.ts`

- [ ] **Step 1: Add dilemma conditional event tests**

Add a new describe block:

```typescript
describe('dilemma conditional events', () => {
  it('includes START_DILEMMA/END_DILEMMA when dilemmaType is not NONE (SPEED_RUN)', () => {
    const events = generateDayTimeline('SPEED_RUN', 1, '2026-03-10T14:00:00.000Z', {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'PRISONERS_DILEMMA',
    });
    const actions = events.map(e => e.action);
    expect(actions).toContain('START_DILEMMA');
    expect(actions).toContain('END_DILEMMA');
  });

  it('omits START_DILEMMA/END_DILEMMA when dilemmaType is NONE (SPEED_RUN)', () => {
    const events = generateDayTimeline('SPEED_RUN', 1, '2026-03-10T14:00:00.000Z', {
      gameType: 'TRIVIA',
      activityType: 'PLAYER_PICK',
      dilemmaType: 'NONE',
    });
    const actions = events.map(e => e.action);
    expect(actions).not.toContain('START_DILEMMA');
    expect(actions).not.toContain('END_DILEMMA');
  });

  it('includes START_DILEMMA/END_DILEMMA when dilemmaType is not NONE (PLAYTEST)', () => {
    const events = generateDayTimeline('PLAYTEST', 1, '2026-03-10T00:00:00.000Z', {
      gameType: 'NONE',
      activityType: 'NONE',
      dilemmaType: 'PRISONERS_DILEMMA',
    });
    const actions = events.map(e => e.action);
    expect(actions).toContain('START_DILEMMA');
    expect(actions).toContain('END_DILEMMA');
    // PLAYTEST: START_DILEMMA at 10:01, END_DILEMMA at 14:59
    const start = events.find(e => e.action === 'START_DILEMMA');
    const end = events.find(e => e.action === 'END_DILEMMA');
    expect(start?.time).toBe('2026-03-10T10:01:00.000Z');
    expect(end?.time).toBe('2026-03-10T14:59:00.000Z');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/timeline-presets.test.ts`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/__tests__/timeline-presets.test.ts
git commit -m "test: add dilemma conditional event tests for timeline presets"
```

---

### Task 4: Game Master — Dilemma resolution backfill

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/game-master.test.ts`

**Context:** The `resolveDilemmaType` function in `game-master.ts` (line 168) checks:
1. `if (!rules || rules.mode === 'NONE') return 'NONE'` — covers undefined AND mode='NONE'
2. Whitelist: `rules.allowed` array — cycles via `pool[(dayIndex-1) % pool.length]`
3. avoidRepeat: filters last played dilemma from pool
4. Sequence mode: picks by `Math.min(dayIndex-1, sequence.length-1)`

The existing `baseRuleset` does NOT have a `dilemmas` field, so it's already undefined by default.

- [ ] **Step 1: Add dilemma resolution describe block**

Add after the `Game Master whitelist-based resolution` describe block:

```typescript
describe('Game Master dilemma resolution', () => {
  it('omits dilemmaType from resolvedDay when dilemmas is undefined on ruleset', () => {
    // baseRuleset has no dilemmas field — resolveDay() omits it rather than setting 'NONE'
    const ctx = resolveAndGetContext(makeInput(), 1);
    expect(ctx.resolvedDay?.dilemmaType).toBeUndefined();
  });

  it('omits dilemmaType from resolvedDay when dilemmas.mode is NONE', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { mode: 'NONE', avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.dilemmaType).toBeUndefined();
  });

  it('picks dilemma from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { allowed: ['PRISONERS_DILEMMA', 'COMMONS_DILEMMA'], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['PRISONERS_DILEMMA', 'COMMONS_DILEMMA']).toContain(ctx.resolvedDay?.dilemmaType);
  });

  it('omits dilemmaType from resolvedDay when dilemmas.allowed is empty', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { allowed: [], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.dilemmaType).toBeUndefined();
  });

  it('avoids repeating dilemma type when avoidRepeat is true', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { allowed: ['PRISONERS_DILEMMA', 'COMMONS_DILEMMA'], avoidRepeat: true },
    };
    const ctx1 = resolveAndGetContext(input, 1);
    // Simulate history from day 1
    input.gameHistory = [{ dilemmaType: ctx1.resolvedDay?.dilemmaType } as any];
    const ctx2 = resolveAndGetContext(input, 2);
    expect(ctx2.resolvedDay?.dilemmaType).not.toBe(ctx1.resolvedDay?.dilemmaType);
  });

  it('resolves dilemma type from sequence mode', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dilemmas: { mode: 'SEQUENCE', sequence: ['PRISONERS_DILEMMA', 'COMMONS_DILEMMA'], avoidRepeat: false },
    };
    const ctx1 = resolveAndGetContext(input, 1);
    expect(ctx1.resolvedDay?.dilemmaType).toBe('PRISONERS_DILEMMA');
    const ctx2 = resolveAndGetContext(input, 2);
    expect(ctx2.resolvedDay?.dilemmaType).toBe('COMMONS_DILEMMA');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/game-master.test.ts`
Expected: All pass (including existing tests).

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/__tests__/game-master.test.ts
git commit -m "test: add Game Master dilemma resolution tests"
```

---

### Task 5: Integration Test — Setup and helpers

**Files:**
- Create: `apps/game-server/src/machines/__tests__/dynamic-days-integration.test.ts`

**Context:** This is the main integration test. We create the full L2 orchestrator with a DYNAMIC manifest and drive it through a complete 3-day tournament. The L2 machine (`orchestratorMachine`) is imported from `../l2-orchestrator`. Events are sent via `actor.send()`. L3 is invoked as a child and receives forwarded events.

Key flow per day:
1. `SYSTEM.WAKEUP` → morningBriefing (GM resolves day) → activeSession (L3 invoked)
2. `ADMIN.INJECT_TIMELINE_EVENT { action: 'OPEN_VOTING' }` → L3 enters voting, spawns cartridge
3. `VOTE.MAJORITY.CAST` per voter → forwarded through L2→L3→cartridge
4. `ADMIN.INJECT_TIMELINE_EVENT { action: 'CLOSE_VOTING' }` → cartridge calculates, done event propagates
5. Assert `pendingElimination` is set
6. `ADMIN.INJECT_TIMELINE_EVENT { action: 'END_DAY' }` → nightSummary → processes elimination
7. Assert roster updated, completedPhases updated
8. `SYSTEM.WAKEUP` → next day (unless game complete)

Important: The SYSTEM.INIT roster uses `isAlive: boolean` format (lobby Roster type). L2's `initializeContext` converts to `status: 'ALIVE'|'ELIMINATED'`.

Player IDs are 1-indexed: p1, p2, p3, p4 (matching production).

- [ ] **Step 1: Create test file with imports and helpers**

```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { orchestratorMachine } from '../l2-orchestrator';
import { Events, PlayerStatuses, VoteEvents } from '@pecking-order/shared-types';
import type { DynamicManifest, PeckingOrderRuleset } from '@pecking-order/shared-types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeRoster() {
  return {
    p1: { personaName: 'Alice', avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 100, gold: 0, realUserId: 'u1', destinyId: 'd1' },
    p2: { personaName: 'Bob',   avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 80,  gold: 0, realUserId: 'u2', destinyId: 'd2' },
    p3: { personaName: 'Carol', avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 60,  gold: 0, realUserId: 'u3', destinyId: 'd3' },
    p4: { personaName: 'Dave',  avatarUrl: '', bio: '', isAlive: true, isSpectator: false, silver: 40,  gold: 0, realUserId: 'u4', destinyId: 'd4' },
  };
}

const RULESET: PeckingOrderRuleset = {
  kind: 'PECKING_ORDER',
  voting: { allowed: ['MAJORITY'] },
  games: { mode: 'NONE', avoidRepeat: false },
  activities: { mode: 'NONE', avoidRepeat: false },
  social: {
    dmChars: { mode: 'FIXED', base: 1200 },
    dmPartners: { mode: 'FIXED', base: 3 },
    dmCost: 1,
    groupDmEnabled: true,
    requireDmInvite: false,
    dmSlotsPerPlayer: 5,
  },
  inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
  dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' },
};

function makeDynamicManifest(): DynamicManifest {
  return {
    kind: 'DYNAMIC',
    scheduling: 'ADMIN',
    startTime: new Date().toISOString(),
    ruleset: RULESET,
    schedulePreset: 'SMOKE_TEST',
    maxPlayers: 4,
    days: [],
  };
}

/** Send SYSTEM.INIT and SYSTEM.WAKEUP to get to Day 1 activeSession */
function initAndStartDay1(actor: ReturnType<typeof createActor>) {
  actor.send({
    type: Events.System.INIT,
    gameId: 'test-dynamic-1',
    inviteCode: 'TEST',
    payload: { roster: makeRoster(), manifest: makeDynamicManifest() },
  } as any);
  // WAKEUP → dayLoop → morningBriefing → activeSession
  actor.send({ type: Events.System.WAKEUP });
}

/** Open voting, cast majority votes, close voting. Returns after cartridge completes. */
function runMajorityVoting(actor: ReturnType<typeof createActor>, voters: Array<{ senderId: string; targetId: string }>) {
  // Open voting
  actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'OPEN_VOTING' } } as any);
  // Cast votes
  for (const { senderId, targetId } of voters) {
    actor.send({ type: VoteEvents.MAJORITY.CAST, senderId, targetId } as any);
  }
  // Close voting — triggers result calculation, done event propagates synchronously
  actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'CLOSE_VOTING' } } as any);
}

/** End the current day — transitions to nightSummary */
function endDay(actor: ReturnType<typeof createActor>) {
  actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'END_DAY' } } as any);
}

/** Start next day from nightSummary */
function startNextDay(actor: ReturnType<typeof createActor>) {
  actor.send({ type: Events.System.WAKEUP });
}

function getCtx(actor: ReturnType<typeof createActor>) {
  return actor.getSnapshot().context as any;
}

function getStateValue(actor: ReturnType<typeof createActor>) {
  return actor.getSnapshot().value;
}

function countAlive(actor: ReturnType<typeof createActor>): number {
  const roster = getCtx(actor).roster;
  return Object.values(roster).filter((p: any) => p.status === PlayerStatuses.ALIVE).length;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/dynamic-days-integration.test.ts`
Expected: 0 tests found (no describe/it blocks yet), no compile errors.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/__tests__/dynamic-days-integration.test.ts
git commit -m "test: scaffold dynamic days integration test with helpers"
```

---

### Task 6: Integration Test — Full tournament lifecycle

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/dynamic-days-integration.test.ts`

**Context:** This is the main test. It drives L2 through 3 days:
- Day 1: MAJORITY vote → p4 eliminated (3 alive)
- Day 2: MAJORITY vote → p3 eliminated (2 alive)
- Day 3: FINALS → p3+p4 vote for p1 (p1 wins, p2 eliminated) → gameSummary

Important: `scheduling: 'ADMIN'` means timeline events are NOT auto-processed. We manually inject them via `ADMIN.INJECT_TIMELINE_EVENT`.

For FINALS: The eliminated players (p3, p4) are the voters. The alive players (p1, p2) are the targets. `VOTE.FINALS.CAST` produces both `winnerId` and `eliminatedId`.

- [ ] **Step 1: Add the full tournament lifecycle test**

```typescript
// NOTE: Using ['MAJORITY'] only for voting whitelist. PODIUM_SACRIFICE and BUBBLE
// both have degenerate behavior with 3 alive players (all become podium/immune,
// zero eligible voters). Whitelist cycling is already tested in game-master.test.ts.
describe('Dynamic Days — Multi-day tournament', () => {
  let actor: ReturnType<typeof createActor>;

  afterEach(() => { actor?.stop(); });

  it('drives a 4-player dynamic game through 3 days to completion', () => {
    actor = createActor(orchestratorMachine);
    actor.start();

    // ── Init ──
    initAndStartDay1(actor);
    const stateAfterInit = getStateValue(actor);
    // Should be in dayLoop.activeSession (L3 invoked)
    expect(stateAfterInit).toHaveProperty('dayLoop');

    // ── Day 1 assertions ──
    let ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(1);
    expect(ctx.manifest.days).toHaveLength(1);
    expect(ctx.manifest.days[0].dayIndex).toBe(1);
    expect(ctx.manifest.days[0].voteType).toBe('MAJORITY');
    expect(ctx.manifest.days[0].timeline.length).toBeGreaterThan(0);
    expect(ctx.manifest.days[0].nextDayStart).toBeDefined();
    // Social scaling: FIXED mode, expect exact values
    expect(ctx.manifest.days[0].dmCharsPerPlayer).toBe(1200);
    expect(ctx.manifest.days[0].dmPartnersPerPlayer).toBe(3);
    // NONE types should not be set on resolved day
    expect(ctx.manifest.days[0].activityType).toBeUndefined();
    expect(ctx.manifest.days[0].dilemmaType).toBeUndefined();

    // ── Day 1 voting: eliminate p4 ──
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p4' },
      { senderId: 'p2', targetId: 'p4' },
      { senderId: 'p3', targetId: 'p4' },
    ]);

    // Assert pendingElimination is set BEFORE ending the day
    ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.eliminatedId).toBe('p4');
    expect(ctx.pendingElimination.mechanism).toBe('MAJORITY');

    // End Day 1 → nightSummary
    endDay(actor);

    ctx = getCtx(actor);
    expect(ctx.roster.p4.status).toBe(PlayerStatuses.ELIMINATED);
    expect(ctx.pendingElimination).toBeNull();
    expect(countAlive(actor)).toBe(3);
    // completedPhases should have the voting entry
    expect(ctx.completedPhases).toHaveLength(1);
    expect(ctx.completedPhases[0].kind).toBe('voting');
    expect(ctx.completedPhases[0].mechanism).toBe('MAJORITY');
    expect(ctx.completedPhases[0].eliminatedId).toBe('p4');

    // ── Day 2 ──
    startNextDay(actor);

    ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(2);
    expect(ctx.manifest.days).toHaveLength(2);
    expect(ctx.manifest.days[1].dayIndex).toBe(2);
    expect(ctx.manifest.days[1].voteType).toBe('MAJORITY');
    expect(ctx.manifest.days[1].nextDayStart).toBeDefined();
    // No duplicate dayIndex entries
    const dayIndices = ctx.manifest.days.map((d: any) => d.dayIndex);
    expect(new Set(dayIndices).size).toBe(dayIndices.length);

    // ── Day 2 voting: eliminate p3 ──
    runMajorityVoting(actor, [
      { senderId: 'p1', targetId: 'p3' },
      { senderId: 'p2', targetId: 'p3' },
    ]);

    ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.eliminatedId).toBe('p3');

    endDay(actor);

    ctx = getCtx(actor);
    expect(ctx.roster.p3.status).toBe(PlayerStatuses.ELIMINATED);
    expect(countAlive(actor)).toBe(2);
    expect(ctx.completedPhases).toHaveLength(2);

    // ── Day 3 (FINALS) ──
    startNextDay(actor);

    ctx = getCtx(actor);
    expect(ctx.dayIndex).toBe(3);
    expect(ctx.manifest.days).toHaveLength(3);
    expect(ctx.manifest.days[2].dayIndex).toBe(3);
    expect(ctx.manifest.days[2].voteType).toBe('FINALS');
    // Last day: nextDayStart should be undefined
    expect(ctx.manifest.days[2].nextDayStart).toBeUndefined();

    // ── Day 3 voting: FINALS — eliminated players vote ──
    // Open voting
    actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'OPEN_VOTING' } } as any);
    // Eliminated players (p3, p4) vote for p1 as winner
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p3', targetId: 'p1' } as any);
    actor.send({ type: VoteEvents.FINALS.CAST, senderId: 'p4', targetId: 'p1' } as any);
    // Close voting
    actor.send({ type: Events.Admin.INJECT_TIMELINE_EVENT, payload: { action: 'CLOSE_VOTING' } } as any);

    ctx = getCtx(actor);
    expect(ctx.pendingElimination).not.toBeNull();
    expect(ctx.pendingElimination.winnerId).toBe('p1');
    expect(ctx.pendingElimination.eliminatedId).toBe('p2');
    expect(ctx.pendingElimination.mechanism).toBe('FINALS');

    // End Day 3 → nightSummary → isGameComplete → gameSummary
    endDay(actor);

    ctx = getCtx(actor);
    expect(ctx.winner).not.toBeNull();
    expect(ctx.winner.playerId).toBe('p1');
    expect(ctx.winner.mechanism).toBe('FINALS');
    expect(ctx.completedPhases).toHaveLength(3);

    // L2 should be in gameSummary (post-game)
    const finalState = getStateValue(actor);
    expect(finalState).toBe('gameSummary');
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/dynamic-days-integration.test.ts`
Expected: PASS. If it fails, debug the failure — common issues:
- Voting cartridge not registered in L3 actors → check that MAJORITY is in the vote registry
- `sendParent` actions failing silently in child → this is expected (facts won't persist to D1 in tests, but elimination still works)
- State assertion mismatch → use `JSON.stringify(getStateValue(actor))` to inspect nested state

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/__tests__/dynamic-days-integration.test.ts
git commit -m "test: add full 3-day dynamic tournament integration test"
```

---

### Task 7: Integration Test — Manifest growth and guard correctness

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/dynamic-days-integration.test.ts`

- [ ] **Step 1: Add manifest growth correctness test**

Add within the `Dynamic Days` describe block:

```typescript
it('grows manifest.days correctly with no duplicates across days', () => {
  actor = createActor(orchestratorMachine);
  actor.start();
  initAndStartDay1(actor);

  // Day 1: verify manifest
  let ctx = getCtx(actor);
  expect(ctx.manifest.days).toHaveLength(1);
  expect(ctx.manifest.kind).toBe('DYNAMIC');

  // Run Day 1 voting + end
  runMajorityVoting(actor, [
    { senderId: 'p1', targetId: 'p4' },
    { senderId: 'p2', targetId: 'p4' },
    { senderId: 'p3', targetId: 'p4' },
  ]);
  endDay(actor);

  // Day 2
  startNextDay(actor);
  ctx = getCtx(actor);
  expect(ctx.manifest.days).toHaveLength(2);
  // Each day has a timeline
  for (const day of ctx.manifest.days) {
    expect(day.timeline.length).toBeGreaterThan(0);
    expect(day.dmCharsPerPlayer).toBeDefined();
    expect(day.dmPartnersPerPlayer).toBeDefined();
  }
  // No duplicate dayIndex
  const indices = ctx.manifest.days.map((d: any) => d.dayIndex);
  expect(new Set(indices).size).toBe(indices.length);
});

it('stays in nightSummary when game is not complete (requires explicit WAKEUP)', () => {
  actor = createActor(orchestratorMachine);
  actor.start();
  initAndStartDay1(actor);

  // Day 1 voting + end
  runMajorityVoting(actor, [
    { senderId: 'p1', targetId: 'p4' },
    { senderId: 'p2', targetId: 'p4' },
    { senderId: 'p3', targetId: 'p4' },
  ]);
  endDay(actor);

  // Should be in nightSummary, NOT morningBriefing
  const state = getStateValue(actor);
  expect(state).toHaveProperty('dayLoop');
  expect((state as any).dayLoop).toBe('nightSummary');

  // Only proceeds to next day on explicit WAKEUP
  startNextDay(actor);
  const ctx = getCtx(actor);
  expect(ctx.dayIndex).toBe(2);
});

it('does not trigger isDayIndexPastEnd prematurely during normal play', () => {
  actor = createActor(orchestratorMachine);
  actor.start();
  initAndStartDay1(actor);

  // Day 1: dayIndex=1, manifest.days.length=1 — should NOT jump to gameSummary
  let state = getStateValue(actor);
  expect(state).toHaveProperty('dayLoop');
  expect((state as any).dayLoop).not.toBe('gameSummary');

  // Complete Day 1
  runMajorityVoting(actor, [
    { senderId: 'p1', targetId: 'p4' },
    { senderId: 'p2', targetId: 'p4' },
    { senderId: 'p3', targetId: 'p4' },
  ]);
  endDay(actor);

  // Should be in nightSummary, not gameSummary (3 alive, game not done)
  state = getStateValue(actor);
  expect(state).not.toBe('gameSummary');

  // Day 2 should work normally
  startNextDay(actor);
  const ctx = getCtx(actor);
  expect(ctx.dayIndex).toBe(2);
  expect(ctx.manifest.days).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/dynamic-days-integration.test.ts`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/machines/__tests__/dynamic-days-integration.test.ts
git commit -m "test: add manifest growth and nightSummary guard tests"
```

---

### Task 8: Run full test suite and verify no regressions

**Files:** None (verification only)

- [ ] **Step 1: Run all game-server tests**

Run: `cd apps/game-server && npx vitest run`
Expected: All tests pass, including existing timeline-presets, game-master, inactivity, manifest-types, and new dynamic-days-integration tests.

- [ ] **Step 2: Run type check**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 3: Commit any fixes if needed**

If any test failures or type errors were found, fix and commit:
```bash
git add -A
git commit -m "fix: resolve test regressions from dynamic days testing"
```
