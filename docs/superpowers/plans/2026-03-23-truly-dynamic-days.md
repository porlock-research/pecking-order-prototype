# Truly Dynamic Days Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove fixed `maxPlayers`/slot count from dynamic game creation. Players join freely, game adapts to whoever shows up.

**Architecture:** Schema change (`maxPlayers` optional, add `minPlayers`), lobby changes (dynamic slot creation on join, `minPlayers` guard on start), game server change (preGame WAKEUP guard for `minPlayers`). Game server L2/L3/L4/GM machines untouched.

**Tech Stack:** Zod schemas (shared-types), Next.js server actions (lobby), Cloudflare DO (game-server)

**Spec:** `docs/superpowers/specs/2026-03-23-truly-dynamic-days-design.md`

---

### Task 1: Schema — Make maxPlayers optional, add minPlayers

**Files:**
- Modify: `packages/shared-types/src/index.ts:312-323`

- [ ] **Step 1: Update DynamicManifestSchema**

In `packages/shared-types/src/index.ts`, find `DynamicManifestSchema` (line 312) and change:

```typescript
// Before:
export const DynamicManifestSchema = z.object({
  kind: z.literal('DYNAMIC'),
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  startTime: z.string(),
  ruleset: GameRulesetSchema,
  schedulePreset: SchedulePresetSchema,
  maxPlayers: z.number(),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
  ...legacyManifestFields,
});

// After:
export const DynamicManifestSchema = z.object({
  kind: z.literal('DYNAMIC'),
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  startTime: z.string(),
  ruleset: GameRulesetSchema,
  schedulePreset: SchedulePresetSchema,
  maxPlayers: z.number().optional(),
  minPlayers: z.number().min(2).default(3),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
  ...legacyManifestFields,
});
```

- [ ] **Step 2: Verify existing manifest-types tests still pass**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/manifest-types.test.ts`
Expected: All pass. Existing tests that pass `maxPlayers: 8` still work (number is still valid for optional field). Tests that omit `maxPlayers` now also work.

- [ ] **Step 3: Run shared-types build**

Run: `cd packages/shared-types && npm run build`
Expected: Clean build. The `DynamicManifest` type now has `maxPlayers?: number` and `minPlayers: number` (with default 3).

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): make maxPlayers optional, add minPlayers to DynamicManifest"
```

---

### Task 2: Lobby — Skip slot pre-creation for DYNAMIC games

**Files:**
- Modify: `apps/lobby/app/actions.ts:122-214`

**Context:** Currently `createGame()` always creates invite slots in a loop (lines 162-170): `for (let i = 1; i <= playerCount; i++)`. For DYNAMIC games, we should skip this loop — slots will be created on the fly when players accept invites.

- [ ] **Step 1: Skip slot pre-creation for DYNAMIC mode**

In `createGame()`, wrap the slot creation loop in a condition. Find lines 161-170:

```typescript
// Before:
  // Create invite slots
  const stmts = [];
  for (let i = 1; i <= playerCount; i++) {
    stmts.push(
      db
        .prepare('INSERT INTO Invites (game_id, slot_index, created_at) VALUES (?, ?, ?)')
        .bind(gameId, i, now)
    );
  }
  await db.batch(stmts);

// After:
  // Create invite slots (DYNAMIC games create slots on-the-fly at join time)
  if (!dynamicManifestOverride) {
    const stmts = [];
    for (let i = 1; i <= playerCount; i++) {
      stmts.push(
        db
          .prepare('INSERT INTO Invites (game_id, slot_index, created_at) VALUES (?, ?, ?)')
          .bind(gameId, i, now)
      );
    }
    await db.batch(stmts);
  }
```

- [ ] **Step 2: Remove maxPlayers from dynamicManifestOverride type and pass minPlayers**

Update the `dynamicManifestOverride` parameter type and the manifest payload. In `createGame()` (around line 125):

