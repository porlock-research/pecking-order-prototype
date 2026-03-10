# Phase 3c: Dynamic Mode Lobby Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable dynamic mode game creation from the lobby — host configures whitelists and rules, Game Master decides mechanics at runtime.

**Architecture:** Three layers change: (1) shared-types gains whitelist fields on the ruleset + activityType on DailyManifest, (2) game-master.ts resolution functions read whitelists + resolve activities, (3) lobby UI adds Static/Dynamic toggle + ruleset builder component, and actions.ts builds a DynamicManifest. The game server's L2/L3 pipeline is unchanged — it already handles DynamicManifest via the discriminated union.

**Tech Stack:** TypeScript, Zod (shared-types), XState v5 (game-master), Next.js + Tailwind (lobby), Vitest (tests)

---

## Context for Implementer

### Key Files
- `packages/shared-types/src/index.ts` — Zod schemas for manifest, ruleset, DailyManifest
- `apps/game-server/src/machines/game-master.ts` — Game Master actor with day resolution
- `apps/game-server/src/machines/__tests__/game-master.test.ts` — Game Master tests
- `apps/lobby/app/page.tsx` — Lobby UI (game config form)
- `apps/lobby/app/actions.ts` — Server actions (createGame, buildManifestDays)
- `apps/lobby/app/components/DynamicRulesetBuilder.tsx` — UI component (already created, needs wiring)

### How It Works Today
- Lobby builds a `StaticManifest` (kind: 'STATIC', days with timelines pre-built)
- POSTs to `/parties/game-server/{gameId}/init` with roster + manifest
- Game server processes days sequentially; L2 reads `manifest.days[dayIndex]` each morning
- In dynamic mode (not yet lobby-wired), Game Master resolves each day at runtime via `GAME_MASTER.RESOLVE_DAY` and appends to `manifest.days[]`

### What Changes
1. Ruleset types: voting/games/activities gain `allowed` whitelist arrays
2. DailyManifest: gains optional `activityType` field
3. Game Master: resolution functions read `allowed` whitelists instead of `sequence`/`pool`; new `resolveActivityType()` function
4. Lobby: Static/Dynamic toggle, ruleset builder, `createGame()` builds DynamicManifest
5. Scheduling: Dynamic mode uses `ADMIN` scheduling (Game Master drives day-by-day), timeline events come from schedule preset templates

---

### Task 1: Add whitelist fields to ruleset types

**Files:**
- Modify: `packages/shared-types/src/index.ts:186-211` (voting/games/activities schemas)

**Step 1: Add `allowed` arrays to ruleset sub-config schemas**

In `packages/shared-types/src/index.ts`, add optional `allowed` fields to each sub-config:

```typescript
// Line 186 — PeckingOrderVotingRulesSchema
export const PeckingOrderVotingRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL']).optional(),  // optional for dynamic (whitelist-only)
  sequence: z.array(VoteTypeSchema).optional(),
  pool: z.array(VoteTypeSchema).optional(),
  allowed: z.array(VoteTypeSchema).optional(),     // NEW: whitelist for dynamic mode
  constraints: z.array(z.object({
    voteType: VoteTypeSchema,
    minPlayers: z.number(),
  })).optional(),
});

// Line 197 — PeckingOrderGameRulesSchema
export const PeckingOrderGameRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL', 'NONE']).optional(),  // optional for dynamic
  sequence: z.array(GameTypeSchema).optional(),
  pool: z.array(GameTypeSchema).optional(),
  allowed: z.array(GameTypeSchema).optional(),             // NEW
  avoidRepeat: z.boolean().default(true),                  // default true for dynamic
});

// Line 205 — PeckingOrderActivityRulesSchema
export const PeckingOrderActivityRulesSchema = z.object({
  mode: z.enum(['SEQUENCE', 'POOL', 'NONE']).optional(),  // optional for dynamic
  sequence: z.array(PromptTypeSchema).optional(),
  pool: z.array(PromptTypeSchema).optional(),
  allowed: z.array(PromptTypeSchema).optional(),           // NEW
  avoidRepeat: z.boolean().default(true),
});
```

