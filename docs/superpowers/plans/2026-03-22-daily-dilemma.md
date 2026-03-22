# Daily Dilemma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Daily Dilemma system — a cooperative/defect social mechanic announced when group chat opens that drives meaningful conversation by giving players a shared decision to discuss and resolve.

**Architecture:** New `dilemmaLayer` parallel state in L3 (like `activityLayer`), with a dilemma machine factory in a new `cartridges/dilemmas/` directory. Dilemma is announced at `OPEN_GROUP_CHAT` time, decisions collected throughout social phase, resolved before voting. Uses existing event conventions (`Events.Dilemma.*`, `Events.Internal.START_DILEMMA/END_DILEMMA`), shared types patterns, and Config-driven reward values.

**Tech Stack:** XState v5, Zod schemas, shared-types constants, Zustand (client), React + Tailwind + Framer Motion (vivid shell)

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `packages/shared-types/src/dilemma-types.ts` | DilemmaType enum, DilemmaCartridgeInput, DilemmaOutput, DilemmaPhases |
| `apps/game-server/src/machines/cartridges/dilemmas/dilemma-machine.ts` | Factory: `createDilemmaMachine(config)` — generic lifecycle |
| `apps/game-server/src/machines/cartridges/dilemmas/_registry.ts` | Registry mapping DilemmaType → machine |
| `apps/game-server/src/machines/cartridges/dilemmas/_contract.ts` | Contract docs for dilemma machines |
| `apps/game-server/src/machines/cartridges/dilemmas/silver-gambit.ts` | "All donate or nobody gets anything" |
| `apps/game-server/src/machines/cartridges/dilemmas/spotlight.ts` | "Unanimous blind pick → +20 silver" |
| `apps/game-server/src/machines/cartridges/dilemmas/gift-or-grief.ts` | "Name a player → +10 or -10" |
| `apps/game-server/src/machines/actions/l3-dilemma.ts` | L3 actions: spawn, cleanup, forward, apply rewards |
| `apps/game-server/src/machines/cartridges/dilemmas/__tests__/dilemma-machine.test.ts` | Unit tests for dilemma machines |
| `apps/client/src/cartridges/dilemmas/DilemmaCard.tsx` | Persistent dilemma card in stage view |
| `apps/client/src/cartridges/dilemmas/SilverGambitInput.tsx` | Silver Gambit decision UI |
| `apps/client/src/cartridges/dilemmas/SpotlightInput.tsx` | Spotlight decision UI |
| `apps/client/src/cartridges/dilemmas/GiftOrGriefInput.tsx` | Gift or Grief decision UI |
| `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx` | Results reveal (shared across types) |

### Modified Files
| File | Changes |
|------|---------|
| `packages/shared-types/src/events.ts` | Add `Events.Dilemma`, `Events.Internal.START_DILEMMA/END_DILEMMA`, `Events.Cartridge.DILEMMA_RESULT`, `FactTypes.DILEMMA_RESULT`, `DilemmaPhases`, `DilemmaEvents`, `ALLOWED_CLIENT_EVENTS` update |
| `packages/shared-types/src/config.ts` | Add `Config.dilemma` reward values |
| `packages/shared-types/src/index.ts` | Add `DilemmaTypeSchema`, `DilemmaCartridgeInput`, update `DailyManifestSchema`, `TimelineEventSchema`, `PushTriggerSchema` |
| `apps/game-server/src/machines/l3-session.ts` | Add `dilemmaLayer` parallel state |
| `apps/game-server/src/machines/l2-orchestrator.ts` | Handle `CARTRIDGE.DILEMMA_RESULT` |
| `apps/game-server/src/machines/actions/l2-economy.ts` | Add `recordCompletedDilemma`, `raiseDilemmaEconomyEvents` |
| `apps/game-server/src/machines/timeline-presets.ts` | Add `START_DILEMMA`/`END_DILEMMA` events, `hasDilemma` condition |
| `apps/game-server/src/machines/game-master.ts` | Add `resolveDilemmaType()` |
| `apps/game-server/src/sync.ts` | Extract + project `activeDilemmaCartridge` |
| `apps/game-server/src/machines/l2-orchestrator.ts` | Add `DILEMMA.*` forwarding case to `'*'` handler chain (~line 220) |
| `apps/game-server/src/ws-handlers.ts` | Add `Events.Dilemma.PREFIX` to L1 prefix-matching allowlist |
| `apps/game-server/src/projections.ts` | Add `projectDilemmaCartridge()` privacy projection |
| `apps/game-server/src/d1-persistence.ts` | Add `FactTypes.DILEMMA_RESULT` to persisted facts |
| `apps/game-server/src/ticker.ts` | Add dilemma ticker entries |
| `apps/client/src/store/useGameStore.ts` | Extract `activeDilemma` from SYNC |
| `apps/client/src/shells/vivid/components/StageTab.tsx` (or equivalent) | Render `DilemmaCard` when active |

