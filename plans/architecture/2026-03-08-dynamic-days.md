# Dynamic Days Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support runtime day resolution alongside static manifests, using a discriminated manifest union and a game director actor.

**Architecture:** The manifest becomes a discriminated union (`STATIC` | `DYNAMIC`). Static mode is the current code path — zero changes. Dynamic mode adds a director actor (L2.5) that observes gameplay via `FACT.*` events and resolves each day's config at runtime. The `days[]` array starts empty and grows as the director appends resolved days.

**Tech Stack:** TypeScript, XState v5, Zod, Vitest

**Design Doc:** `plans/architecture/dynamic-days-design.md`

---

## Phase 3a: Types + Manifest Union (no behavioral change)

The goal of this phase is to lay the type foundation. After this phase, all existing tests pass unchanged. No runtime behavior changes.

---

### Task 1: Add manifest kind types to shared-types

**Files:**
- Modify: `packages/shared-types/src/index.ts:60-175` (schemas section)

**Step 1: Write the failing test**

Create test file:
- Create: `packages/shared-types/src/__tests__/manifest.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  StaticManifestSchema,
  DynamicManifestSchema,
  GameManifestSchema,
  normalizeManifest,
  SchedulePresetSchema,
  type GameManifest,
  type StaticManifest,
  type DynamicManifest,
} from '../index';

describe('GameManifest discriminated union', () => {
  it('parses a StaticManifest', () => {
    const raw = {
      kind: 'STATIC' as const,
      scheduling: 'PRE_SCHEDULED' as const,
      days: [{ dayIndex: 1, theme: 'Day 1', voteType: 'MAJORITY', gameType: 'NONE', timeline: [] }],
    };
    const result = StaticManifestSchema.parse(raw);
    expect(result.kind).toBe('STATIC');
    expect(result.days).toHaveLength(1);
  });

  it('parses a DynamicManifest', () => {
    const raw = {
      kind: 'DYNAMIC' as const,
      scheduling: 'PRE_SCHEDULED' as const,
      ruleset: {
        kind: 'PECKING_ORDER' as const,
        voting: { mode: 'SEQUENCE' as const, sequence: ['MAJORITY', 'BUBBLE', 'FINALS'] },
        games: { mode: 'NONE' as const, avoidRepeat: false },
        activities: { mode: 'NONE' as const, avoidRepeat: false },
        social: {
          dmChars: { mode: 'FIXED' as const, base: 1200 },
          dmPartners: { mode: 'FIXED' as const, base: 3 },
          dmCost: 1,
          groupDmEnabled: true,
        },
        inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' as const },
        dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' as const },
      },
      schedulePreset: 'DEFAULT' as const,
      maxPlayers: 8,
      days: [],
    };
    const result = DynamicManifestSchema.parse(raw);
    expect(result.kind).toBe('DYNAMIC');
    expect(result.ruleset.kind).toBe('PECKING_ORDER');
    expect(result.days).toHaveLength(0);
  });

  it('rejects invalid manifest kind', () => {
    const raw = { kind: 'INVALID', scheduling: 'PRE_SCHEDULED', days: [] };
    expect(() => GameManifestSchema.parse(raw)).toThrow();
  });

  it('normalizes legacy manifest (no kind) to StaticManifest', () => {
    const legacy = {
      id: 'test',
      gameMode: 'CONFIGURABLE_CYCLE',
      scheduling: 'PRE_SCHEDULED',
      days: [{ dayIndex: 1, theme: 'Day 1', voteType: 'MAJORITY', gameType: 'NONE', timeline: [] }],
    };
    const result = normalizeManifest(legacy);
    expect(result.kind).toBe('STATIC');
    expect(result.days).toHaveLength(1);
  });

  it('passes through already-typed manifests unchanged', () => {
    const typed: StaticManifest = {
      kind: 'STATIC',
      scheduling: 'PRE_SCHEDULED',
      days: [{ dayIndex: 1, theme: 'Day 1', voteType: 'MAJORITY', gameType: 'NONE', timeline: [] }],
    };
    const result = normalizeManifest(typed);
    expect(result).toEqual(typed);
  });
});

describe('SchedulePreset', () => {
  it('accepts valid presets', () => {
    expect(SchedulePresetSchema.parse('DEFAULT')).toBe('DEFAULT');
    expect(SchedulePresetSchema.parse('COMPACT')).toBe('COMPACT');
    expect(SchedulePresetSchema.parse('SPEED_RUN')).toBe('SPEED_RUN');
  });

  it('rejects invalid presets', () => {
    expect(() => SchedulePresetSchema.parse('INVALID')).toThrow();
  });
});

describe('DailyManifest social parameters', () => {
  it('accepts optional dmCharsPerPlayer and dmPartnersPerPlayer', () => {
    const day = {
      dayIndex: 1,
      theme: 'Day 1',
      voteType: 'MAJORITY',
      gameType: 'NONE',
      timeline: [],
      dmCharsPerPlayer: 800,
      dmPartnersPerPlayer: 2,
    };
    // Should not throw — DailyManifestSchema accepts these fields
    const result = StaticManifestSchema.parse({
      kind: 'STATIC',
      scheduling: 'PRE_SCHEDULED',
      days: [day],
    });
    expect(result.days[0].dmCharsPerPlayer).toBe(800);
  });

  it('defaults to undefined when social params not provided', () => {
    const day = { dayIndex: 1, theme: 'Day 1', voteType: 'MAJORITY', gameType: 'NONE', timeline: [] };
    const result = StaticManifestSchema.parse({ kind: 'STATIC', scheduling: 'PRE_SCHEDULED', days: [day] });
    expect(result.days[0].dmCharsPerPlayer).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && npx vitest run src/__tests__/manifest.test.ts`