**Step 2: Add `activityType` to DailyManifestSchema**

In `packages/shared-types/src/index.ts` line 101:

```typescript
export const DailyManifestSchema = z.object({
  dayIndex: z.number(),
  theme: z.string(),
  voteType: VoteTypeSchema,
  gameType: GameTypeSchema.default("NONE"),
  gameMode: z.enum(["SOLO", "LIVE"]).optional(),
  activityType: PromptTypeSchema.or(z.literal('NONE')).optional(),  // NEW
  timeline: z.array(TimelineEventSchema),
  dmCharsPerPlayer: z.number().optional(),
  dmPartnersPerPlayer: z.number().optional(),
});
```

**Step 3: Build and verify no type errors**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p packages/shared-types/tsconfig.json`
Expected: PASS (all fields are optional, no downstream breakage)

Run: `cd /Users/manu/Projects/pecking-order && npm run build --workspace=apps/game-server`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add whitelist fields + activityType to manifest schemas"
```

---

### Task 2: Update Game Master resolution to use whitelists

**Files:**
- Modify: `apps/game-server/src/machines/game-master.ts:55-157` (resolution functions)
- Modify: `apps/game-server/src/machines/__tests__/game-master.test.ts`

**Step 1: Write failing tests for whitelist-based resolution**

Add these tests to `apps/game-server/src/machines/__tests__/game-master.test.ts`:

```typescript
describe('Game Master whitelist-based resolution', () => {
  it('picks vote type from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      voting: { allowed: ['EXECUTIONER', 'SHIELD', 'BUBBLE'] },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['EXECUTIONER', 'SHIELD', 'BUBBLE']).toContain(ctx.resolvedDay?.voteType);
  });

  it('always uses FINALS on last day even with whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      voting: { allowed: ['EXECUTIONER', 'SHIELD'] },
    };
    const ctx = resolveAndGetContext(input, 3); // 4 players = 3 days, day 3 = last
    expect(ctx.resolvedDay?.voteType).toBe('FINALS');
  });

  it('picks game type from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { allowed: ['TRIVIA', 'GAP_RUN'], avoidRepeat: true },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['TRIVIA', 'GAP_RUN']).toContain(ctx.resolvedDay?.gameType);
  });

  it('returns NONE for games when allowed is empty', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { allowed: [], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.gameType).toBe('NONE');
  });

  it('resolves activity type from allowed whitelist', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      activities: { allowed: ['CONFESSION', 'HOT_TAKE'], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(['CONFESSION', 'HOT_TAKE']).toContain(ctx.resolvedDay?.activityType);
  });

  it('returns NONE for activities when allowed is empty', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      activities: { allowed: [], avoidRepeat: false },
    };
    const ctx = resolveAndGetContext(input, 1);
    expect(ctx.resolvedDay?.activityType).toBe('NONE');
  });

  it('avoids repeating game types when avoidRepeat is true', () => {
    const input = makeInput();
    input.ruleset = {
      ...baseRuleset,
      games: { allowed: ['TRIVIA', 'GAP_RUN', 'SEQUENCE'], avoidRepeat: true },
    };
    // Day 1
    const ctx1 = resolveAndGetContext(input, 1);
    // Day 2 with history
    input.gameHistory = [{ gameType: ctx1.resolvedDay?.gameType } as any];
    const ctx2 = resolveAndGetContext(input, 2);
    expect(ctx2.resolvedDay?.gameType).not.toBe(ctx1.resolvedDay?.gameType);
  });

  it('filters vote types by minPlayers constraints', () => {
    const input = makeInput({ roster: makeRoster(3) }); // only 3 alive
    input.ruleset = {
      ...baseRuleset,
      voting: {
        allowed: ['BUBBLE', 'MAJORITY'],  // BUBBLE needs 6+
        constraints: [{ voteType: 'BUBBLE', minPlayers: 6 }],
      },
    };
    // totalDays = 2, day 1 is not last day
    const ctx = resolveAndGetContext(input, 1, makeRoster(3));
    expect(ctx.resolvedDay?.voteType).toBe('MAJORITY'); // BUBBLE filtered out
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/manu/Projects/pecking-order && npx vitest run apps/game-server/src/machines/__tests__/game-master.test.ts`
Expected: FAIL — whitelist resolution not implemented yet