---

## Task 1: Shared Types — DilemmaType, Events, Config

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/events.ts`
- Modify: `packages/shared-types/src/config.ts`
- Create: `packages/shared-types/src/dilemma-types.ts`

- [ ] **Step 1: Add DilemmaType schema and input/output types**

Create `packages/shared-types/src/dilemma-types.ts`:
```typescript
import { z } from 'zod';
import type { SocialPlayer } from './index';

export const DilemmaTypeSchema = z.enum([
  'SILVER_GAMBIT',
  'SPOTLIGHT',
  'GIFT_OR_GRIEF',
]);
export type DilemmaType = z.infer<typeof DilemmaTypeSchema>;

export interface DilemmaCartridgeInput {
  dilemmaType: DilemmaType;
  roster: Record<string, SocialPlayer>;
  dayIndex: number;
}

export interface DilemmaOutput {
  silverRewards: Record<string, number>;
  dilemmaType: DilemmaType;
  summary: Record<string, any>;
}
```

Add to `packages/shared-types/src/index.ts`:
- Export `DilemmaTypeSchema`, `DilemmaType`, `DilemmaCartridgeInput`, `DilemmaOutput` from `./dilemma-types`
- Add `dilemmaType: DilemmaTypeSchema.or(z.literal('NONE')).optional()` to `DailyManifestSchema`
- Add `'START_DILEMMA'`, `'END_DILEMMA'` to `TimelineEventSchema.action` enum

- [ ] **Step 2: Add Events.Dilemma namespace and related constants**

In `packages/shared-types/src/events.ts`, add:

```typescript
// In Events object:
Dilemma: {
  PREFIX: 'DILEMMA.',
  submit: (dilemmaType: string) => `DILEMMA.${dilemmaType}.SUBMIT`,
},

// In Events.Internal:
START_DILEMMA: 'INTERNAL.START_DILEMMA',
END_DILEMMA: 'INTERNAL.END_DILEMMA',

// In Events.Cartridge:
DILEMMA_RESULT: 'CARTRIDGE.DILEMMA_RESULT',
```

Add `FactTypes.DILEMMA_RESULT: 'DILEMMA_RESULT'`.

Add `DilemmaPhases`:
```typescript
export const DilemmaPhases = {
  ANNOUNCED: 'ANNOUNCED',
  COLLECTING: 'COLLECTING',
  REVEAL: 'REVEAL',
} as const;
```

Add `DilemmaEvents` (concrete event constants per type):
```typescript
export const DilemmaEvents = {
  SILVER_GAMBIT: { SUBMIT: 'DILEMMA.SILVER_GAMBIT.SUBMIT' },
  SPOTLIGHT:     { SUBMIT: 'DILEMMA.SPOTLIGHT.SUBMIT' },
  GIFT_OR_GRIEF: { SUBMIT: 'DILEMMA.GIFT_OR_GRIEF.SUBMIT' },
} as const;
```

Do NOT add dilemma events to `ALLOWED_CLIENT_EVENTS` (it's a flat array). Instead, in `ws-handlers.ts`, add `event.type.startsWith(Events.Dilemma.PREFIX)` to the L1 prefix-matching allowlist (matching the pattern used for `VOTE.*`, `GAME.*`, `ACTIVITY.*`).

- [ ] **Step 3: Add Config.dilemma**

In `packages/shared-types/src/config.ts`:
```typescript
dilemma: {
  silverParticipation: 5,       // silver for submitting a decision
  silverGambit: {
    donationCost: 5,            // each player donates this
    jackpotMultiplier: 3,       // winner gets donations * multiplier
  },
  spotlight: {
    unanimousReward: 20,        // target gets this if unanimous
    participationReward: 5,     // everyone gets this just for voting
  },
  giftOrGrief: {
    giftAmount: 10,
    griefAmount: 10,            // deducted (penalty)
  },
},
```

- [ ] **Step 4: Verify types compile**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add DilemmaType, events, config for Daily Dilemma"
```

---