Expected: FAIL — `StaticManifestSchema`, `DynamicManifestSchema`, `normalizeManifest`, `SchedulePresetSchema` don't exist yet.

**Step 3: Implement the types**

In `packages/shared-types/src/index.ts`, add the following after the existing `SchedulingStrategySchema` (around line 163):

```ts
// --- Schedule Presets ---

export const SchedulePresetSchema = z.enum(['DEFAULT', 'COMPACT', 'SPEED_RUN']);
export type SchedulePreset = z.infer<typeof SchedulePresetSchema>;

// --- Scaling Mode (for social rules) ---

export const ScalingModeSchema = z.enum(['FIXED', 'PER_ACTIVE_PLAYER', 'DIMINISHING']);
export type ScalingMode = z.infer<typeof ScalingModeSchema>;

// --- Pecking Order Ruleset Sub-Configs ---

export const PeckingOrderVotingRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL']),
  sequence: z.array(VoteTypeSchema).optional(),
  pool: z.array(VoteTypeSchema).optional(),
  constraints: z.array(z.object({
    voteType: VoteTypeSchema,
    minPlayers: z.number(),
  })).optional(),
});
export type PeckingOrderVotingRules = z.infer<typeof PeckingOrderVotingRulesSchema>;

export const PeckingOrderGameRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL', 'NONE']),
  sequence: z.array(GameTypeSchema).optional(),
  pool: z.array(GameTypeSchema).optional(),
  avoidRepeat: z.boolean(),
});
export type PeckingOrderGameRules = z.infer<typeof PeckingOrderGameRulesSchema>;

export const PeckingOrderActivityRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL', 'NONE']),
  sequence: z.array(PromptTypeSchema).optional(),
  pool: z.array(PromptTypeSchema).optional(),
  avoidRepeat: z.boolean(),
});
export type PeckingOrderActivityRules = z.infer<typeof PeckingOrderActivityRulesSchema>;

export const PeckingOrderSocialRulesSchema = z.object({
  dmChars: z.object({ mode: ScalingModeSchema, base: z.number(), floor: z.number().optional() }),
  dmPartners: z.object({ mode: ScalingModeSchema, base: z.number(), floor: z.number().optional() }),
  dmCost: z.number(),
  groupDmEnabled: z.boolean(),
});
export type PeckingOrderSocialRules = z.infer<typeof PeckingOrderSocialRulesSchema>;

export const PeckingOrderInactivityRulesSchema = z.object({
  enabled: z.boolean(),
  thresholdDays: z.number(),
  socketInactivityHours: z.number().optional(),
  action: z.enum(['ELIMINATE', 'NUDGE_THEN_ELIMINATE']),
  nudgeDays: z.number().optional(),
});
export type PeckingOrderInactivityRules = z.infer<typeof PeckingOrderInactivityRulesSchema>;

export const PeckingOrderDayCountRulesSchema = z.object({
  mode: z.enum(['ACTIVE_PLAYERS_MINUS_ONE', 'FIXED']),
  fixedCount: z.number().optional(),
  maxDays: z.number().optional(),
});
export type PeckingOrderDayCountRules = z.infer<typeof PeckingOrderDayCountRulesSchema>;

// --- GameRuleset (discriminated union) ---

export const PeckingOrderRulesetSchema = z.object({
  kind: z.literal('PECKING_ORDER'),
  voting: PeckingOrderVotingRulesSchema,
  games: PeckingOrderGameRulesSchema,
  activities: PeckingOrderActivityRulesSchema,
  social: PeckingOrderSocialRulesSchema,
  inactivity: PeckingOrderInactivityRulesSchema,
  dayCount: PeckingOrderDayCountRulesSchema,
});
export type PeckingOrderRuleset = z.infer<typeof PeckingOrderRulesetSchema>;

export const GameRulesetSchema = z.discriminatedUnion('kind', [
  PeckingOrderRulesetSchema,
]);
export type GameRuleset = z.infer<typeof GameRulesetSchema>;
```