**Step 3: Update resolution functions in game-master.ts**

Replace `resolveVoteType` (line 55-78):

```typescript
function resolveVoteType(
  dayIndex: number,
  totalDays: number,
  rules: PeckingOrderRuleset['voting'],
  alivePlayers: number,
): VoteType {
  if (dayIndex >= totalDays) return 'FINALS';

  // Whitelist mode (dynamic): pick from allowed pool
  if (rules.allowed && rules.allowed.length > 0) {
    let pool = [...rules.allowed].filter(v => v !== 'FINALS'); // FINALS reserved for last day
    // Apply constraints
    if (rules.constraints) {
      pool = pool.filter(v => {
        const c = rules.constraints!.find(c => c.voteType === v);
        return !c || alivePlayers >= c.minPlayers;
      });
    }
    if (pool.length === 0) return 'MAJORITY'; // fallback
    const idx = (dayIndex - 1) % pool.length;
    return pool[idx];
  }

  // Legacy strategy mode (static)
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
```

Replace `resolveGameType` (line 80-101):

```typescript
function resolveGameType(
  dayIndex: number,
  rules: PeckingOrderRuleset['games'],
  gameHistory: GameHistoryEntry[],
): GameType {
  // Whitelist mode (dynamic)
  if (rules.allowed) {
    if (rules.allowed.length === 0) return 'NONE';
    let pool = [...rules.allowed].filter(g => g !== 'NONE');
    if (pool.length === 0) return 'NONE';
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastGame = gameHistory[gameHistory.length - 1];
      const filtered = pool.filter(g => g !== lastGame?.gameType);
      if (filtered.length > 0) pool = filtered;
    }
    const idx = (dayIndex - 1) % pool.length;
    return pool[idx];
  }

  // Legacy strategy mode (static)
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
```

Add new `resolveActivityType` function after `resolveGameType`:

```typescript
function resolveActivityType(
  dayIndex: number,
  rules: PeckingOrderRuleset['activities'],
  gameHistory: GameHistoryEntry[],
): PromptType | 'NONE' {
  // Whitelist mode (dynamic)
  if (rules.allowed) {
    if (rules.allowed.length === 0) return 'NONE';
    let pool = [...rules.allowed];
    if (rules.avoidRepeat && gameHistory.length > 0) {
      const lastActivity = gameHistory[gameHistory.length - 1];
      const filtered = pool.filter(a => a !== lastActivity?.activityType);
      if (filtered.length > 0) pool = filtered;
    }
    const idx = (dayIndex - 1) % pool.length;
    return pool[idx];
  }

  // Legacy strategy mode — activities not resolved by Game Master in static mode
  if (rules.mode === 'NONE') return 'NONE';
  if (rules.mode === 'SEQUENCE' && rules.sequence) {
    const idx = Math.min(dayIndex - 1, rules.sequence.length - 1);
    return rules.sequence[idx];
  }
  if (rules.mode === 'POOL' && rules.pool) {
    return rules.pool[(dayIndex - 1) % rules.pool.length];
  }
  return 'NONE';
}
```

Add `PromptType` to the imports at the top of game-master.ts:

```typescript
import type {
  PeckingOrderRuleset,
  SchedulePreset,
  SocialPlayer,
  VoteType,
  GameType,
  PromptType,      // NEW
  DailyManifest,
  GameHistoryEntry,
  GameMasterAction,
} from '@pecking-order/shared-types';
```

Update the `resolveDay` helper (line 133-157) to include activityType:

```typescript
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
  const activityType = resolveActivityType(dayIndex, ruleset.activities, gameHistory);
  const social = resolveSocialParams(dayIndex, totalDays, ruleset.social);

  return {
    resolvedDay: {
      dayIndex,
      theme: `Day ${dayIndex}`,
      voteType,
      gameType,
      activityType: activityType !== 'NONE' ? activityType : undefined,
      timeline: [],
      ...social,
    },
    totalDays,
    reasoning: `Day ${dayIndex}/${totalDays}: ${voteType} vote, ${gameType} game, ${activityType} activity, ${social.dmCharsPerPlayer} DM chars`,
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/manu/Projects/pecking-order && npx vitest run apps/game-server/src/machines/__tests__/game-master.test.ts`
Expected: ALL PASS (existing tests still pass, new whitelist tests pass)

**Step 5: Build to verify no type errors**

Run: `cd /Users/manu/Projects/pecking-order && npm run build --workspace=apps/game-server`
Expected: PASS

**Step 6: Commit**

```bash
git add apps/game-server/src/machines/game-master.ts apps/game-server/src/machines/__tests__/game-master.test.ts
git commit -m "feat(game-master): add whitelist-based resolution for votes, games, and activities"
```

---

### Task 3: Wire lobby Static/Dynamic toggle + state management

**Files:**
- Modify: `apps/lobby/app/page.tsx:182-197` (state declarations), `519-537` (mode selector), `380-415` (handleCreateGame)
- Modify: `apps/lobby/app/components/DynamicRulesetBuilder.tsx` (already created, import + use)

**Step 1: Add manifestKind state and dynamic config state**

In `apps/lobby/app/page.tsx`, add imports at the top (after existing imports):

```typescript
import { DynamicRulesetBuilder, createDefaultDynamicConfig } from './components/DynamicRulesetBuilder';
import type { DynamicRulesetConfig } from './components/DynamicRulesetBuilder';
```

Add state declarations after `configurableConfig` state (around line 190):

```typescript
const [manifestKind, setManifestKind] = useState<'STATIC' | 'DYNAMIC'>('STATIC');
const [dynamicConfig, setDynamicConfig] = useState<DynamicRulesetConfig>(createDefaultDynamicConfig);
```

**Step 2: Add the Static/Dynamic toggle UI**

After the game mode selector (line 537, after the closing `</div>` of the Configuration section), add:

```tsx
{/* Manifest Kind Toggle */}
{!gameId && (
  <div className="flex items-center justify-between border border-skin-base rounded-lg bg-skin-input/40 p-3">
    <div>
      <span className="text-xs font-bold text-skin-dim uppercase tracking-widest font-display">
        {manifestKind === 'STATIC' ? 'Static' : 'Dynamic'}
      </span>
      <span className="block text-[10px] font-mono text-skin-dim/40 mt-0.5">
        {manifestKind === 'STATIC'
          ? 'Configure each day upfront'
          : 'Game Master decides day-by-day'}
      </span>
    </div>
    <label className="relative cursor-pointer">
      <input
        type="checkbox"
        checked={manifestKind === 'DYNAMIC'}
        onChange={() => setManifestKind(prev => prev === 'STATIC' ? 'DYNAMIC' : 'STATIC')}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-skin-input border border-skin-base rounded-full peer-checked:bg-skin-gold/30 peer-checked:border-skin-gold/50 transition-all" />
      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-skin-dim/60 rounded-full peer-checked:translate-x-4 peer-checked:bg-skin-gold transition-all" />
    </label>
  </div>
)}
```

**Step 3: Conditionally render config panels based on manifestKind**

