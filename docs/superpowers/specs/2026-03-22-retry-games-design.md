# Retry Games — Design Spec

## Overview

Allow players to retry arcade and async trivia games before submitting their score. After completing a run, players see their results and choose to **Submit Score** (finalize) or **Play Again** (retry). Unlimited retries for now; cap support is future work.

## Scope

**In scope:**
- 9 arcade games (GAP_RUN, GRID_PUSH, SEQUENCE, REACTION_TIME, COLOR_MATCH, STACKER, QUICK_MATH, SIMON_SAYS, AIM_TRAINER)
- Async TRIVIA

**Out of scope (unaffected):**
- REALTIME_TRIVIA (sync — all players see same state)
- Sync-decision games (BET_BET_BET, BLIND_AUCTION, KINGS_RANSOM, THE_SPLIT)
- TOUCH_SCREEN

## Per-Player State Model

### Current Flow
```
NOT_STARTED → PLAYING → COMPLETED
```

### New Flow
```
NOT_STARTED → PLAYING → AWAITING_DECISION → COMPLETED
                              ↓ (retry)
                           PLAYING (loop)
```

### State Additions

```typescript
// arcade-machine per-player state
interface ArcadePlayerState {
  status: 'NOT_STARTED' | 'PLAYING' | 'AWAITING_DECISION' | 'COMPLETED';
  startedAt: number;
  result: Record<string, number> | null;
  silverReward: number;
  goldReward: number;           // new — per-player gold, deferred to submit
  // new fields
  retryCount: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  previousGoldReward: number;   // new — gold from prior run (deadline fallback)
}
```

Trivia per-player state gets the same retry fields (`retryCount`, `previousResult`, `previousSilverReward`, `previousGoldReward`), plus `usedQuestionIds: string[]` for fresh question tracking.

### Shared Types Updates

The following types in `packages/shared-types` must be updated in lockstep:

- **`ArcadePhases`** — add `AWAITING_DECISION: 'AWAITING_DECISION'` (no raw strings convention)
- **`ArcadeGameProjection`** — add `AWAITING_DECISION` to status union, add `retryCount`, `previousResult`, `previousSilverReward`, `previousGoldReward` fields
- **`TriviaProjection`** — same additions as `ArcadeGameProjection`

### Transition Logic

| Trigger | Guard | Action |
|---------|-------|--------|
| `GAME.{TYPE}.RESULT` | player status is `PLAYING` | Compute result + rewards (silver + gold), store in `result`/`silverReward`/`goldReward`, transition to `AWAITING_DECISION`. Do NOT emit `PLAYER_COMPLETED`. Do NOT add gold to machine-level `goldContribution`. |
| `GAME.SUBMIT` | player status is `AWAITING_DECISION` | Add `goldReward` to machine-level `goldContribution`. Emit `PLAYER_COMPLETED` to parent (L3), transition to `COMPLETED`. |
| `GAME.RETRY` | player status is `AWAITING_DECISION` | Copy `result` → `previousResult`, `silverReward` → `previousSilverReward`, `goldReward` → `previousGoldReward`. Increment `retryCount`. Reset game state. Transition to `PLAYING`. |
| `INTERNAL.END_GAME` | any status | Auto-finalize (see Deadline Handling). |

### Gold Handling

Gold contribution is deferred to submit, same pattern as silver:
- On `GAME.{TYPE}.RESULT` → compute `goldReward` per-player, store but do NOT add to machine `goldContribution`
- On `GAME.SUBMIT` → add `goldReward` to `goldContribution`, then emit results
- On `GAME.RETRY` → `goldReward` moves to `previousGoldReward`, reset to 0
- On deadline auto-submit → use current or previous `goldReward`, same as silver

This prevents gold farming via unlimited retries.

### `ALL_COMPLETE` Check

Only triggers when all alive players have status `COMPLETED`. Players in `AWAITING_DECISION` do not count as complete.

## Events

New events in `packages/shared-types/src/events.ts`:

```typescript
Events.Game = {
  RETRY: 'GAME.RETRY',
  SUBMIT: 'GAME.SUBMIT',
}
```

These are generic lifecycle events, not per-game-type. Routing follows the existing path:

```
Client → L1 (inject senderId) → L2 → L3 → activeGameCartridge
```

L3 forwards `GAME.RETRY` and `GAME.SUBMIT` to the spawned `activeGameCartridge`, same as existing game event forwarding.