Update `DailyManifestSchema` (line 101) to add optional social parameters:

```ts
export const DailyManifestSchema = z.object({
  dayIndex: z.number(),
  theme: z.string(),
  voteType: VoteTypeSchema,
  gameType: GameTypeSchema.default("NONE"),
  gameMode: z.enum(["SOLO", "LIVE"]).optional(),
  timeline: z.array(TimelineEventSchema),
  dmCharsPerPlayer: z.number().optional(),
  dmPartnersPerPlayer: z.number().optional(),
});
```

Replace the existing `GameManifestSchema` (line 165) with the discriminated union:

```ts
// --- Manifest Discriminated Union ---

const ManifestKindSchema = z.enum(['STATIC', 'DYNAMIC']);
export type ManifestKind = z.infer<typeof ManifestKindSchema>;

export const StaticManifestSchema = z.object({
  kind: z.literal('STATIC'),
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
  // Legacy fields — kept for backward compat with persisted snapshots
  id: z.string().optional(),
  gameMode: z.enum(["PECKING_ORDER", "CONFIGURABLE_CYCLE", "DEBUG_PECKING_ORDER"]).optional(),
});
export type StaticManifest = z.infer<typeof StaticManifestSchema>;

export const DynamicManifestSchema = z.object({
  kind: z.literal('DYNAMIC'),
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  ruleset: GameRulesetSchema,
  schedulePreset: SchedulePresetSchema,
  maxPlayers: z.number(),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
  // Legacy fields
  id: z.string().optional(),
  gameMode: z.enum(["PECKING_ORDER", "CONFIGURABLE_CYCLE", "DEBUG_PECKING_ORDER"]).optional(),
});
export type DynamicManifest = z.infer<typeof DynamicManifestSchema>;

export const GameManifestSchema = z.discriminatedUnion('kind', [
  StaticManifestSchema,
  DynamicManifestSchema,
]);
export type GameManifest = z.infer<typeof GameManifestSchema>;

/**
 * Normalize a raw manifest (possibly from a legacy snapshot) into the
 * typed GameManifest discriminated union. Legacy manifests without a
 * `kind` field are treated as StaticManifest.
 */
export function normalizeManifest(raw: any): GameManifest {
  if (raw?.kind === 'STATIC' || raw?.kind === 'DYNAMIC') {
    return raw as GameManifest;
  }
  // Legacy manifest — no kind field. Treat as STATIC.
  return { kind: 'STATIC' as const, ...raw };
}
```

Keep the old `GameManifest` type export name so downstream code doesn't break.

**Step 4: Run test to verify it passes**

Run: `cd packages/shared-types && npx vitest run src/__tests__/manifest.test.ts`
Expected: PASS

**Step 5: Build all packages to check for type errors**

Run: `npm run build --workspace=packages/shared-types && npm run build --workspace=apps/game-server`
Expected: Success (may need type adjustments — see Task 2)

**Step 6: Commit**

```bash
git add packages/shared-types/src/index.ts packages/shared-types/src/__tests__/manifest.test.ts
git commit -m "feat: add manifest discriminated union and GameRuleset types"
```

---

### Task 2: Normalize manifest in L2 initialization

**Files:**
- Modify: `apps/game-server/src/machines/actions/l2-initialization.ts:5-37`
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts:15-35` (GameContext)

**Step 1: Update GameContext to use the new GameManifest type**

In `l2-orchestrator.ts`, ensure the `GameContext` interface uses `GameManifest` from shared-types (it should already, but verify the import path).

The `manifest` field type is `GameManifest | null` — the discriminated union replaces the old single schema. No field changes needed.

**Step 2: Add normalizeManifest call in initializeContext**

In `l2-initialization.ts`, update the `manifest` assignment (around line 29):

```ts
import { normalizeManifest } from '@pecking-order/shared-types';