Wrap the existing Debug and Configurable panels to only show when STATIC:

```tsx
{/* Existing Debug Manifest Panel — guard with STATIC */}
{manifestKind === 'STATIC' && isDebugMode && !gameId && (
  // ... existing debug panel JSX unchanged ...
)}

{/* Existing Configurable Cycle Panel — guard with STATIC */}
{manifestKind === 'STATIC' && isConfigurableMode && !gameId && (
  // ... existing configurable panel JSX unchanged ...
)}

{/* Dynamic Ruleset Builder — only when DYNAMIC */}
{manifestKind === 'DYNAMIC' && !gameId && (
  <div className="space-y-3">
    <label className="text-xs font-bold text-skin-dim uppercase tracking-widest pl-1 font-display">
      Game Master Ruleset
    </label>
    <DynamicRulesetBuilder
      config={dynamicConfig}
      onChange={setDynamicConfig}
    />
  </div>
)}
```

**Step 4: Update Push Alerts visibility to include DYNAMIC**

Change the push alerts guard (line 785):

```tsx
{(isDebugMode || isConfigurableMode || manifestKind === 'DYNAMIC') && !gameId && (
```

Use dynamic config's push config when in dynamic mode. Add a pushConfig field to DynamicRulesetConfig (or reuse the existing pushConfig pattern — simplest to handle in the handleCreateGame function).

**Step 5: Verify lobby builds**

Run: `cd /Users/manu/Projects/pecking-order && npm run dev --workspace=apps/lobby`
Expected: No build errors, toggle renders, switching between Static/Dynamic shows correct panels

**Step 6: Commit**

```bash
git add apps/lobby/app/page.tsx apps/lobby/app/components/DynamicRulesetBuilder.tsx
git commit -m "feat(lobby): add Static/Dynamic toggle + DynamicRulesetBuilder component"
```

---

### Task 4: Wire createGame() to build DynamicManifest

**Files:**
- Modify: `apps/lobby/app/actions.ts:117-204` (createGame function)
- Modify: `apps/lobby/app/page.tsx:380-415` (handleCreateGame)

**Step 1: Update createGame() signature to accept dynamic config**

In `apps/lobby/app/actions.ts`, update the function signature:

```typescript
export async function createGame(
  mode: 'CONFIGURABLE_CYCLE' | 'DEBUG_PECKING_ORDER',
  config?: DebugManifestConfig | ConfigurableManifestConfig,
  dynamicManifest?: {
    kind: 'DYNAMIC';
    ruleset: any;
    schedulePreset: string;
    maxPlayers: number;
    pushConfig?: Record<string, boolean>;
  }
): Promise<{ success: boolean; gameId?: string; inviteCode?: string; error?: string }> {
```

**Step 2: Add dynamic manifest branch in createGame()**

After the existing `if (mode === 'CONFIGURABLE_CYCLE' && config)` block (line 160-201), add a new branch before the closing return:

```typescript
  // For DYNAMIC mode: init DO with a DynamicManifest (empty days[], GM resolves at runtime)
  if (dynamicManifest) {
    try {
      const env = await getEnv();
      const GAME_SERVER_HOST = (env.GAME_SERVER_HOST as string) || 'http://localhost:8787';
      const AUTH_SECRET = (env.AUTH_SECRET as string) || 'dev-secret-change-me';

      const payload = {
        lobbyId: `lobby-${now}`,
        inviteCode,
        roster: {},
        manifest: {
          kind: 'DYNAMIC' as const,
          id: `manifest-${gameId}`,
          gameMode: 'CONFIGURABLE_CYCLE', // legacy compat
          scheduling: 'PRE_SCHEDULED' as const,
          ruleset: dynamicManifest.ruleset,
          schedulePreset: dynamicManifest.schedulePreset,
          maxPlayers: dynamicManifest.maxPlayers,
          days: [],
          pushConfig: dynamicManifest.pushConfig,
        },
      };

      const validated = InitPayloadSchema.parse(payload);
      const targetUrl = `${GAME_SERVER_HOST}/parties/game-server/${gameId}/init`;

      const res = await fetch(targetUrl, {
        method: 'POST',
        body: JSON.stringify(validated),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AUTH_SECRET}`,
        },
      });
      res.body?.cancel();

      console.log(`[Lobby] Auto-initialized DO for DYNAMIC game ${gameId}`);
    } catch (err: any) {
      console.error('[Lobby] Failed to auto-init DYNAMIC DO:', err);
    }
  }