```typescript
// Before:
  dynamicManifestOverride?: {
    kind: 'DYNAMIC';
    ruleset: any;
    schedulePreset: string;
    maxPlayers: number;
    startTime: string;
    pushConfig?: Record<string, boolean>;
  }

// After:
  dynamicManifestOverride?: {
    kind: 'DYNAMIC';
    ruleset: any;
    schedulePreset: string;
    maxPlayers?: number;
    minPlayers?: number;
    startTime: string;
    pushConfig?: Record<string, boolean>;
  }
```

Then update the manifest payload (around line 183-194):

```typescript
// Before:
        manifest: {
          kind: 'DYNAMIC' as const,
          id: `manifest-${gameId}`,
          gameMode: 'CONFIGURABLE_CYCLE',
          scheduling: 'PRE_SCHEDULED' as const,
          startTime: new Date(dynamicManifestOverride.startTime).toISOString(),
          ruleset: dynamicManifestOverride.ruleset,
          schedulePreset: dynamicManifestOverride.schedulePreset,
          maxPlayers: dynamicManifestOverride.maxPlayers,
          days: [],
          pushConfig: dynamicManifestOverride.pushConfig,
        },

// After:
        manifest: {
          kind: 'DYNAMIC' as const,
          id: `manifest-${gameId}`,
          gameMode: 'CONFIGURABLE_CYCLE',
          scheduling: 'PRE_SCHEDULED' as const,
          startTime: new Date(dynamicManifestOverride.startTime).toISOString(),
          ruleset: dynamicManifestOverride.ruleset,
          schedulePreset: dynamicManifestOverride.schedulePreset,
          ...(dynamicManifestOverride.maxPlayers ? { maxPlayers: dynamicManifestOverride.maxPlayers } : {}),
          minPlayers: dynamicManifestOverride.minPlayers ?? 3,
          days: [],
          pushConfig: dynamicManifestOverride.pushConfig,
        },
```

- [ ] **Step 3: Verify lobby builds**

Run: `cd apps/lobby && npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/actions.ts
git commit -m "feat(lobby): skip slot pre-creation for DYNAMIC games, pass minPlayers"
```

---

### Task 3: Lobby — Dynamic slot creation on join

**Files:**
- Modify: `apps/lobby/app/actions.ts:489-629` (acceptInvite function)

**Context:** Currently `acceptInvite()` finds the first unclaimed slot (line 536-541). For DYNAMIC games, there are no pre-created slots. We need to create a slot on the fly.

The existing `CONFIGURABLE_CYCLE` notification flow (lines 559-610) already sends `PLAYER_JOINED` to the running DO. DYNAMIC games use this same path. We need to extend the condition to include DYNAMIC mode detection.

Mode detection: We can check if the game was created with a DYNAMIC manifest by checking if the `config_json` column is null AND the mode is `CONFIGURABLE_CYCLE` (dynamic games are created via `createGame('CONFIGURABLE_CYCLE', undefined, dynamicOverride)`). However, a simpler approach: query the game's `player_count` — for DYNAMIC games we'll set it to 0 at creation (since there are no pre-allocated slots).

Actually, the cleanest approach: for DYNAMIC games, pre-created slots won't exist. The "find first unclaimed slot" query returns null. Instead of returning an error, create a new slot.

- [ ] **Step 1: Replace the unclaimed slot logic with dynamic slot creation**

In `acceptInvite()`, replace the slot-finding logic (lines 535-545). The new logic: try to find an unclaimed slot first (works for STATIC). If none found, check if the game is a CONFIGURABLE_CYCLE (which covers DYNAMIC) — if so, create a new slot dynamically. Otherwise return the "no slots" error.