## Task 2: Dilemma Machine Factory + 3 Dilemma Types

**Files:**
- Create: `apps/game-server/src/machines/cartridges/dilemmas/_contract.ts`
- Create: `apps/game-server/src/machines/cartridges/dilemmas/dilemma-machine.ts`
- Create: `apps/game-server/src/machines/cartridges/dilemmas/_registry.ts`
- Create: `apps/game-server/src/machines/cartridges/dilemmas/silver-gambit.ts`
- Create: `apps/game-server/src/machines/cartridges/dilemmas/spotlight.ts`
- Create: `apps/game-server/src/machines/cartridges/dilemmas/gift-or-grief.ts`
- Test: `apps/game-server/src/machines/cartridges/dilemmas/__tests__/dilemma-machine.test.ts`

- [ ] **Step 1: Write failing tests for dilemma machine**

Create `apps/game-server/src/machines/cartridges/dilemmas/__tests__/dilemma-machine.test.ts`:

Test cases:
1. Silver Gambit: all donate → random player gets jackpot, donors get participation silver
2. Silver Gambit: one defects → nobody gets jackpot, defector keeps silver
3. Spotlight: unanimous pick → target gets 20 silver
4. Spotlight: non-unanimous → nobody gets bonus, participation only
5. Gift or Grief: player gets +10 from majority nominators, -10 from lone nominator
6. Machine reaches `done` state after END_DILEMMA with non-submitters handled
7. Eliminated players excluded from eligible voters

Use `.provide()` pattern from `test-cartridge` skill to stub `sendParent` actions.

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run apps/game-server/src/machines/cartridges/dilemmas/__tests__/dilemma-machine.test.ts`
Expected: FAIL (modules don't exist yet)

- [ ] **Step 3: Create contract**

Create `apps/game-server/src/machines/cartridges/dilemmas/_contract.ts`:
```typescript
/**
 * Dilemma Cartridge Contract
 *
 * Every dilemma machine must:
 * - Accept DilemmaCartridgeInput as input
 * - Handle DILEMMA.{TYPE}.SUBMIT events (with senderId + decision payload)
 * - Handle INTERNAL.END_DILEMMA to force-close collecting
 * - Return DilemmaOutput { silverRewards, dilemmaType, summary }
 * - Expose context with { phase, dilemmaType, decisions, eligiblePlayers, results }
 *   for SYNC projection
 *
 * Decision shape varies by dilemma type:
 * - SILVER_GAMBIT: { action: 'DONATE' | 'KEEP' }
 * - SPOTLIGHT: { targetId: string }
 * - GIFT_OR_GRIEF: { targetId: string }
 */
```

- [ ] **Step 4: Create dilemma machine factory**

Create `apps/game-server/src/machines/cartridges/dilemmas/dilemma-machine.ts`:

Factory pattern (similar to `createArcadeMachine`):
```typescript
import { setup, assign, sendParent, enqueueActions } from 'xstate';
import { Events, FactTypes, DilemmaPhases, Config } from '@pecking-order/shared-types';
import type { DilemmaCartridgeInput, DilemmaOutput, DilemmaType } from '@pecking-order/shared-types';

interface DilemmaConfig<TDecision> {
  dilemmaType: DilemmaType;
  validateDecision: (decision: TDecision, senderId: string, context: any) => boolean;
  calculateResults: (
    decisions: Record<string, TDecision>,
    roster: Record<string, any>,
    dayIndex: number,
  ) => { silverRewards: Record<string, number>; summary: Record<string, any> };
}