```

**Step 3: Update handleCreateGame() in page.tsx**

In `apps/lobby/app/page.tsx`, update `handleCreateGame()` (line 380):

```typescript
async function handleCreateGame() {
  setIsLoading(true);
  setStatus('CREATING_GAME...');
  setGameId(null);
  setInviteCode(null);
  setTokens(null);

  await new Promise(r => setTimeout(r, 400));

  if (manifestKind === 'DYNAMIC') {
    // Build the PeckingOrderRuleset from the UI config
    const rulesetFromConfig = {
      kind: 'PECKING_ORDER' as const,
      voting: {
        allowed: dynamicConfig.allowedVoteTypes,
        constraints: [
          // Pull constraints from cycle-defaults metadata
          { voteType: 'BUBBLE', minPlayers: 6 },
          { voteType: 'TRUST_PAIRS', minPlayers: 5 },
          { voteType: 'PODIUM_SACRIFICE', minPlayers: 5 },
          { voteType: 'EXECUTIONER', minPlayers: 5 },
          { voteType: 'SHIELD', minPlayers: 4 },
        ].filter(c => dynamicConfig.allowedVoteTypes.includes(c.voteType)),
      },
      games: {
        allowed: dynamicConfig.allowedGameTypes,
        avoidRepeat: true,
      },
      activities: {
        allowed: dynamicConfig.allowedActivityTypes,
        avoidRepeat: true,
      },
      social: dynamicConfig.social,
      inactivity: dynamicConfig.inactivity,
      dayCount: dynamicConfig.dayCount,
    };

    const result = await createGame('CONFIGURABLE_CYCLE', undefined, {
      kind: 'DYNAMIC',
      ruleset: rulesetFromConfig,
      schedulePreset: dynamicConfig.schedulePreset,
      maxPlayers: 8, // default max — could be configurable later
    });

    setIsLoading(false);
    if (result.success) {
      setStatus(`GAME_CREATED: ${result.gameId}`);
      setGameId(result.gameId ?? null);
      setInviteCode(result.inviteCode ?? null);
    } else {
      setStatus(`ERROR: ${result.error}`);
    }
    return;
  }

  // Existing static flow (unchanged)
  const config = mode === 'DEBUG_PECKING_ORDER'
    ? debugConfig
    : mode === 'CONFIGURABLE_CYCLE'
      ? toISOConfigurableConfig(configurableConfig)
      : undefined;
  const result = await createGame(mode, config);
  setIsLoading(false);

  if (result.success) {
    setStatus(`GAME_CREATED: ${result.gameId}`);
    setGameId(result.gameId ?? null);
    setInviteCode(result.inviteCode ?? null);

    const validEmails = inviteEmails.filter(e => e.trim() && e.includes('@'));
    if (validEmails.length > 0 && result.inviteCode) {
      for (const email of validEmails) {
        sendEmailInvite(result.inviteCode, email.trim()).catch(() => {});
      }
      setEmailInviteStatuses(
        Object.fromEntries(validEmails.map((_, i) => [i, 'sent']))
      );
    }
  } else {
    setStatus(`ERROR: ${result.error}`);
  }
}
```

**Step 4: Verify lobby builds and dynamic game creation works**

Run: `cd /Users/manu/Projects/pecking-order && npm run dev --workspace=apps/lobby`
Expected: No build errors

Manual test: Toggle to Dynamic, configure ruleset, click Create Game. Check terminal output for `[Lobby] Auto-initialized DO for DYNAMIC game ...`.

**Step 5: Commit**

```bash
git add apps/lobby/app/actions.ts apps/lobby/app/page.tsx
git commit -m "feat(lobby): wire createGame() to build DynamicManifest from ruleset config"
```

---

### Task 5: Update GameHistoryEntry for activity tracking

**Files:**
- Modify: `packages/shared-types/src/index.ts` (GameHistoryEntry type)

The `GameHistoryEntry` type needs an `activityType` field so the Game Master can implement `avoidRepeat` for activities. Check the current type:

**Step 1: Find and update GameHistoryEntry**

Search for `GameHistoryEntry` in shared-types and add `activityType`:

```typescript
export interface GameHistoryEntry {
  dayIndex: number;
  gameType?: GameType;
  activityType?: PromptType;  // NEW
  // ... existing fields
}
```

This is optional — only populated when the Game Master resolves activities. Static mode doesn't set it.

**Step 2: Build to verify**

Run: `cd /Users/manu/Projects/pecking-order && npm run build --workspace=apps/game-server`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add activityType to GameHistoryEntry"
```