// Inside initializeContext assign:
manifest: ({ event }: any) => {
  if (event.type !== Events.System.INIT) return null;
  return normalizeManifest(event.payload.manifest);
},
```

**Step 3: Add normalizeManifest call in snapshot restore**

In `apps/game-server/src/snapshot.ts`, inside `parseSnapshot` (line 77), normalize the manifest in the restored context:

```ts
import { normalizeManifest } from '@pecking-order/shared-types';

// After parsing l2Snapshot, normalize its manifest:
if (l2Snapshot?.context?.manifest) {
  l2Snapshot.context.manifest = normalizeManifest(l2Snapshot.context.manifest);
}
```

**Step 4: Build to verify**

Run: `npm run build --workspace=apps/game-server`
Expected: Success. All existing code that reads `manifest.days`, `manifest.scheduling`, etc. still works because both `StaticManifest` and `DynamicManifest` have these fields.

**Step 5: Run existing tests**

Run: `cd apps/game-server && npx vitest run`
Expected: All existing tests pass.

**Step 6: Commit**

```bash
git add apps/game-server/src/machines/actions/l2-initialization.ts apps/game-server/src/snapshot.ts apps/game-server/src/machines/l2-orchestrator.ts
git commit -m "feat: normalize manifest to discriminated union on init and restore"
```

---

### Task 3: Update lobby to emit manifest kind

**Files:**
- Modify: `apps/lobby/app/actions.ts:160-182` (manifest building)

**Step 1: Add `kind: 'STATIC'` to manifest payload**

In the `createGame` function, where the manifest payload is built (around line 172), add the `kind` field:

```ts
const payload = {
  lobbyId: `lobby-${now}`,
  inviteCode,
  roster: {},
  manifest: {
    kind: 'STATIC' as const,
    id: `manifest-${gameId}`,
    gameMode: mode, // legacy compat
    scheduling: 'PRE_SCHEDULED' as const,
    days,
    pushConfig: config.pushConfig,
  },
};
```

**Step 2: Update the default (admin-driven) path too**

Find the `DEBUG_PECKING_ORDER` code path in `createGame` that builds a manifest. Add `kind: 'STATIC'` there as well.

Also update the E2E fixture:

In `e2e/fixtures/game-setup.ts`, add `kind: 'STATIC' as const` to the test manifest.

**Step 3: Build lobby**

Run: `npm run build --workspace=apps/lobby`
Expected: Success

**Step 4: Commit**

```bash
git add apps/lobby/app/actions.ts e2e/fixtures/game-setup.ts
git commit -m "feat: lobby emits manifest kind: STATIC"
```

---

### Task 4: Update speed-run skill to emit manifest kind

**Files:**
- Modify: `.claude/commands/speed-run.md` (or `.claude/skills/speed-run.md`)

**Step 1: Update the manifest in the speed-run skill**

The speed-run skill builds a manifest in its instructions. Update it to include `kind: 'STATIC'`. Find the manifest building section and ensure it includes:

```json
{
  "kind": "STATIC",
  "gameMode": "CONFIGURABLE_CYCLE",
  "scheduling": "PRE_SCHEDULED",
  "days": [...]
}
```

**Step 2: Commit**

```bash
git add .claude/
git commit -m "feat: speed-run skill emits manifest kind: STATIC"
```

---

### Task 5: Add DailyManifest social params to L3 input

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts:16-31` (DailyContext), `:83-105` (context factory)
- Modify: `apps/game-server/src/machines/actions/l3-social.ts:3,90,282,322` (DM limit references)

**Step 1: Write the failing test**

- Create: `apps/game-server/src/machines/__tests__/l3-social-limits.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { dailySessionMachine } from '../l3-session';
import type { DailyManifest, SocialPlayer } from '@pecking-order/shared-types';

function makeRoster(count: number): Record<string, SocialPlayer> {
  const roster: Record<string, SocialPlayer> = {};
  for (let i = 0; i < count; i++) {
    roster[`p${i}`] = {
      id: `p${i}`, personaName: `Player ${i}`, avatarUrl: '',
      status: 'ALIVE', silver: 50, gold: 0, realUserId: `u${i}`,
    } as SocialPlayer;
  }
  return roster;
}

describe('L3 social limits from manifest', () => {
  it('uses default DM limits when manifest has no social params', () => {
    const actor = createActor(dailySessionMachine, {
      input: {
        dayIndex: 1,
        roster: makeRoster(4),
        manifest: { dayIndex: 1, theme: 'Day 1', voteType: 'MAJORITY', gameType: 'NONE', timeline: [] } as DailyManifest,
      },
    });
    actor.start();
    const ctx = actor.getSnapshot().context;
    expect(ctx.dmCharsLimit).toBe(1200);
    expect(ctx.dmPartnersLimit).toBe(3);
    actor.stop();
  });

  it('uses custom DM limits from manifest social params', () => {
    const actor = createActor(dailySessionMachine, {
      input: {
        dayIndex: 1,
        roster: makeRoster(4),
        manifest: {
          dayIndex: 1, theme: 'Day 1', voteType: 'MAJORITY', gameType: 'NONE', timeline: [],
          dmCharsPerPlayer: 800,
          dmPartnersPerPlayer: 2,
        } as DailyManifest,
      },
    });
    actor.start();
    const ctx = actor.getSnapshot().context;
    expect(ctx.dmCharsLimit).toBe(800);
    expect(ctx.dmPartnersLimit).toBe(2);
    actor.stop();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-social-limits.test.ts`