export function createDilemmaMachine<TDecision>(config: DilemmaConfig<TDecision>) {
  const { dilemmaType, validateDecision, calculateResults } = config;
  const SUBMIT_EVENT = Events.Dilemma.submit(dilemmaType);

  return setup({
    types: {
      context: {} as {
        dilemmaType: DilemmaType;
        roster: Record<string, any>;
        dayIndex: number;
        eligiblePlayers: string[];
        decisions: Record<string, TDecision>;
        phase: string;
        results: { silverRewards: Record<string, number>; summary: Record<string, any> } | null;
      },
      input: {} as DilemmaCartridgeInput,
      output: {} as DilemmaOutput,
    },
    guards: {
      allSubmitted: ({ context }: any) =>
        context.eligiblePlayers.every((pid: string) => pid in context.decisions),
    },
    actions: {
      recordDecision: assign(({ context, event }: any) => {
        const senderId = event.senderId as string;
        if (!context.eligiblePlayers.includes(senderId)) return {};
        if (senderId in context.decisions) return {};
        const { type: _, senderId: _s, ...decision } = event;
        if (!validateDecision(decision as TDecision, senderId, context)) return {};
        return { decisions: { ...context.decisions, [senderId]: decision as TDecision } };
      }),
      finalizeResults: assign(({ context }: any) => {
        const results = calculateResults(context.decisions, context.roster, context.dayIndex);
        return { results, phase: DilemmaPhases.REVEAL };
      }),
      emitResultFact: sendParent(({ context }: any) => ({
        type: Events.Fact.RECORD,
        fact: {
          type: FactTypes.DILEMMA_RESULT,
          actorId: 'SYSTEM',
          payload: {
            dilemmaType: context.dilemmaType,
            decisions: context.decisions,
            results: context.results,
          },
          timestamp: Date.now(),
        },
      })),
    },
  }).createMachine({
    id: `${dilemmaType}-dilemma`,
    context: ({ input }) => {
      const eligible = Object.entries(input.roster)
        .filter(([, p]: any) => p.status === 'ALIVE')
        .map(([id]) => id);
      return {
        dilemmaType: input.dilemmaType,
        roster: input.roster,
        dayIndex: input.dayIndex,
        eligiblePlayers: eligible,
        decisions: {},
        phase: DilemmaPhases.COLLECTING,
        results: null,
      };
    },
    initial: 'collecting',
    output: ({ context }: any) => ({
      dilemmaType: context.dilemmaType,
      silverRewards: context.results?.silverRewards || {},
      summary: context.results?.summary || {},
    }),
    states: {
      collecting: {
        on: {
          [SUBMIT_EVENT]: { actions: 'recordDecision' },
          'INTERNAL.END_DILEMMA': { target: 'completed' },
        },
        always: {
          guard: 'allSubmitted',
          target: 'completed',
        },
      },
      completed: {
        entry: ['finalizeResults', 'emitResultFact'],
        type: 'final',
      },
    },
  });
}
```

- [ ] **Step 5: Create 3 dilemma type configs**

**`silver-gambit.ts`**: All-or-nothing cooperative donation.
- Decision: `{ action: 'DONATE' | 'KEEP' }`
- If ALL donate → jackpot winner selected by hash of `dayIndex + sorted decision timestamps` (not predictable before all submit). Winner gets `donationCost * playerCount * multiplier`.
- If ANY keep → donations lost, keepers get nothing. Donors get participation silver only.

**`spotlight.ts`**: Blind unanimous pick.
- Decision: `{ targetId: string }` (must be another alive player)
- If ALL pick same person → target gets `unanimousReward`
- Everyone who participated gets `participationReward`

**`gift-or-grief.ts`**: Name a player for good or ill.
- Decision: `{ targetId: string }` (must be another alive player)
- Most-nominated player gets `+giftAmount` (gift). If tied, all tied players get the gift.
- Least-nominated player (with at least 1 nomination) gets `-griefAmount` (grief). If tied at bottom, all tied get grief.
- Players with 0 nominations are unaffected.
- All participants get participation silver.

- [ ] **Step 6: Create registry**

Create `apps/game-server/src/machines/cartridges/dilemmas/_registry.ts`:
```typescript
import { silverGambitMachine } from './silver-gambit';
import { spotlightMachine } from './spotlight';
import { giftOrGriefMachine } from './gift-or-grief';

export const DILEMMA_REGISTRY = {
  SILVER_GAMBIT: silverGambitMachine,
  SPOTLIGHT: spotlightMachine,
  GIFT_OR_GRIEF: giftOrGriefMachine,
} as const;
```

- [ ] **Step 7: Run tests — verify they pass**

Run: `npx vitest run apps/game-server/src/machines/cartridges/dilemmas/__tests__/dilemma-machine.test.ts`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add apps/game-server/src/machines/cartridges/dilemmas/
git commit -m "feat(game-server): add dilemma machine factory + 3 types (Silver Gambit, Spotlight, Gift or Grief)"
```

---

## Task 3: L3 Integration — dilemmaLayer Parallel State

**Files:**
- Create: `apps/game-server/src/machines/actions/l3-dilemma.ts`
- Modify: `apps/game-server/src/machines/l3-session.ts`

- [ ] **Step 1: Create L3 dilemma actions**

Create `apps/game-server/src/machines/actions/l3-dilemma.ts`:

Actions needed (follow `l3-activity.ts` pattern exactly):
- `spawnDilemmaCartridge` — read `dilemmaType` from manifest, look up in `DILEMMA_REGISTRY`, spawn with id `'activeDilemmaCartridge'`
- `cleanupDilemmaCartridge` — stop and null out ref
- `forwardToDilemmaChild` — `sendTo('activeDilemmaCartridge', event)`
- `applyDilemmaRewardsLocally` — apply silverRewards to L3 roster
- `forwardDilemmaResultToL2` — `sendParent({ type: Events.Cartridge.DILEMMA_RESULT, result: event.output })`

Register dilemma machines in `setup({ actors: { ... } })` by importing from `DILEMMA_REGISTRY`.

- [ ] **Step 2: Add dilemmaLayer to L3 session**

In `apps/game-server/src/machines/l3-session.ts`, add `dilemmaLayer` as a new parallel region alongside `activityLayer`:

```typescript
dilemmaLayer: {
  initial: 'idle',
  states: {
    idle: {
      on: {
        'INTERNAL.START_DILEMMA': { target: 'playing' }
      }
    },
    playing: {
      entry: ['spawnDilemmaCartridge', sendParent({ type: 'PUSH.PHASE', trigger: 'DILEMMA' } as any)],
      on: {
        'xstate.done.actor.activeDilemmaCartridge': {
          target: 'completed',
          actions: ['applyDilemmaRewardsLocally', 'forwardDilemmaResultToL2']
        },
        'INTERNAL.END_DILEMMA': {
          target: 'completed',
          actions: ['forwardToDilemmaChild', sendParent({ type: 'PUSH.PHASE', trigger: 'END_DILEMMA' } as any)]
        },
        '*': {
          guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Dilemma.PREFIX),
          actions: 'forwardToDilemmaChild',
        }
      }
    },
    completed: {
      on: {
        'INTERNAL.END_DILEMMA': { target: 'idle', actions: 'cleanupDilemmaCartridge' },
        'xstate.done.actor.activeDilemmaCartridge': {
          target: 'idle',
          actions: ['applyDilemmaRewardsLocally', 'forwardDilemmaResultToL2', 'cleanupDilemmaCartridge'],
        }
      }
    }
  }
}
```

Add `activeDilemmaCartridgeRef: AnyActorRef | null` to `DailyContext` interface and initialize to `null` in `buildL3Context()`.

**CRITICAL (XState v5)**: Register dilemma machines in L3's `setup({ actors: { ...DILEMMA_REGISTRY } })` alongside existing registries. Without this, snapshot restore after DO hibernation fails with `this.logic.transition is not a function`.

Add dilemma event types to `DailyEvent` type union:
```typescript
| { type: 'INTERNAL.START_DILEMMA' }
| { type: 'INTERNAL.END_DILEMMA' }
```

- [ ] **Step 3: Type-check**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: Clean

- [ ] **Step 4: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-dilemma.ts apps/game-server/src/machines/l3-session.ts
git commit -m "feat(game-server): add dilemmaLayer parallel state to L3 session"
```

---

## Task 4: L2 Integration — Economy + Orchestrator

**Files:**
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts`
- Modify: `apps/game-server/src/machines/actions/l2-economy.ts`
- Modify: `apps/game-server/src/ws-handlers.ts`
- Modify: `apps/game-server/src/d1-persistence.ts`
- Modify: `apps/game-server/src/ticker.ts`

- [ ] **Step 1: Add DILEMMA_RESULT handler + DILEMMA.* forwarding to L2 orchestrator**

In `l2-orchestrator.ts`:

1. In the `dayLoop` state's `on:` handlers, add result handler:
```typescript
'CARTRIDGE.DILEMMA_RESULT': {
  actions: ['emitDilemmaResultFact', 'raiseDilemmaEconomyEvents', 'recordCompletedDilemma']
},
```

2. **CRITICAL**: In the `'*'` handler chain (~line 206-222) that forwards events to L3, add a case for `DILEMMA.*` events. Without this, client dilemma submit events pass L1 but L2 silently drops them:
```typescript
{
  guard: ({ event }: any) => typeof event.type === 'string' && event.type.startsWith(Events.Dilemma.PREFIX),
  actions: sendTo('l3-session', ({ event }: any) => event),
}
```

Follow the pattern of the existing `VOTE.*`, `GAME.*`, `ACTIVITY.*` forwarding cases.

- [ ] **Step 2: Add economy actions**

In `l2-economy.ts`, add:

```typescript
raiseDilemmaEconomyEvents: enqueueActions(({ enqueue, event }: any) => {
  const result = event.result as DilemmaOutput;
  const silverRewards = result?.silverRewards || {};
  const hasRewards = Object.values(silverRewards).some((v: any) => v > 0);
  if (hasRewards) {
    enqueue.raise({ type: Events.Economy.CREDIT_SILVER, rewards: silverRewards } as any);
  }
}),

emitDilemmaResultFact: raise(({ event }: any) => ({
  type: Events.Fact.RECORD,
  fact: {
    type: FactTypes.DILEMMA_RESULT,
    actorId: 'SYSTEM',
    payload: { dilemmaType: event.result?.dilemmaType, silverRewards: event.result?.silverRewards || {} },
    timestamp: Date.now(),
  },
} as any)),

recordCompletedDilemma: assign({
  completedPhases: ({ context, event }: any) => {
    const result = event.result as DilemmaOutput;
    return [...(context.completedPhases || []), {
      kind: 'dilemma' as const,
      dayIndex: context.dayIndex,
      completedAt: Date.now(),
      dilemmaType: result.dilemmaType || 'UNKNOWN',
      silverRewards: result.silverRewards || {},
      summary: result.summary || {},
    }];
  },
}),
```

- [ ] **Step 3: Add dilemma prefix to L1 allowlist in ws-handlers.ts**

Add `event.type.startsWith(Events.Dilemma.PREFIX)` to the L1 `isAllowed` check (alongside the existing prefix checks for `VOTE.*`, `GAME.*`, `ACTIVITY.*`). This allows dilemma submit events from clients to reach L2.

- [ ] **Step 4: Add FactTypes.DILEMMA_RESULT to d1-persistence.ts**

Add to the persisted facts array.

- [ ] **Step 5: Add dilemma ticker entries**

In `ticker.ts`, add a case for `FactTypes.DILEMMA_RESULT` to generate a ticker message (e.g., "Daily Dilemma resolved!").

Add `TickerCategories.DILEMMA: 'DILEMMA'` in events.ts.

- [ ] **Step 6: Type-check**

Run: `cd apps/game-server && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add apps/game-server/src/machines/l2-orchestrator.ts apps/game-server/src/machines/actions/l2-economy.ts apps/game-server/src/ws-handlers.ts apps/game-server/src/d1-persistence.ts apps/game-server/src/ticker.ts
git commit -m "feat(game-server): add L2 dilemma result handling, economy, and persistence"
```

---

## Task 5: Timeline + Game Master

**Files:**
- Modify: `apps/game-server/src/machines/timeline-presets.ts`
- Modify: `apps/game-server/src/machines/game-master.ts`

- [ ] **Step 1: Add dilemma events to timeline presets**

In `timeline-presets.ts`:

1. Add `dilemmaType: string` to `DayOptions` interface
2. Add `'hasDilemma'` to condition type union
3. Add `meetsCondition` case: `if (condition === 'hasDilemma') return opts.dilemmaType !== 'NONE';`
4. Add to `CANONICAL_EVENTS` — dilemma starts WITH group chat and ends before voting:

```typescript
const CANONICAL_EVENTS: OffsetEventDef[] = [
  { action: 'OPEN_GROUP_CHAT', offsetMin: 0 },
  { action: 'START_DILEMMA',   offsetMin: 1, condition: 'hasDilemma' },  // announce immediately
  { action: 'OPEN_DMS',        offsetMin: 60 },
  { action: 'CLOSE_GROUP_CHAT', offsetMin: 61 },
  { action: 'START_GAME',      offsetMin: 62, condition: 'hasGame' },
  { action: 'END_GAME',        offsetMin: 180, condition: 'hasGame' },
  { action: 'START_ACTIVITY',  offsetMin: 300, condition: 'hasActivity' },
  { action: 'END_ACTIVITY',    offsetMin: 420, condition: 'hasActivity' },
  { action: 'END_DILEMMA',     offsetMin: 600, condition: 'hasDilemma' },  // resolve before voting
  { action: 'OPEN_VOTING',     offsetMin: 660 },
  { action: 'CLOSE_VOTING',    offsetMin: 840 },
  { action: 'CLOSE_DMS',       offsetMin: 841 },
  { action: 'END_DAY',         offsetMin: 899 },
];
```