---

### Task 6: Integration test — dynamic game via speed-run

**Files:**
- No new files — uses existing `/speed-run` skill

**Step 1: Start the game server**

Run: `cd /Users/manu/Projects/pecking-order && npm run dev --workspace=apps/game-server`

**Step 2: Create a dynamic game via curl**

```bash
GAME_ID="dynamic-test-$(date +%s)"
AUTH="dev-secret-change-me"
HOST="http://localhost:8787"

# Init with DynamicManifest
curl -s -X POST "$HOST/parties/game-server/$GAME_ID/init" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH" \
  -d '{
    "roster": {},
    "inviteCode": "DYN-TEST",
    "manifest": {
      "kind": "DYNAMIC",
      "gameMode": "CONFIGURABLE_CYCLE",
      "scheduling": "PRE_SCHEDULED",
      "ruleset": {
        "kind": "PECKING_ORDER",
        "voting": { "allowed": ["MAJORITY", "EXECUTIONER", "BUBBLE"] },
        "games": { "allowed": ["TRIVIA", "GAP_RUN"], "avoidRepeat": true },
        "activities": { "allowed": ["PLAYER_PICK", "CONFESSION"], "avoidRepeat": true },
        "social": {
          "dmChars": { "mode": "DIMINISHING", "base": 1200, "floor": 400 },
          "dmPartners": { "mode": "DIMINISHING", "base": 3, "floor": 1 },
          "dmCost": 1,
          "groupDmEnabled": true
        },
        "inactivity": { "enabled": false, "thresholdDays": 2, "action": "ELIMINATE" },
        "dayCount": { "mode": "ACTIVE_PLAYERS_MINUS_ONE" }
      },
      "schedulePreset": "SPEED_RUN",
      "maxPlayers": 4,
      "days": []
    }
  }'

# Add 4 players
for i in 0 1 2 3; do
  NAMES=("Viper" "Phoenix" "Shadow" "Ember")
  curl -s -X POST "$HOST/parties/game-server/$GAME_ID/player-joined" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH" \
    -d "{\"playerId\": \"p$i\", \"realUserId\": \"sr-user-p$i\", \"personaName\": \"${NAMES[$i]}\", \"avatarUrl\": \"\", \"bio\": \"\", \"silver\": 50}"
done

# Check state — should be preGame
curl -s "$HOST/parties/game-server/$GAME_ID/state" | python3 -c "import sys,json; d=json.load(sys.stdin); print('State:', d.get('state'))"
```

**Step 3: Run through the game using ADMIN.NEXT_STAGE**

Since dynamic mode uses empty timelines, use admin-driven progression (same as speed-run):

