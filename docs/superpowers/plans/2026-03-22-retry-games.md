# Retry Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow players to retry arcade and async trivia games before submitting their score.

**Architecture:** Extend per-player status in arcade-machine factory and trivia machine with an `AWAITING_DECISION` intermediate state. New `GAME.RETRY` and `GAME.SUBMIT` events let the player choose. Client `ArcadeGameWrapper` shows a results summary with Submit/Play Again buttons before the celebration screen. Gold and silver rewards are deferred to submit to prevent farming.

**Tech Stack:** XState v5.26.0 (game-cartridges), React 19 + Vite (client), shared-types (events/projections), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-22-retry-games-design.md`

---

## Task 1: Shared Types — Events and Constants

**Files:**
- Modify: `packages/shared-types/src/events.ts` (lines 85-91, 146-150)
- Modify: `packages/shared-types/src/index.ts` (lines 687-698, 714-731)

- [ ] **Step 1: Add `AWAITING_DECISION` to `ArcadePhases`**

In `packages/shared-types/src/events.ts`, find `ArcadePhases` (line 146-150) and add the new phase:

```typescript
export const ArcadePhases = {
  NOT_STARTED: 'NOT_STARTED',
  PLAYING: 'PLAYING',
  AWAITING_DECISION: 'AWAITING_DECISION',
  COMPLETED: 'COMPLETED',
} as const;
```

- [ ] **Step 2: Add `GAME.RETRY` and `GAME.SUBMIT` events**

In `packages/shared-types/src/events.ts`, find the `Game` namespace (line 85-91) and add:

```typescript
Game: {
  PREFIX: 'GAME.' as const,
  RETRY: 'GAME.RETRY' as const,
  SUBMIT: 'GAME.SUBMIT' as const,
  CHANNEL_PREFIX: 'GAME.CHANNEL.' as const,
  start: (gameType: string) => `GAME.${gameType}.START` as const,
  result: (gameType: string) => `GAME.${gameType}.RESULT` as const,
  event: (gameType: string, action: string) => `GAME.${gameType}.${action}` as const,
},
```

- [ ] **Step 3: Update `ArcadeGameProjection` type**

In `packages/shared-types/src/index.ts`, find `ArcadeGameProjection` (line 687-698) and update:

```typescript
export interface ArcadeGameProjection {
  gameType: string;
  ready?: boolean;
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
  startedAt: number;
  result: Record<string, number> | null;
  silverReward: number;
  goldReward: number;
  goldContribution: number;
  seed: number;
  timeLimit: number;
  difficulty: number;
  // retry fields
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;
}
```

- [ ] **Step 4: Update `TriviaProjection` type**

In `packages/shared-types/src/index.ts`, find `TriviaProjection` (line 714-731) and add retry fields:

```typescript
export interface TriviaProjection {
  gameType: 'TRIVIA';
  ready?: boolean;
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
  currentRound: number;
  totalRounds: number;
  currentQuestion: { question: string; options: string[]; category?: string; difficulty?: string } | null;
  roundDeadline: number | null;
  lastRoundResult: {
    correct: boolean;
    correctAnswer: string;
    selectedAnswer: string;
    silverEarned: number;
    speedBonus: number;
  } | null;
  score: number;
  correctCount: number;
  silverReward: number;
  goldContribution: number;
  // retry fields
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;
}
```

- [ ] **Step 5: Build and verify**

Run: `cd packages/shared-types && npm run build`
Expected: Build succeeds (downstream consumers may have type errors — that's expected, we'll fix them in later tasks).

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/events.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add AWAITING_DECISION phase, GAME.RETRY/SUBMIT events, retry projection fields"
```

---

## Task 2: Arcade Machine — Failing Tests

**Files:**
- Create: `packages/game-cartridges/src/machines/__tests__/arcade-retry.test.ts`
- Reference: `packages/game-cartridges/src/machines/__tests__/arcade-machine-output.test.ts` (for test patterns)
- Reference: `packages/game-cartridges/src/machines/arcade-machine.ts`

- [ ] **Step 1: Write failing tests for retry behavior**

Create `packages/game-cartridges/src/machines/__tests__/arcade-retry.test.ts`.