Expected: FAIL — `dmCharsLimit` and `dmPartnersLimit` don't exist on context yet.

**Step 3: Add social limit fields to L3 context**

In `l3-session.ts`, update `DailyContext` (line 16):

```ts
export interface DailyContext {
  // ... existing fields ...
  dmCharsLimit: number;
  dmPartnersLimit: number;
}
```

Update context factory (line 83):

```ts
context: ({ input }: any) => ({
  // ... existing fields ...
  dmCharsLimit: input.manifest?.dmCharsPerPlayer ?? DM_MAX_CHARS_PER_DAY,
  dmPartnersLimit: input.manifest?.dmPartnersPerPlayer ?? DM_MAX_PARTNERS_PER_DAY,
}),
```

Import the constants at the top of `l3-session.ts`:

```ts
import { DM_MAX_CHARS_PER_DAY, DM_MAX_PARTNERS_PER_DAY } from '@pecking-order/shared-types';
```

**Step 4: Update l3-social.ts to read from context instead of constants**

In `l3-social.ts`, change the hardcoded constant references to read from context:

Line 90 (in rejectChannelMessage):
```ts
// Before:
const charLimit = DM_MAX_CHARS_PER_DAY + overrides.extraChars;
// After:
const charLimit = context.dmCharsLimit + overrides.extraChars;
```

Line 322 (in isChannelMessageAllowed):
```ts
// Before:
const charLimit = DM_MAX_CHARS_PER_DAY + overrides.extraChars;
// After:
const charLimit = context.dmCharsLimit + overrides.extraChars;
```

Note: Find ALL references to `DM_MAX_CHARS_PER_DAY` and `DM_MAX_PARTNERS_PER_DAY` in l3-social.ts and replace with context reads. The constants import can remain for the default values in l3-session.ts context factory.

**Step 5: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-social-limits.test.ts`
Expected: PASS

**Step 6: Run all tests**

Run: `cd apps/game-server && npx vitest run`
Expected: All tests pass (existing behavior unchanged — defaults match constants).

**Step 7: Build**

Run: `npm run build --workspace=apps/game-server`
Expected: Success

**Step 8: Commit**

```bash
git add apps/game-server/src/machines/l3-session.ts apps/game-server/src/machines/actions/l3-social.ts apps/game-server/src/machines/__tests__/l3-social-limits.test.ts
git commit -m "feat: L3 reads DM limits from manifest instead of hardcoded constants"
```

---

### Task 6: Speed run verification

**Step 1: Run speed run**

Invoke `/speed-run` to verify the full game cycle still works with all changes.

**Step 2: Verify**

Expected: Full game cycle completes (preGame → dayLoop ×3 → gameSummary → gameOver).

**Step 3: Commit if any fixes were needed**

---

## Phase 3b: Director Actor + Dynamic Day Resolution

> Phase 3b builds on 3a. Only start after 3a is complete and verified.

---

### Task 7: Implement the director actor machine

**Files:**
- Create: `apps/game-server/src/machines/director.ts`
- Create: `apps/game-server/src/machines/__tests__/director.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { createDirectorMachine, type DirectorInput } from '../director';
import type { PeckingOrderRuleset } from '@pecking-order/shared-types';

const baseRuleset: PeckingOrderRuleset = {
  kind: 'PECKING_ORDER',
  voting: { mode: 'SEQUENCE', sequence: ['MAJORITY', 'BUBBLE', 'FINALS'] },
  games: { mode: 'NONE', avoidRepeat: false },
  activities: { mode: 'NONE', avoidRepeat: false },
  social: {
    dmChars: { mode: 'FIXED', base: 1200 },
    dmPartners: { mode: 'FIXED', base: 3 },
    dmCost: 1,
    groupDmEnabled: true,
  },
  inactivity: { enabled: false, thresholdDays: 2, action: 'ELIMINATE' },
  dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' },
};