Non-retryable games (sync games) silently ignore these events — XState v5 drops unhandled events by default. This is safe and intentional.

## Deadline & Fallback Handling

When `INTERNAL.END_GAME` fires:

| Player Status | Action |
|---|---|
| `COMPLETED` | No change |
| `AWAITING_DECISION` | Auto-submit current `result`/`silverReward`/`goldReward` — emit `PLAYER_COMPLETED`, mark `COMPLETED` |
| `PLAYING` (mid-retry, has `previousResult`) | Submit `previousResult`/`previousSilverReward`/`previousGoldReward` — player completed a prior run |
| `PLAYING` (first run, no `previousResult`) | Zero rewards, as today |
| `NOT_STARTED` | Zero rewards, as today |

**"Never worse off" applies to deadline scenarios only.** If a player voluntarily submits, they get their latest run's score (they chose to submit it). On forced deadline, the system uses whatever completed result is available — current or previous — so retrying cannot result in losing a prior completed run's rewards.

## Trivia-Specific Changes

### State Reset on Retry

When a trivia player retries, reset:
- `currentRound` → 1
- `score` → 0
- `correctCount` → 0
- `currentQuestion` → null
- `lastRoundResult` → null
- `questionStartedAt` → null

### Fresh Questions

- Track `usedQuestionIds: string[]` in `PlayerTriviaState` (persists across retries, per-player)
- On retry, draw `totalRounds` questions from pool excluding `usedQuestionIds`
- If pool is exhausted, allow repeats (graceful fallback — not critical if a couple repeat)
- Increase default pool size to ~3x `totalRounds` to accommodate retries

### Trivia Result Shape

The `previousResult` for trivia stores `{ score, correctCount, silverReward, goldReward }` — enough for the client to show a meaningful comparison.

### What Stays the Same

- Round-by-round gameplay loop unchanged
- Per-round `TRIVIA.ANSWER` handling unchanged
- `GAME_ROUND` fact emission unchanged

## Client Changes

### ArcadeGameWrapper Phase Flow

Current:
```
NOT_STARTED → PLAYING → DEAD (1200ms) → COMPLETED (celebration)
```

New:
```
NOT_STARTED → PLAYING → DEAD (1200ms) → AWAITING_DECISION (results + buttons) → COMPLETED (celebration)
                                              ↓ (retry)
                                           PLAYING
```

### AWAITING_DECISION Screen

Reuse the existing results breakdown from CelebrationSequence, displayed with two action buttons:

- **"Submit Score"** — primary action, finalizes results. Subtitle: "This is final"
- **"Play Again"** — secondary action, starts a new run. Shows retry count.

When `previousResult` exists, show a comparison line (e.g., "Previous: 850 pts → Current: 920 pts"). The exact comparison format is game-specific since results vary (score, distance, jumps, etc.), but silver reward is always comparable.

### Client Reconnection

If a player disconnects and reconnects while in `AWAITING_DECISION`, the `ArcadeGameWrapper` must read the player's `status` from SYNC and render the decision screen (not `NOT_STARTED`). The existing `status` initialization logic needs to handle the new status value.

### Individual Game Components

No changes. Games still emit results the same way. The retry/submit UI is handled entirely by the wrapper.

### Trivia Client

Same pattern — after final round, show results summary with Submit/Play Again buttons instead of auto-completing.

## Arcade Machine: startPlayer Guard

The existing `startPlayer` action guards on `player.status !== ArcadePhases.NOT_STARTED`. On retry, the player transitions `AWAITING_DECISION → PLAYING` via the `GAME.RETRY` handler directly (not via `GAME.{TYPE}.START`). The client sends a fresh `GAME.{TYPE}.START` to begin the new run — the guard must accept players in `PLAYING` status (set by the retry handler) in addition to `NOT_STARTED`.

## DemoServer

Per CLAUDE.md rules: changes to SYNC payload shape and cartridge machines require checking if `DemoServer` (`apps/game-server/src/demo/`) needs updating. Include in implementation.

## What Doesn't Change

- L3 → L2 result forwarding (`PLAYER_COMPLETED`, `GAME_RESULT`) — just fires on SUBMIT instead of RESULT
- `GameOutput` contract
- Economy pipeline (silver/gold credit, fact recording)
- Sync game machines
- Individual arcade game client components
- L1, L2 orchestrator logic