**IMPORTANT patterns from existing tests (`arcade-machine-output.test.ts`):**
- Use `createArcadeMachine()` directly with a test config, NOT an imported game machine
- Use `.provide()` to stub `sendParent` actions (`emitSync`, `reportResults`, `emitPlayerGameResult`)
- Result fields must be **top-level on the event** (not nested under `result`), e.g., `{ type: ..., senderId: 'p0', correctAnswers: 5, timeElapsed: 10_000 }`
- The stored `result` includes a computed `timeElapsed` field — use `toMatchObject` for partial assertions
- Roster must use `SocialPlayer` shape with `id`, `personaName`, `avatarUrl`, `status`, `silver`, `gold`, `realUserId`

```typescript
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { createArcadeMachine } from '../arcade-machine';
import { ArcadePhases, Events } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';

const baseMachine = createArcadeMachine({
  gameType: 'TEST_GAME',
  defaultTimeLimit: 30_000,
  computeRewards: (result) => ({
    silver: result.correctAnswers || 0,
    gold: Math.floor((result.correctAnswers || 0) / 5),
  }),
});

// Stub sendParent actions so the machine can run standalone
const testMachine = baseMachine.provide({
  actions: {
    emitSync: () => {},
    reportResults: () => {},
    emitPlayerGameResult: () => {},
  } as any,
});

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: 'ALIVE',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

const baseInput = { roster: makeRoster(2), dayIndex: 1, gameType: 'TEST_GAME' as const };

function createTestActor() {
  return createActor(testMachine, { input: baseInput });
}

function startAndCompleteRun(actor: any, playerId: string, correctAnswers: number) {
  actor.send({ type: Events.Game.start('TEST_GAME'), senderId: playerId } as any);
  actor.send({ type: Events.Game.result('TEST_GAME'), senderId: playerId, correctAnswers, timeElapsed: 10_000 } as any);
}

describe('arcade retry', () => {
  describe('RESULT transitions to AWAITING_DECISION', () => {
    it('player enters AWAITING_DECISION after completing a run', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);

      const snap = actor.getSnapshot();
      const player = snap.context.players.p0;
      expect(player.status).toBe(ArcadePhases.AWAITING_DECISION);
      expect(player.result).toMatchObject({ correctAnswers: 5 });
      expect(player.silverReward).toBeGreaterThan(0);
      expect(player.retryCount).toBe(0);
    });

    it('machine stays in active state (PLAYER_COMPLETED not raised)', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.AWAITING_DECISION);
      expect(snap.value).toBe('active');
    });

    it('does NOT add gold to machine goldContribution on RESULT', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 10);

      const snap = actor.getSnapshot();
      expect(snap.context.goldContribution).toBe(0);
      expect(snap.context.players.p0.goldReward).toBeGreaterThan(0);
    });
  });

  describe('GAME.SUBMIT finalizes', () => {
    it('transitions to COMPLETED and adds gold on submit', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.COMPLETED);
      expect(snap.context.goldContribution).toBeGreaterThan(0);
    });

    it('all players submit → machine completes', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      startAndCompleteRun(actor, 'p1', 3);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
    });

    it('ignores SUBMIT if player is not AWAITING_DECISION', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.NOT_STARTED);
    });
  });

  describe('GAME.RETRY resets and loops', () => {
    it('transitions back to PLAYING with incremented retryCount', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      const player = snap.context.players.p0;
      expect(player.status).toBe(ArcadePhases.PLAYING);
      expect(player.retryCount).toBe(1);
      expect(player.result).toBeNull();
      expect(player.silverReward).toBe(0);
    });

    it('preserves previous result for comparison', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      const player = snap.context.players.p0;
      expect(player.previousResult).toMatchObject({ correctAnswers: 5 });
      expect(player.previousSilverReward).toBeGreaterThan(0);
    });

    it('can complete a second run and submit', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 3);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      startAndCompleteRun(actor, 'p0', 8);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.COMPLETED);
      expect(snap.context.players.p0.result).toMatchObject({ correctAnswers: 8 });
    });

    it('multiple retries work correctly', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 1);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);
      startAndCompleteRun(actor, 'p0', 2);
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);
      startAndCompleteRun(actor, 'p0', 3);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.retryCount).toBe(2);
      expect(snap.context.players.p0.result).toMatchObject({ correctAnswers: 3 });
      expect(snap.context.players.p0.previousResult).toMatchObject({ correctAnswers: 2 });
    });

    it('ignores RETRY if player is not AWAITING_DECISION', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

      const snap = actor.getSnapshot();
      expect(snap.context.players.p0.status).toBe(ArcadePhases.NOT_STARTED);
    });
  });

  describe('deadline handling (INTERNAL.END_GAME)', () => {
    it('auto-submits AWAITING_DECISION players', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      startAndCompleteRun(actor, 'p1', 3);
      actor.send({ type: Events.Internal.END_GAME } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
      const output = snap.output as any;
      expect(output.summary.players.p0.silverReward).toBeGreaterThan(0);
      expect(output.summary.players.p1.silverReward).toBeGreaterThan(0);
    });

    it('uses previousResult for mid-retry players', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 7);
      const silverAfterFirstRun = actor.getSnapshot().context.players.p0.silverReward;
      actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);
      actor.send({ type: Events.Game.start('TEST_GAME'), senderId: 'p0' } as any);

      startAndCompleteRun(actor, 'p1', 3);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

      actor.send({ type: Events.Internal.END_GAME } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
      const output = snap.output as any;
      expect(output.summary.players.p0.silverReward).toBe(silverAfterFirstRun);
    });

    it('gives zero to first-run PLAYING players (no previousResult)', () => {
      const actor = createTestActor();
      actor.start();

      actor.send({ type: Events.Game.start('TEST_GAME'), senderId: 'p0' } as any);

      startAndCompleteRun(actor, 'p1', 5);
      actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

      actor.send({ type: Events.Internal.END_GAME } as any);

      const snap = actor.getSnapshot();
      expect(snap.status).toBe('done');
      const output = snap.output as any;
      expect(output.summary.players.p0.silverReward).toBe(0);
    });
  });

  describe('ALL_COMPLETE check', () => {
    it('does NOT trigger when some players are AWAITING_DECISION', () => {
      const actor = createTestActor();
      actor.start();

      startAndCompleteRun(actor, 'p0', 5);
      startAndCompleteRun(actor, 'p1', 3);

      const snap = actor.getSnapshot();
      expect(snap.value).toBe('active');
      expect(snap.status).toBe('active');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/game-cartridges && npx vitest run src/machines/__tests__/arcade-retry.test.ts`