5. Update all callers of `scaleCanonical` / preset builders to pass `dilemmaType` in `DayOptions`.
6. **IMPORTANT**: Calendar presets (`DEFAULT`, `COMPACT`, `PLAYTEST`) define their own event lists and do NOT use `CANONICAL_EVENTS`. Add `START_DILEMMA`/`END_DILEMMA` entries (with `condition: 'hasDilemma'`) to each calendar preset's events array too. Use appropriate clock times (dilemma starts near group chat, ends before voting).

- [ ] **Step 2: Add resolveDilemmaType to Game Master**

In `game-master.ts`, add `resolveDilemmaType()` following the same pattern as `resolveGameType()` / `resolveActivityType()`.

Add `dilemmas` field to `PeckingOrderRuleset` in shared-types:
```typescript
dilemmas: {
  mode: 'SEQUENCE' | 'POOL' | 'NONE';
  sequence?: DilemmaType[];
  pool?: DilemmaType[];
  allowed?: DilemmaType[];
  avoidRepeat: boolean;
}
```

Wire `resolveDilemmaType()` into `RESOLVE_DAY` handler, output `dilemmaType` alongside `gameType`/`activityType`.

- [ ] **Step 3: Type-check + build**

Run: `cd apps/game-server && npx tsc --noEmit`
Run: `npm run build` (from root)

- [ ] **Step 4: Commit**

```bash
git add apps/game-server/src/machines/timeline-presets.ts apps/game-server/src/machines/game-master.ts packages/shared-types/
git commit -m "feat: add dilemma to timeline presets and Game Master day resolution"
```

---

## Task 6: SYNC Projection

**Files:**
- Modify: `apps/game-server/src/sync.ts`
- Modify: `apps/game-server/src/projections.ts` (if exists, otherwise in sync.ts)

- [ ] **Step 1: Extract activeDilemmaCartridge from L3 children**

In `sync.ts` `extractCartridges()`, add:
```typescript
const dilemmaRef = (l3Snap?.children as any)?.['activeDilemmaCartridge'];
if (dilemmaRef) {
  const dSnap = dilemmaRef.getSnapshot?.();
  activeDilemmaCartridge = dSnap?.context || null;
}
```

- [ ] **Step 2: Create projectDilemmaCartridge() in projections.ts**

Create a projection function (like `projectPromptCartridge()`) that strips sensitive data:

```typescript
export function projectDilemmaCartridge(raw: any): any {
  if (!raw) return null;
  const { dilemmaType, phase, eligiblePlayers, decisions, results } = raw;
  return {
    dilemmaType,
    phase,
    eligiblePlayers,
    // During COLLECTING: only show who submitted, not what they chose
    submitted: Object.fromEntries(eligiblePlayers.map((pid: string) => [pid, pid in (decisions || {})])),
    // During REVEAL: include full decisions and results
    ...(phase === 'REVEAL' ? { decisions, results } : {}),
  };
}
```

- [ ] **Step 3: Add to SYNC payload**

In `buildSyncPayload()`, add `activeDilemmaCartridge: projectDilemmaCartridge(cartridges.activeDilemmaCartridge)` to the returned context. Update `CartridgeSnapshots` interface to include `activeDilemmaCartridge: any`.

- [ ] **Step 3: Type-check**

Run: `cd apps/game-server && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add apps/game-server/src/sync.ts
git commit -m "feat(game-server): project activeDilemmaCartridge in SYNC payload"
```

---

## Task 7: Client — DilemmaCard + Decision UIs

**Files:**
- Create: `apps/client/src/cartridges/dilemmas/DilemmaCard.tsx`
- Create: `apps/client/src/cartridges/dilemmas/SilverGambitInput.tsx`
- Create: `apps/client/src/cartridges/dilemmas/SpotlightInput.tsx`
- Create: `apps/client/src/cartridges/dilemmas/GiftOrGriefInput.tsx`
- Create: `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx`
- Modify: `apps/client/src/store/useGameStore.ts`
- Modify: Vivid shell StageTab or chat view (render DilemmaCard)

- [ ] **Step 1: Extract activeDilemma from SYNC in store**

In `useGameStore.ts`, extract `activeDilemmaCartridge` from the SYNC context and expose it as `activeDilemma`.

- [ ] **Step 2: Create DilemmaCard component**

Persistent card that appears in the stage/chat view when a dilemma is active. Uses `--vivid-*` CSS variables, `@solar-icons/react` icons.