```typescript
// Before (lines 535-545):
  // Find first unclaimed slot
  const slot = await db
    .prepare(
      'SELECT id, slot_index FROM Invites WHERE game_id = ? AND accepted_by IS NULL ORDER BY slot_index LIMIT 1'
    )
    .bind(game.id)
    .first<{ id: number; slot_index: number }>();

  if (!slot) {
    return { success: false, error: 'No available slots' };
  }

// After:
  // Find first unclaimed slot (STATIC games have pre-created slots)
  let slot = await db
    .prepare(
      'SELECT id, slot_index FROM Invites WHERE game_id = ? AND accepted_by IS NULL ORDER BY slot_index LIMIT 1'
    )
    .bind(game.id)
    .first<{ id: number; slot_index: number }>();

  // DYNAMIC games: no pre-created slots — create one on the fly
  if (!slot && game.mode === 'CONFIGURABLE_CYCLE') {
    const maxSlot = await db
      .prepare('SELECT MAX(slot_index) as max_slot FROM Invites WHERE game_id = ?')
      .bind(game.id)
      .first<{ max_slot: number | null }>();
    const nextSlot = (maxSlot?.max_slot ?? 0) + 1;

    await db
      .prepare('INSERT INTO Invites (game_id, slot_index, created_at) VALUES (?, ?, ?)')
      .bind(game.id, nextSlot, now)
      .run();

    slot = await db
      .prepare('SELECT id, slot_index FROM Invites WHERE game_id = ? AND slot_index = ?')
      .bind(game.id, nextSlot)
      .first<{ id: number; slot_index: number }>();
  }

  if (!slot) {
    return { success: false, error: 'No available slots' };
  }
```

- [ ] **Step 2: Remove the "all slots filled" status check for DYNAMIC games**

The existing code (lines 612-626) checks if all unclaimed slots are filled and sets status to READY/STARTED. For DYNAMIC games, there's no fixed slot count — we never auto-transition to READY. The game starts via host action or scheduled alarm.

```typescript
// Before (lines 612-626):
  // Check if all slots are filled
  const { count } = await db
    .prepare('SELECT COUNT(*) as count FROM Invites WHERE game_id = ? AND accepted_by IS NULL')
    .bind(game.id)
    .first<{ count: number }>() || { count: 1 };

  if (count === 0) {
    const newStatus = game.mode === 'CONFIGURABLE_CYCLE' ? 'STARTED' : 'READY';
    await db
      .prepare(`UPDATE GameSessions SET status = ? WHERE id = ?`)
      .bind(newStatus, game.id)
      .run();
  }

// After:
  // Check if all slots are filled (only for STATIC games with pre-created slots)
  if (game.mode !== 'CONFIGURABLE_CYCLE') {
    const { count } = await db
      .prepare('SELECT COUNT(*) as count FROM Invites WHERE game_id = ? AND accepted_by IS NULL')
      .bind(game.id)
      .first<{ count: number }>() || { count: 1 };

    if (count === 0) {
      await db
        .prepare(`UPDATE GameSessions SET status = 'READY' WHERE id = ?`)
        .bind(game.id)
        .run();
    }
  }
```

- [ ] **Step 3: Verify lobby builds**

Run: `cd apps/lobby && npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/lobby/app/actions.ts
git commit -m "feat(lobby): create invite slots on the fly for DYNAMIC games"
```

---

### Task 4: Lobby UI — Remove hardcoded maxPlayers, add minPlayers input

**Files:**
- Modify: `apps/lobby/app/page.tsx`

- [ ] **Step 1: Add minPlayers to DynamicRulesetConfig state**

Find `createDefaultDynamicConfig` (search for it in page.tsx) and add `minPlayers`:

```typescript
// Add to the dynamic config state type and default:
minPlayers: 3,
```

- [ ] **Step 2: Remove hardcoded maxPlayers from createGame call**

Find the `createGame` call in the submit handler (around line 462-468):

```typescript
// Before:
      const result = await createGame('CONFIGURABLE_CYCLE', undefined, {
        kind: 'DYNAMIC',
        ruleset: rulesetFromConfig,
        schedulePreset: dynamicConfig.schedulePreset,
        maxPlayers: 8,
        startTime: dynamicConfig.startTime,
      });

// After:
      const result = await createGame('CONFIGURABLE_CYCLE', undefined, {
        kind: 'DYNAMIC',
        ruleset: rulesetFromConfig,
        schedulePreset: dynamicConfig.schedulePreset,
        minPlayers: dynamicConfig.minPlayers,
        startTime: dynamicConfig.startTime,
      });
```