Expected: Tests fail (AWAITING_DECISION status doesn't exist yet, GAME.RETRY/SUBMIT not handled, etc.)

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/game-cartridges/src/machines/__tests__/arcade-retry.test.ts
git commit -m "test(game-cartridges): add failing tests for arcade retry behavior"
```

---

## Task 3: Arcade Machine — Implementation

**Files:**
- Modify: `packages/game-cartridges/src/machines/arcade-machine.ts` (full rework of actions and event handling)

- [ ] **Step 1: Update `ArcadePlayerState` interface**

In `arcade-machine.ts` (line 35-40), add new fields:

```typescript
export interface ArcadePlayerState {
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
  startedAt: number;
  result: Record<string, number> | null;
  silverReward: number;
  goldReward: number;
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;
}
```

- [ ] **Step 2: Update context initialization**

In the `context` factory (line 205-231), initialize new fields per player:

```typescript
goldReward: 0,
retryCount: 0,
previousResult: null,
previousSilverReward: 0,
previousGoldReward: 0,
```

- [ ] **Step 3: Modify `processResult` action**

Change `processResult` (lines 102-151) so that instead of transitioning to COMPLETED and emitting PLAYER_COMPLETED:
1. Compute result + rewards as today
2. Store `silverReward` and `goldReward` per-player
3. Transition to `AWAITING_DECISION` (not COMPLETED)
4. Do NOT add gold to machine `goldContribution`
5. Do NOT raise `PLAYER_COMPLETED`

- [ ] **Step 4: Add `submitPlayer` action**

New action that handles `GAME.SUBMIT`:
1. Guard: player status must be `AWAITING_DECISION`
2. Add `goldReward` to machine `goldContribution`
3. Transition to `COMPLETED`
4. Raise `PLAYER_COMPLETED` (which triggers `emitPlayerGameResult`)
5. Check if all alive players are COMPLETED → raise `ALL_COMPLETE`

- [ ] **Step 5: Add `retryPlayer` action**

New action that handles `GAME.RETRY`:
1. Guard: player status must be `AWAITING_DECISION`
2. Copy `result` → `previousResult`, `silverReward` → `previousSilverReward`, `goldReward` → `previousGoldReward`
3. Increment `retryCount`
4. Reset: `result = null`, `silverReward = 0`, `goldReward = 0`, `startedAt = 0`
5. Transition to `PLAYING`

- [ ] **Step 6: Update `startPlayer` guard**

Modify `startPlayer` (line 85-100) to accept players in `PLAYING` status (set by retryPlayer) in addition to `NOT_STARTED`. Change the guard from `player.status !== ArcadePhases.NOT_STARTED` to `player.status !== ArcadePhases.NOT_STARTED && player.status !== ArcadePhases.PLAYING`.

- [ ] **Step 7: Update `finalizeResults` for deadline**

Modify `finalizeResults` (line 153-166) to handle the deadline scenarios:
1. `AWAITING_DECISION` players → auto-submit: mark COMPLETED, use current result/silverReward/goldReward, add gold to contribution
2. `PLAYING` players with `previousResult` → use previousResult/previousSilverReward/previousGoldReward
3. `PLAYING`/`NOT_STARTED` without previousResult → zero (existing behavior)

- [ ] **Step 8: Add event handlers to machine config**

In the machine states config (lines 250-269), add handlers in the `active` state for:
- `Events.Game.SUBMIT` → guard + `submitPlayer` action
- `Events.Game.RETRY` → guard + `retryPlayer` action

- [ ] **Step 9: Update output calculation**

In the output section (lines 232-249), ensure `goldReward` per-player is included in `summary.players`.

- [ ] **Step 10: Run tests**

Run: `cd packages/game-cartridges && npx vitest run src/machines/__tests__/arcade-retry.test.ts`
Expected: All tests pass.

- [ ] **Step 11: Run existing tests to verify no regressions**

Run: `cd packages/game-cartridges && npx vitest run`
Expected: All existing tests pass (arcade-machine-output.test.ts, etc.)

- [ ] **Step 12: Commit**

```bash
git add packages/game-cartridges/src/machines/arcade-machine.ts
git commit -m "feat(game-cartridges): add retry support to arcade machine factory"
```

---

## Task 4: Trivia Machine — Failing Tests

**Files:**
- Create: `packages/game-cartridges/src/machines/__tests__/trivia-retry.test.ts`
- Reference: `packages/game-cartridges/src/machines/trivia.ts`

- [ ] **Step 1: Write failing tests for trivia retry**

Create `packages/game-cartridges/src/machines/__tests__/trivia-retry.test.ts`.

**IMPORTANT patterns for trivia tests:**
- Trivia machine starts in a `loading` state that invokes `fetchQuestions` (async). Use `.provide()` to mock the `fetchQuestions` actor with a synchronous resolution, OR mock the `assignFetchedQuestions`/`assignFallbackQuestions` actions
- Trivia uses `answerIndex: number` (NOT `answer: string`) — the machine checks `typeof answerIndex === 'number'`
- Questions use `correctIndex: number` (NOT `correctAnswer: string`)
- Stub `sendParent` actions: `emitRoundSync`, `reportResults`, `emitPlayerGameResult`
- Use `SocialPlayer` roster shape (same as arcade tests)
- Trivia gold is currently added per correct answer via `GOLD_PER_CORRECT`. For retry, gold must accumulate into a per-player `goldReward` during the run, then defer to `goldContribution` on submit

```typescript
import { describe, it, expect } from 'vitest';
import { createActor, fromPromise } from 'xstate';
import { triviaMachine } from '../trivia';
import { ArcadePhases, Events, TriviaEvents } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`,
      personaName: `Player ${i}`,
      avatarUrl: '',
      status: 'ALIVE',
      silver: 50,
      gold: 0,
      realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

// Provide a mock fetchQuestions that resolves immediately with test questions
// and stub sendParent actions
const testMachine = triviaMachine.provide({
  actors: {
    fetchQuestions: fromPromise(async () => {
      // Return a large enough pool for retries (30+ questions)
      return Array.from({ length: 30 }, (_, i) => ({
        id: `q${i}`,
        question: `Question ${i}?`,
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,  // 'A' is always correct
        category: 'test',
        difficulty: 'easy',
      }));
    }),
  },
  actions: {
    emitRoundSync: () => {},
    reportResults: () => {},
    emitPlayerGameResult: () => {},
  } as any,
});

const baseInput = { roster: makeRoster(2), dayIndex: 1, gameType: 'TRIVIA' as const };

function createTestActor() {
  return createActor(testMachine, { input: baseInput });
}

/** Complete all rounds for a player by answering correctly (answerIndex: 0) */
function completeAllRounds(actor: any, playerId: string) {
  actor.send({ type: TriviaEvents.START, senderId: playerId } as any);

  const snap = actor.getSnapshot();
  const totalRounds = snap.context.players[playerId]?.totalRounds || 5;

  for (let i = 0; i < totalRounds; i++) {
    actor.send({
      type: TriviaEvents.ANSWER,
      senderId: playerId,
      answerIndex: 0,  // correct answer
    } as any);
  }
}

describe('trivia retry', () => {
  it('player enters AWAITING_DECISION after completing all rounds', () => {
    const actor = createTestActor();
    actor.start();

    completeAllRounds(actor, 'p0');

    const snap = actor.getSnapshot();
    expect(snap.context.players.p0.status).toBe(ArcadePhases.AWAITING_DECISION);
  });

  it('RETRY resets rounds and assigns fresh questions', () => {
    const actor = createTestActor();
    actor.start();

    completeAllRounds(actor, 'p0');

    actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

    const snap = actor.getSnapshot();
    const player = snap.context.players.p0;
    expect(player.status).toBe(ArcadePhases.PLAYING);
    expect(player.currentRound).toBe(1);
    expect(player.score).toBe(0);
    expect(player.correctCount).toBe(0);
    expect(player.retryCount).toBe(1);
    expect(player.previousResult).toBeDefined();
    expect(player.usedQuestionIds.length).toBeGreaterThan(0);
  });

  it('SUBMIT after completing trivia finalizes results', () => {
    const actor = createTestActor();
    actor.start();

    completeAllRounds(actor, 'p0');
    actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.context.players.p0.status).toBe(ArcadePhases.COMPLETED);
  });

  it('previousResult contains score and correctCount', () => {
    const actor = createTestActor();
    actor.start();

    completeAllRounds(actor, 'p0');
    const silverBeforeRetry = actor.getSnapshot().context.players.p0.silverReward;

    actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

    const snap = actor.getSnapshot();
    expect(snap.context.players.p0.previousResult).toMatchObject({
      score: expect.any(Number),
      correctCount: expect.any(Number),
    });
    expect(snap.context.players.p0.previousSilverReward).toBe(silverBeforeRetry);
  });

  it('gold is deferred to submit (not accumulated per-round)', () => {
    const actor = createTestActor();
    actor.start();

    completeAllRounds(actor, 'p0');

    const snap = actor.getSnapshot();
    expect(snap.context.goldContribution).toBe(0);
    expect(snap.context.players.p0.goldReward).toBeGreaterThan(0);

    actor.send({ type: Events.Game.SUBMIT, senderId: 'p0' } as any);

    const snapAfterSubmit = actor.getSnapshot();
    expect(snapAfterSubmit.context.goldContribution).toBeGreaterThan(0);
  });

  it('deadline uses previousResult for mid-retry players', () => {
    const actor = createTestActor();
    actor.start();

    completeAllRounds(actor, 'p0');
    actor.send({ type: Events.Game.RETRY, senderId: 'p0' } as any);

    completeAllRounds(actor, 'p1');
    actor.send({ type: Events.Game.SUBMIT, senderId: 'p1' } as any);

    actor.send({ type: Events.Internal.END_GAME } as any);

    const snap = actor.getSnapshot();
    expect(snap.status).toBe('done');
    const output = snap.output as any;
    expect(output.summary.players.p0.silverReward).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/game-cartridges && npx vitest run src/machines/__tests__/trivia-retry.test.ts`
Expected: Failures (AWAITING_DECISION not implemented in trivia, RETRY/SUBMIT not handled)

- [ ] **Step 3: Commit failing tests**

```bash
git add packages/game-cartridges/src/machines/__tests__/trivia-retry.test.ts
git commit -m "test(game-cartridges): add failing tests for trivia retry behavior"
```

---

## Task 5: Trivia Machine — Implementation

**Files:**
- Modify: `packages/game-cartridges/src/machines/trivia.ts`

- [ ] **Step 1: Update `PlayerTriviaState` interface**

Add retry fields (lines 26-46):

```typescript
// Add to PlayerTriviaState:
goldReward: number;
retryCount: number;
previousResult: Record<string, number> | null;
previousSilverReward: number;
previousGoldReward: number;
usedQuestionIds: string[];
```

- [ ] **Step 2: Update player initialization**

In the context factory, initialize new fields per player:

```typescript
goldReward: 0,
retryCount: 0,
previousResult: null,
previousSilverReward: 0,
previousGoldReward: 0,
usedQuestionIds: [],
```

- [ ] **Step 3: Modify `processAnswer` completion path**

In `processAnswer` (lines 126-211), where a player completes all rounds (transitions to COMPLETED), change to transition to `AWAITING_DECISION` instead. Store the trivia result as `{ score, correctCount }` in `result`. Compute `goldReward` per-player but do NOT add to machine `goldContribution`. Do NOT raise `PLAYER_COMPLETED`.

- [ ] **Step 4: Add `submitPlayer` action for trivia**

New action for `GAME.SUBMIT`:
1. Guard: player status `AWAITING_DECISION`
2. Add `goldReward` to machine `goldContribution`
3. Mark player `COMPLETED`
4. Raise `PLAYER_COMPLETED`
5. Check ALL_COMPLETE

- [ ] **Step 5: Add `retryPlayer` action for trivia**

New action for `GAME.RETRY`:
1. Guard: player status `AWAITING_DECISION`
2. Copy result → `previousResult: { score, correctCount }`
3. Copy `silverReward` → `previousSilverReward`, `goldReward` → `previousGoldReward`
4. Increment `retryCount`
5. Add current question IDs to `usedQuestionIds`
6. Draw fresh questions from pool, excluding `usedQuestionIds` (fallback to allowing repeats if pool exhausted)
7. Reset: `currentRound = 1`, `score = 0`, `correctCount = 0`, `currentQuestion = first new question`, `lastRoundResult = null`, `silverReward = 0`, `goldReward = 0`
8. Transition to `PLAYING`

- [ ] **Step 6: Update `finalizeResults` for deadline**

Same pattern as arcade: auto-submit AWAITING_DECISION, use previousResult for mid-retry PLAYING players.

- [ ] **Step 7: Add event handlers**

In the `active` state, add handlers for `Events.Game.SUBMIT` and `Events.Game.RETRY`.

- [ ] **Step 8: Run trivia retry tests**

Run: `cd packages/game-cartridges && npx vitest run src/machines/__tests__/trivia-retry.test.ts`
Expected: All pass.

- [ ] **Step 9: Run all game-cartridge tests**

Run: `cd packages/game-cartridges && npx vitest run`
Expected: All pass (no regressions).

- [ ] **Step 10: Commit**

```bash
git add packages/game-cartridges/src/machines/trivia.ts
git commit -m "feat(game-cartridges): add retry support to trivia machine"
```

---

## Task 6: Client — AWAITING_DECISION UI

**Files:**
- Modify: `apps/client/src/cartridges/games/wrappers/ArcadeGameWrapper.tsx`
- Create: `apps/client/src/cartridges/games/shared/RetryDecisionScreen.tsx`
- Reference: `apps/client/src/cartridges/games/shared/CelebrationSequence.tsx`

- [ ] **Step 1: Create `RetryDecisionScreen` component**

Create `apps/client/src/cartridges/games/shared/RetryDecisionScreen.tsx`:

This component receives:
- `result: Record<string, number> | null` — current run results
- `silverReward: number` — silver earned this run
- `goldReward: number` — gold earned this run
- `previousResult: Record<string, number> | null` — last run results (if any)
- `previousSilverReward: number` — last run silver
- `retryCount: number`
- `onSubmit: () => void`
- `onRetry: () => void`
- `renderBreakdown?: (result: Record<string, number>) => ReactNode` — game-specific breakdown

Renders:
- Results breakdown (using renderBreakdown or default silver display)
- Silver earned this run
- If previousResult exists: comparison with previous silver ("Previous: X → Current: Y")
- "Submit Score" button (primary, styled prominently)
- "Play Again" button (secondary, shows attempt number)
- No confetti, no fanfare — calm, informational

Use framer-motion for slide-up animations consistent with existing UI. Use vivid shell CSS variable conventions (`--vivid-*` inline styles).

- [ ] **Step 2: Update `ArcadeGameWrapper` phases**

In `ArcadeGameWrapper.tsx`, add `AWAITING_DECISION` to the game phase type and update the flow:

1. Add `'AWAITING_DECISION'` to the `gamePhase` state type
2. Change DEAD → COMPLETED transition: instead of transitioning to `COMPLETED`, transition to `AWAITING_DECISION`
3. Add `AWAITING_DECISION` render branch showing `RetryDecisionScreen`
4. On submit: send `Events.Game.SUBMIT` via engine, transition to `COMPLETED`
5. On retry: send `Events.Game.RETRY` via engine, transition back to `PLAYING` (reset deadline)
6. Handle reconnection: if `cartridge.status === 'AWAITING_DECISION'`, init gamePhase to `AWAITING_DECISION`

- [ ] **Step 3: Update `handleResult` in wrapper**

The `handleResult` callback (lines 50-54) currently sends `GAME.{TYPE}.RESULT` and transitions to `DEAD`. Keep this — the flow is: client sends RESULT → DEAD (1200ms) → AWAITING_DECISION (reads server status). The server transitions to AWAITING_DECISION, client reads it via SYNC.

- [ ] **Step 4: Verify CelebrationSequence is unchanged**

`CelebrationSequence.tsx` only renders in the `COMPLETED` phase (after submit). It already shows confetti, silver counter, gold badge. No changes needed.

- [ ] **Step 5: Build client**

Run: `cd apps/client && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/cartridges/games/shared/RetryDecisionScreen.tsx apps/client/src/cartridges/games/wrappers/ArcadeGameWrapper.tsx
git commit -m "feat(client): add retry decision screen and AWAITING_DECISION phase to arcade wrapper"
```

---

## Task 7: Client — Trivia Retry UI

**Files:**
- Modify: Trivia client component (find in `apps/client/src/cartridges/games/trivia/`)
- Reuse: `RetryDecisionScreen.tsx` from Task 6

- [ ] **Step 1: Identify trivia client component**

Find the trivia game component. It likely renders per-round UI and transitions to a results view after all rounds. Add `AWAITING_DECISION` handling similar to the arcade wrapper.

- [ ] **Step 2: Add retry/submit UI after final round**

When the trivia player status is `AWAITING_DECISION` (all rounds complete), show the `RetryDecisionScreen` with trivia-specific breakdown (score, correct answers, per-round details).

- [ ] **Step 3: Wire up submit/retry events**

- Submit: send `Events.Game.SUBMIT`
- Retry: send `Events.Game.RETRY`, reset local UI state to show the game from round 1

- [ ] **Step 4: Handle reconnection**

If player reconnects during `AWAITING_DECISION`, show the decision screen.

- [ ] **Step 5: Build client**

Run: `cd apps/client && npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/cartridges/games/trivia/
git commit -m "feat(client): add retry support to trivia game UI"
```

---

## Task 8: Build, DemoServer Check, Machine Docs

**Files:**
- Check: `apps/game-server/src/demo/` — DemoServer
- Generate: `docs/machines/` — machine diagrams

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: All apps build successfully.

- [ ] **Step 2: Run all tests**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 3: Check DemoServer**

Read the DemoServer code (`apps/game-server/src/demo/`). Since we changed the SYNC payload shape (new fields in player state), verify DemoServer still works. Update if it references `ArcadePhases` or player status values that need `AWAITING_DECISION`.

- [ ] **Step 4: Generate machine docs**

Run: `npm run generate:docs`
Expected: Updated machine diagrams in `docs/machines/`.

- [ ] **Step 5: Commit any DemoServer/docs updates**

```bash
git add apps/game-server/src/demo/ docs/machines/
git commit -m "chore: update DemoServer and machine docs for retry games"
```

---

## Task Summary

| Task | Description | Dependencies |
|------|-------------|-------------|
| 1 | Shared types (events, constants, projections) | None |
| 2 | Arcade retry tests (failing) | Task 1 |
| 3 | Arcade machine implementation | Task 2 |
| 4 | Trivia retry tests (failing) | Task 1 |
| 5 | Trivia machine implementation | Task 4 |
| 6 | Client arcade retry UI | Task 3 |
| 7 | Client trivia retry UI | Task 5 |
| 8 | Build, DemoServer, machine docs | Tasks 1-7 |

**Parallelization:** Tasks 2-3 (arcade) and 4-5 (trivia) can run in parallel after Task 1. Tasks 6 and 7 can run in parallel after their respective server tasks.