Structure:
- **Header**: Dilemma type name + icon
- **Description**: Human-readable explanation of the dilemma (from a `DILEMMA_DESCRIPTIONS` map keyed by type)
- **Body**: Renders per-type input component during COLLECTING, or DilemmaReveal during REVEAL
- **Status**: Shows who has submitted (checkmarks for submitted, hourglass for pending)
- **Submit confirmation**: After submitting, show "Decision locked in" with Framer Motion animation

- [ ] **Step 3: Create per-type input components**

**SilverGambitInput**: Two buttons — "Donate 5 Silver" (with coin icon) and "Keep Silver" (with shield icon). Show current silver balance.

**SpotlightInput**: Player picker grid (avatars of alive players, excluding self). Tap to select → confirm.

**GiftOrGriefInput**: Same player picker pattern. Explanation: "Choose a player. If the majority agrees, they get +10. If not, they lose -10."

All send `Events.Dilemma.submit(dilemmaType)` with decision payload via PartySocket.

- [ ] **Step 4: Create DilemmaReveal component**

Shared reveal component that animates results:
- Silver Gambit: "Everyone donated! [Player] wins the jackpot!" or "Someone kept their silver... donations lost!"
- Spotlight: "Unanimous! [Player] gets 20 silver!" or "No consensus — picks were split"
- Gift or Grief: Show each player's nomination, highlight who got gifted vs grieved

Use Framer Motion for reveal animations.

- [ ] **Step 5: Wire DilemmaCard into vivid shell**

In the appropriate vivid shell view (StageTab or similar), render `<DilemmaCard />` when `activeDilemma` is not null. Position it as a persistent banner/card above or alongside the chat.

- [ ] **Step 6: Verify client builds**

Run: `cd apps/client && npx vite build`

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/cartridges/dilemmas/ apps/client/src/store/useGameStore.ts apps/client/src/shells/vivid/
git commit -m "feat(client): add DilemmaCard + decision UIs for 3 dilemma types"
```

---

## Task 8: Machine Docs + Integration Test

**Files:**
- Generate: `docs/machines/dilemma-*.json`
- Modify: `apps/game-server/src/machines/cartridges/dilemmas/__tests__/dilemma-machine.test.ts` (if not done in Task 2)

- [ ] **Step 1: Generate machine docs**

Run: `npm run generate:docs`

Verify new files appear in `docs/machines/`:
- `dilemma-silver-gambit.json`
- `dilemma-spotlight.json`
- `dilemma-gift-or-grief.json`

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: All apps build clean

- [ ] **Step 3: Run all tests**

Run: `npm run test`
Expected: All vitest tests pass (including new dilemma tests)

- [ ] **Step 4: Integration test with /create-game**

If dev servers are running, create a test game with a dilemma configured:
- Manually set `dilemmaType: 'SILVER_GAMBIT'` in the manifest
- Inject `START_DILEMMA` via admin endpoint
- Verify DilemmaCard appears in client
- Submit decisions from multiple player tabs
- Inject `END_DILEMMA` → verify results

- [ ] **Step 5: Final commit + ADR**

Add ADR-112 to `plans/DECISIONS.md`:
```
## [ADR-112] Daily Dilemma — Parallel Layer in L3
* Date: 2026-03-22
* Status: Accepted
* Context: Playtest feedback: low engagement between phases. Need a cooperative/defect
  social mechanic that drives conversation when group chat opens.
* Decision: New `dilemmaLayer` parallel state in L3 (like activityLayer). Own timeline
  events (START_DILEMMA/END_DILEMMA), own cartridge registry, own SYNC projection.
  Doesn't interfere with game/activity/voting slots — a day can have all four.
  Three initial types: SILVER_GAMBIT, SPOTLIGHT, GIFT_OR_GRIEF.
* Consequences: Additive change — no existing machines modified. Each dilemma type
  is a config passed to createDilemmaMachine() factory. Future types just add config.
```

```bash
git add .
git commit -m "feat: Daily Dilemma — parallel L3 layer with 3 dilemma types (ADR-112)"
```

---

## Task 9: DemoServer Update

**Files:**
- Modify: `apps/game-server/src/demo/` (check if DemoServer needs dilemma state)

Per CLAUDE.md: "After changes to L2/L3 machines, SYNC payload shape — check if DemoServer needs updating."

- [ ] **Step 1: Check DemoServer**

Read `apps/game-server/src/demo/` files. If the demo server constructs fake SYNC payloads, add `activeDilemmaCartridge: null` to avoid client errors.

- [ ] **Step 2: Commit if changed**

```bash
git add apps/game-server/src/demo/
git commit -m "chore: update DemoServer for dilemma SYNC field"
```