- [ ] **Step 3: Add minPlayers input to the Dynamic Ruleset UI**

Find the "Game Master Ruleset" section in the JSX (around line 1017). Add a minPlayers input field within the `DynamicRulesetBuilder` component or inline in the dynamic config section. Look at how existing number inputs are styled and follow the same pattern. The field should:
- Label: "Min Players to Start"
- Type: number input
- Value: `dynamicConfig.minPlayers`
- Min: 2
- Default: 3
- onChange: update `dynamicConfig.minPlayers`

- [ ] **Step 4: Verify lobby builds**

Run: `cd apps/lobby && npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add apps/lobby/app/page.tsx
git commit -m "feat(lobby): remove hardcoded maxPlayers, add minPlayers config for dynamic games"
```

---

### Task 5: Game Server — minPlayers guard on preGame WAKEUP

**Files:**
- Modify: `apps/game-server/src/server.ts:217-239`

**Context:** The DO's `onAlarm()` unconditionally sends `SYSTEM.WAKEUP` to the actor (line 230). For DYNAMIC games, the first WAKEUP at `startTime` should check that enough players have joined. If the roster count is below `minPlayers`, the WAKEUP should be suppressed (game stays in preGame).

The actor is in `preGame` state. `SYSTEM.WAKEUP` transitions it to `dayLoop`. We need to guard this.

- [ ] **Step 1: Add minPlayers guard in onAlarm**

In `server.ts`, update the `onAlarm()` method (around line 229):

```typescript
// Before:
    if (this.actor) {
      this.actor.send({ type: Events.System.WAKEUP });

      // Re-schedule for dynamic manifests — picks up newly resolved day's events
      const snap = this.actor.getSnapshot();
      const manifest = snap?.context?.manifest;
      if (manifest?.kind === 'DYNAMIC') {
        await scheduleManifestAlarms(this.scheduler, manifest);
      }
    }

// After:
    if (this.actor) {
      const snap = this.actor.getSnapshot();
      const manifest = snap?.context?.manifest;

      // For DYNAMIC games in preGame: check minPlayers before starting
      if (snap?.value === 'preGame' && manifest?.kind === 'DYNAMIC') {
        const rosterCount = Object.keys(snap.context.roster || {}).length;
        const minPlayers = manifest.minPlayers ?? 3;
        if (rosterCount < minPlayers) {
          log('info', 'L1', 'Suppressing WAKEUP: not enough players', {
            rosterCount,
            minPlayers,
          });
          return;
        }
      }

      this.actor.send({ type: Events.System.WAKEUP });

      // Re-schedule for dynamic manifests — picks up newly resolved day's events
      if (manifest?.kind === 'DYNAMIC') {
        await scheduleManifestAlarms(this.scheduler, manifest);
      }
    }
```

- [ ] **Step 2: Verify game-server builds and tests pass**

Run: `cd apps/game-server && npx tsc --noEmit && npx vitest run`
Expected: Clean build, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/game-server/src/server.ts
git commit -m "feat(game-server): guard preGame WAKEUP on minPlayers for dynamic games"
```

---

### Task 6: Verify full build and run integration smoke test

**Files:** None (verification only)

- [ ] **Step 1: Build all apps**

Run: `npm run build`
Expected: All apps build cleanly.

- [ ] **Step 2: Run all game-server tests**

Run: `cd apps/game-server && npx vitest run`
Expected: All tests pass (including the dynamic-days-integration tests from this session).

- [ ] **Step 3: Commit any fixes**

If any build or test issues found, fix and commit:
```bash
git add -A
git commit -m "fix: resolve build issues from truly dynamic days changes"
```