```bash
# Start game
curl -s -X POST "$HOST/parties/game-server/$GAME_ID/admin" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH" -d '{"type":"NEXT_STAGE"}'
sleep 0.5

# For each day: inject timeline events, then advance
for day in 1 2 3; do
  for event in OPEN_GROUP_CHAT OPEN_DMS CLOSE_GROUP_CHAT CLOSE_DMS OPEN_VOTING CLOSE_VOTING; do
    curl -s -X POST "$HOST/parties/game-server/$GAME_ID/admin" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH" \
      -d "{\"type\":\"INJECT_TIMELINE_EVENT\",\"payload\":{\"action\":\"$event\"}}"
    sleep 0.3
  done
  # END_DAY
  curl -s -X POST "$HOST/parties/game-server/$GAME_ID/admin" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH" \
    -d '{"type":"INJECT_TIMELINE_EVENT","payload":{"action":"END_DAY"}}'
  sleep 0.5

  STATE=$(curl -s "$HOST/parties/game-server/$GAME_ID/state" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('state'))")
  echo "After day $day: $STATE"

  # Advance to next day (or game end)
  curl -s -X POST "$HOST/parties/game-server/$GAME_ID/admin" -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH" -d '{"type":"NEXT_STAGE"}'
  sleep 0.5
done

# Final state
curl -s "$HOST/parties/game-server/$GAME_ID/state" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Final state:', d.get('state'))
roster = d.get('roster', {})
for pid, p in roster.items():
    print(f'  {p[\"personaName\"]:12s} {p[\"status\"]:12s} {p[\"silver\"]} silver')
"
```

**Step 4: Verify**

Expected:
- Game reaches `gameSummary` or `gameOver`
- Each day the Game Master picked from the allowed whitelists (check server logs)
- Vote types are from `[MAJORITY, EXECUTIONER, BUBBLE]` + FINALS on last day
- 3 days total (4 players - 1)
- One player remains ALIVE

**Step 5: Cleanup**

```bash
curl -s -X POST "$HOST/parties/game-server/$GAME_ID/cleanup" -H "Authorization: Bearer $AUTH"
```

---

### Task 7: Update feature doc + memory

**Files:**
- Modify: `plans/architecture/feature-dynamic-days.md`
- Modify: `/Users/manu/.claude/projects/-Users-manu-Projects-pecking-order/memory/MEMORY.md`

**Step 1: Update feature-dynamic-days.md**

Update the status line:
```
**Status**: Phase 3a+3b+3c+3d complete
```

Add Phase 3c section under Phase 3d:

```markdown
### Phase 3c: Lobby Integration (complete)

The lobby gained a Static/Dynamic toggle. In dynamic mode, the per-day config is replaced by a Ruleset Builder:

1. **Whitelists.** Host selects which vote types, game types, and activity types the Game Master may use. Game Master picks from these pools at runtime.
2. **Social scaling.** DM characters and partners (FIXED or DIMINISHING), DM cost, group DM toggle.
3. **Inactivity rules.** Enabled toggle, threshold days, action.
4. **Day count.** ACTIVE_PLAYERS_MINUS_ONE or FIXED, with optional max cap.
5. **Schedule preset.** DEFAULT, COMPACT, or SPEED_RUN — defines daily timing.

Lobby builds a `DynamicManifest` with empty `days[]` and a populated `ruleset` + `schedulePreset`. Same `/init` endpoint, same two-phase init. The Game Master fills days at runtime.

Type changes: voting/games/activities rules gained `allowed` whitelist arrays. `DailyManifest` gained optional `activityType`. Resolution functions in `game-master.ts` check `allowed` before `sequence`/`pool` — backward compatible.
```

**Step 2: Commit**

```bash
git add plans/architecture/feature-dynamic-days.md
git commit -m "docs: update feature-dynamic-days.md with Phase 3c completion"
```