function makeInput(overrides?: Partial<DirectorInput>): DirectorInput {
  return {
    dayIndex: 1,
    roster: {
      p0: { id: 'p0', personaName: 'Viper', avatarUrl: '', status: 'ALIVE', silver: 50, gold: 0, realUserId: 'u0' },
      p1: { id: 'p1', personaName: 'Phoenix', avatarUrl: '', status: 'ALIVE', silver: 50, gold: 0, realUserId: 'u1' },
      p2: { id: 'p2', personaName: 'Shadow', avatarUrl: '', status: 'ALIVE', silver: 50, gold: 0, realUserId: 'u2' },
      p3: { id: 'p3', personaName: 'Ember', avatarUrl: '', status: 'ALIVE', silver: 50, gold: 0, realUserId: 'u3' },
    } as any,
    ruleset: baseRuleset,
    schedulePreset: 'DEFAULT',
    gameHistory: [],
    completedPhases: [],
    ...overrides,
  };
}

describe('Director actor', () => {
  it('resolves day 1 with SEQUENCE voting — picks first vote type', () => {
    const actor = createActor(createDirectorMachine(), { input: makeInput() });
    actor.start();
    const ctx = actor.getSnapshot().context;
    expect(ctx.resolvedDay).toBeDefined();
    expect(ctx.resolvedDay?.voteType).toBe('MAJORITY');
    expect(ctx.resolvedDay?.dayIndex).toBe(1);
    actor.stop();
  });

  it('resolves day 2 with SEQUENCE voting — picks second vote type', () => {
    const actor = createActor(createDirectorMachine(), { input: makeInput({ dayIndex: 2 }) });
    actor.start();
    expect(actor.getSnapshot().context.resolvedDay?.voteType).toBe('BUBBLE');
    actor.stop();
  });

  it('always uses FINALS for the last day', () => {
    // 4 players → 3 days. Day 3 should be FINALS.
    const actor = createActor(createDirectorMachine(), { input: makeInput({ dayIndex: 3 }) });
    actor.start();
    expect(actor.getSnapshot().context.resolvedDay?.voteType).toBe('FINALS');
    actor.stop();
  });

  it('computes totalDays as alivePlayers - 1', () => {
    const actor = createActor(createDirectorMachine(), { input: makeInput() });
    actor.start();
    expect(actor.getSnapshot().context.totalDays).toBe(3); // 4 players - 1
    actor.stop();
  });

  it('respects maxDays cap', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE', maxDays: 2 },
    };
    const actor = createActor(createDirectorMachine(), { input });
    actor.start();
    expect(actor.getSnapshot().context.totalDays).toBe(2);
    actor.stop();
  });

  it('applies DIMINISHING social scaling', () => {
    const input = makeInput({ dayIndex: 3 });
    input.ruleset = {
      ...baseRuleset,
      social: {
        ...baseRuleset.social,
        dmChars: { mode: 'DIMINISHING', base: 1200, floor: 400 },
      },
    };
    const actor = createActor(createDirectorMachine(), { input });
    actor.start();
    const chars = actor.getSnapshot().context.resolvedDay?.dmCharsPerPlayer;
    expect(chars).toBeDefined();
    expect(chars!).toBeLessThan(1200);
    expect(chars!).toBeGreaterThanOrEqual(400);
    actor.stop();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/director.test.ts`
Expected: FAIL — `createDirectorMachine` doesn't exist yet.

**Step 3: Implement the director machine**

Create `apps/game-server/src/machines/director.ts`:

```ts
import { setup, assign, type AnyEventObject } from 'xstate';
import type {
  PeckingOrderRuleset,
  SchedulePreset,
  SocialPlayer,
  VoteType,
  GameType,
  DailyManifest,
  GameHistoryEntry,
  FactTypes,
} from '@pecking-order/shared-types';
import { log } from '../log';

export interface DirectorInput {
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  gameHistory: GameHistoryEntry[];
  completedPhases: Array<{ kind: string; dayIndex: number; [key: string]: any }>;
}

export interface DirectorContext {
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  gameHistory: GameHistoryEntry[];
  completedPhases: Array<{ kind: string; dayIndex: number; [key: string]: any }>;
  totalDays: number;
  resolvedDay: DailyManifest | null;
  observations: {
    factCounts: Record<string, number>;
    activePlayerIds: Set<string>;
  };
  reasoning: string;
}

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
  // Last day is always FINALS
  if (dayIndex >= totalDays) return 'FINALS';

  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    const candidate = rules.sequence[idx];
    // Check constraints
    if (rules.constraints) {
      const constraint = rules.constraints.find(c => c.voteType === candidate);
      if (constraint && alivePlayers < constraint.minPlayers) {
        return 'MAJORITY'; // fallback
      }
    }
    return candidate;
  }

  if (rules.mode === 'POOL' && rules.pool) {
    // For now, pick sequentially from pool (director can be smarter later)
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

function scaleValue(
  dayIndex: number,
  totalDays: number,
  rule: { mode: string; base: number; floor?: number },
): number {
  if (rule.mode === 'FIXED') return rule.base;

  if (rule.mode === 'DIMINISHING') {
    // Linear decrease from base to floor over totalDays
    const floor = rule.floor ?? Math.floor(rule.base * 0.3);
    const progress = Math.min((dayIndex - 1) / Math.max(totalDays - 1, 1), 1);
    return Math.round(rule.base - (rule.base - floor) * progress);
  }

  if (rule.mode === 'PER_ACTIVE_PLAYER') {
    // Handled externally — return base (director can adjust based on observations)
    return rule.base;
  }

  return rule.base;
}

export function createDirectorMachine() {
  return setup({
    types: {
      input: {} as DirectorInput,
      context: {} as DirectorContext,
      events: {} as
        | { type: 'FACT.RECORD'; fact: { type: string; actorId: string; targetId?: string; payload?: any } }
        | { type: 'ADMIN.OVERRIDE_NEXT_DAY'; day: Partial<DailyManifest> },
    },
  }).createMachine({
    id: 'director',
    initial: 'observing',
    context: ({ input }) => {
      const alive = countAlivePlayers(input.roster);
      const totalDays = computeTotalDays(alive, input.ruleset.dayCount);
      const voteType = resolveVoteType(input.dayIndex, totalDays, input.ruleset.voting, alive);
      const gameType = resolveGameType(input.dayIndex, input.ruleset.games, input.gameHistory);
      const social = resolveSocialParams(input.dayIndex, totalDays, input.ruleset.social);

      const resolvedDay: DailyManifest = {
        dayIndex: input.dayIndex,
        theme: `Day ${input.dayIndex}`,
        voteType,
        gameType,
        timeline: [], // Timeline stamped by L2 from schedulePreset
        ...social,
      };

      return {
        dayIndex: input.dayIndex,
        roster: input.roster,
        ruleset: input.ruleset,
        schedulePreset: input.schedulePreset,
        gameHistory: input.gameHistory,
        completedPhases: input.completedPhases,
        totalDays,
        resolvedDay,
        observations: {
          factCounts: {},
          activePlayerIds: new Set<string>(),
        },
        reasoning: `Day ${input.dayIndex}/${totalDays}: ${voteType} vote, ${gameType} game, ${social.dmCharsPerPlayer} DM chars`,
      };
    },
    states: {
      observing: {
        on: {
          'FACT.RECORD': {
            actions: assign({
              observations: ({ context, event }) => {
                const obs = { ...context.observations };
                const factType = event.fact.type;
                obs.factCounts = { ...obs.factCounts, [factType]: (obs.factCounts[factType] || 0) + 1 };
                if (event.fact.actorId && event.fact.actorId !== 'SYSTEM') {
                  obs.activePlayerIds = new Set([...obs.activePlayerIds, event.fact.actorId]);
                }
                return obs;
              },
            }),
          },
          'ADMIN.OVERRIDE_NEXT_DAY': {
            actions: assign({
              resolvedDay: ({ context, event }) => {
                if (!context.resolvedDay) return null;
                return { ...context.resolvedDay, ...event.day };
              },
              reasoning: ({ context }) => `${context.reasoning} [ADMIN OVERRIDE]`,
            }),
          },
        },
      },
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/director.test.ts`
Expected: PASS

**Step 5: Build**

Run: `npm run build --workspace=apps/game-server`
Expected: Success

**Step 6: Commit**

```bash
git add apps/game-server/src/machines/director.ts apps/game-server/src/machines/__tests__/director.test.ts
git commit -m "feat: implement game director actor for dynamic day resolution"
```

---

### Task 8: Wire director into L2 orchestrator

**Files:**
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts:15-35,135-138,139-227,228-261`
- Modify: `apps/game-server/src/machines/actions/l2-initialization.ts`

**Step 1: Add `resolveCurrentDay` action**

Create or extend `apps/game-server/src/machines/actions/l2-day-resolution.ts`:

```ts
import { enqueueActions } from 'xstate';
import type { GameManifest, DailyManifest, DynamicManifest } from '@pecking-order/shared-types';
import { log } from '../../log';

export const l2DayResolutionActions = {
  resolveCurrentDay: enqueueActions(({ enqueue, context }: any) => {
    const manifest = context.manifest as GameManifest | null;
    if (!manifest) return;

    // Static mode: day already exists in manifest.days[]
    if (manifest.kind === 'STATIC') return;

    // Dynamic mode: director output should already be set from previous night
    // On day 1, the director is spawned in activeSession and resolves immediately
    // The resolved day is appended to manifest.days[] via the director's output
    log('info', 'L2', 'Dynamic day resolution', { dayIndex: context.dayIndex, kind: manifest.kind });
  }),

  appendResolvedDay: enqueueActions(({ enqueue, context }: any) => {
    // Called when director resolves a day — appends to manifest.days[]
    const director = context.directorOutput as DailyManifest | null;
    if (!director) return;

    const manifest = context.manifest as DynamicManifest;
    enqueue.assign({
      manifest: {
        ...manifest,
        days: [...manifest.days, director],
      },
      directorOutput: null,
    });
  }),
};
```

**Step 2: Update GameContext with director-related fields**

In `l2-orchestrator.ts`, add to `GameContext`:

```ts
directorOutput: DailyManifest | null;
```

Initialize in `l2-initialization.ts`:

```ts
directorOutput: null,
```

**Step 3: Update morningBriefing entry**

In `l2-orchestrator.ts`, line 136:

```ts
morningBriefing: {
  entry: ['incrementDay', 'resolveCurrentDay', 'clearRestoredChatLog', raise({ type: 'PUSH.PHASE', trigger: 'DAY_START' } as any)],
  always: 'activeSession'
},
```

**Step 4: Update nightSummary game-over guard**

The guard `context.dayIndex >= (context.manifest?.days.length ?? Infinity)` needs to work for dynamic mode where `days[]` grows. For dynamic manifests, use the director's `totalDays` instead:

```ts
// In nightSummary always guards:
{
  guard: ({ context }: any) => {
    const manifest = context.manifest;
    if (!manifest) return false;
    if (manifest.kind === 'DYNAMIC') {
      // Director determines total days — check if we've reached the limit
      // totalDays is on the director's context, passed back as directorOutput metadata
      // For now, use dayIndex >= alivePlayers - 1 as the termination check
      const alive = Object.values(context.roster).filter((p: any) => p.status === 'ALIVE').length;
      return alive <= 2; // FINALS already happened, game should end
    }
    return context.dayIndex >= (manifest.days.length ?? Infinity);
  },
  target: '#pecking-order-l2.gameSummary',
},
```

**Step 5: Wire FACT.RECORD forwarding to director**

In the `activeSession` state's `FACT.RECORD` handler, add director forwarding:

```ts
'FACT.RECORD': {
  actions: [
    'updateJournalTimestamp',
    'applyFactToRoster',
    'persistFactToD1',
    // Forward to director (dynamic mode only — action is a no-op if no director)
    'forwardFactToDirector',
  ],
},
```

**Step 6: Build and test**

Run: `npm run build --workspace=apps/game-server && cd apps/game-server && npx vitest run`
Expected: All pass. Static mode is unchanged.

**Step 7: Commit**

```bash
git add apps/game-server/src/machines/l2-orchestrator.ts apps/game-server/src/machines/actions/l2-initialization.ts apps/game-server/src/machines/actions/l2-day-resolution.ts
git commit -m "feat: wire director into L2 morningBriefing + FACT forwarding"
```

---

### Task 9: Speed run verification (full Phase 3a+3b)

**Step 1: Run speed run**

Invoke `/speed-run` — verify static mode still works end-to-end.

**Step 2: Manual test dynamic mode**

Write a quick bash script or use curl to create a game with `kind: 'DYNAMIC'` manifest and verify the director resolves days correctly. This can be a variation of the speed-run flow with a dynamic manifest payload.

**Step 3: Commit any fixes**

---

### Task 10: Update design docs + ADR

**Files:**
- Modify: `plans/DECISIONS.md` (add ADR for dynamic days)
- Modify: `plans/architecture/server-refactor-and-dynamic-days.md` (update Phase 3 status)

**Step 1: Add ADR**

Add ADR-094 (or next number) documenting:
- Manifest discriminated union pattern
- GameRuleset discriminated union
- Director actor design
- Schedule presets as lobby-side templates
- Static mode unchanged

**Step 2: Update refactor plan**

Mark Phase 3 sub-steps as complete/in-progress.

**Step 3: Commit**

```bash
git add plans/
git commit -m "docs: ADR-094 dynamic days + update refactor plan status"
```
