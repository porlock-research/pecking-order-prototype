# Dynamic Timeline Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make dynamic mode games playable end-to-end via alarms — the Game Master generates real timeline events from the schedule preset, and the alarm system drives day progression without admin intervention.

**Architecture:** The Game Master's `resolveDay()` currently returns `timeline: []`. We add a timeline generator that stamps out concrete events (OPEN_GROUP_CHAT, OPEN_VOTING, END_DAY, etc.) with real ISO timestamps based on the `schedulePreset`. L1 schedules an initial alarm at the manifest's `startTime`, then re-schedules after each day resolution to pick up newly generated events. A `nextDayStart` field on each resolved day tells the alarm system when to wake for the following day.

**Tech Stack:** TypeScript, XState v5, Zod schemas, PartyWhen (alarm scheduling), Next.js (lobby)

---

## Background

### How static games work today

1. Lobby generates all days' timeline events with ISO timestamps at game creation
2. `scheduleManifestAlarms()` bulk-inserts all events as PartyWhen tasks at init
3. Alarms fire → `onAlarm()` sends `SYSTEM.WAKEUP` → `processTimelineEvent` finds due events → raises internal events → game progresses

### What's missing for dynamic games

1. `resolveDay()` returns `timeline: []` — no events to schedule
2. `scheduleManifestAlarms()` runs at init when `days[]` is empty — nothing to schedule
3. No `startTime` on the manifest — no way to schedule the initial game-start alarm
4. No re-scheduling after day resolution — newly resolved days' events never get armed
5. No `nextDayStart` — after END_DAY, no alarm to wake for the next morning

### Schedule preset timing reference

**DEFAULT** (full-day pacing, one day per calendar day):
```
OPEN_GROUP_CHAT  09:00    OPEN_DMS         10:00
START_GAME       10:00    CLOSE_GROUP_CHAT  10:00
END_GAME         12:00    START_ACTIVITY   14:00
END_ACTIVITY     16:00    OPEN_VOTING      20:00
CLOSE_VOTING     23:00    CLOSE_DMS        23:00
END_DAY          23:59
```

**COMPACT** (condensed, one day per calendar day):
```
OPEN_GROUP_CHAT  09:00    OPEN_DMS         09:30
START_GAME       09:30    CLOSE_GROUP_CHAT  10:30
END_GAME         11:30    START_ACTIVITY   12:00
END_ACTIVITY     13:00    OPEN_VOTING      14:00
CLOSE_VOTING     17:00    CLOSE_DMS        17:00
END_DAY          17:30
```

**SPEED_RUN** (minutes apart, same-day testing):
```
OPEN_GROUP_CHAT  +0m      OPEN_DMS         +2m
START_GAME       +3m      CLOSE_GROUP_CHAT  +2m
END_GAME         +8m      START_ACTIVITY   +10m
END_ACTIVITY     +15m     OPEN_VOTING      +17m
CLOSE_VOTING     +20m     CLOSE_DMS        +20m
END_DAY          +23m
Day duration: 23min, inter-day gap: 3min
```

### Key files

| File | Role |
|------|------|
| `packages/shared-types/src/index.ts` | Manifest + DailyManifest schemas |
| `apps/game-server/src/machines/game-master.ts` | `resolveDay()`, GameMasterInput/Context |
| `apps/game-server/src/machines/__tests__/game-master.test.ts` | 28 existing tests |
| `apps/game-server/src/machines/actions/l2-day-resolution.ts` | `spawnGameMasterIfDynamic`, `sendAndCaptureGameMasterDay` |
| `apps/game-server/src/scheduling.ts` | `scheduleManifestAlarms()` |
| `apps/game-server/src/server.ts` | `onAlarm()`, DO lifecycle |
| `apps/game-server/src/machines/actions/l2-timeline.ts` | `processTimelineEvent` |
| `apps/lobby/app/page.tsx` | Lobby UI, existing date picker for static mode |
| `apps/lobby/app/actions.ts` | `createGame()` dynamic branch |
| `apps/lobby/app/components/DynamicRulesetBuilder.tsx` | Dynamic mode UI |

---

## Task 1: Schema Changes — `startTime` + `nextDayStart`

**Files:**
- Modify: `packages/shared-types/src/index.ts`

**Step 1: Add `startTime` to DynamicManifestSchema**

Find the `DynamicManifestSchema` definition (around line 279). Add `startTime`:

```typescript
export const DynamicManifestSchema = z.object({
  kind: z.literal('DYNAMIC'),
  scheduling: SchedulingStrategySchema.default('PRE_SCHEDULED'),
  startTime: z.string(),  // ISO 8601 — when Day 1 begins
  ruleset: GameRulesetSchema,
  schedulePreset: SchedulePresetSchema,
  maxPlayers: z.number(),
  days: z.array(DailyManifestSchema),
  pushConfig: PushConfigSchema.optional(),
  ...legacyManifestFields,
});
```

**Step 2: Add `nextDayStart` to DailyManifestSchema**

Find the `DailyManifestSchema` definition (around line 64). Add `nextDayStart`:

```typescript
nextDayStart: z.string().optional(),  // ISO 8601 — when the following day begins (undefined on last day)
```

**Step 3: Build to verify**

Run: `npm run build --workspace=packages/shared-types`
Expected: Clean build.

**Step 4: Fix any downstream type errors**

Run: `npm run build --workspace=apps/game-server`

The lobby's `createGame()` dynamic branch will need `startTime` added — that's Task 6. For now, just verify the game-server builds (it doesn't construct DynamicManifest directly).

**Step 5: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add startTime to DynamicManifest, nextDayStart to DailyManifest"
```

---

## Task 2: Timeline Generator — Preset Definitions + `generateDayTimeline()`

**Files:**
- Create: `apps/game-server/src/machines/timeline-presets.ts`
- Create: `apps/game-server/src/machines/__tests__/timeline-presets.test.ts`

**Step 1: Write the failing tests**

Create `apps/game-server/src/machines/__tests__/timeline-presets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateDayTimeline, computeNextDayStart } from '../timeline-presets';

describe('generateDayTimeline', () => {
  describe('SPEED_RUN preset', () => {
    const startTime = '2026-03-10T14:00:00.000Z';

    it('generates all core events for Day 1', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
      });
      const actions = events.map(e => e.action);
      expect(actions).toEqual([
        'OPEN_GROUP_CHAT', 'OPEN_DMS', 'CLOSE_GROUP_CHAT',
        'START_GAME', 'END_GAME',
        'START_ACTIVITY', 'END_ACTIVITY',
        'OPEN_VOTING', 'CLOSE_VOTING', 'CLOSE_DMS', 'END_DAY',
      ]);
    });

    it('uses minute offsets from startTime for Day 1', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
      });
      const base = new Date(startTime).getTime();
      // First event at +0min, last (END_DAY) at +23min
      expect(new Date(events[0].time).getTime()).toBe(base);
      expect(new Date(events[events.length - 1].time).getTime()).toBe(base + 23 * 60_000);
    });

    it('offsets Day 2 by dayDuration + interDayGap', () => {
      const events = generateDayTimeline('SPEED_RUN', 2, startTime, {
        gameType: 'TRIVIA',
        activityType: 'NONE',
      });
      const base = new Date(startTime).getTime();
      const day2Base = base + (23 + 3) * 60_000; // 26min offset
      expect(new Date(events[0].time).getTime()).toBe(day2Base);
    });

    it('omits START_GAME/END_GAME when gameType is NONE', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'NONE',
        activityType: 'PLAYER_PICK',
      });
      const actions = events.map(e => e.action);
      expect(actions).not.toContain('START_GAME');
      expect(actions).not.toContain('END_GAME');
    });

    it('omits START_ACTIVITY/END_ACTIVITY when activityType is NONE', () => {
      const events = generateDayTimeline('SPEED_RUN', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'NONE',
      });
      const actions = events.map(e => e.action);
      expect(actions).not.toContain('START_ACTIVITY');
      expect(actions).not.toContain('END_ACTIVITY');
    });
  });

  describe('DEFAULT preset', () => {
    const startTime = '2026-03-10T00:00:00.000Z';

    it('uses clock times on the start date for Day 1', () => {
      const events = generateDayTimeline('DEFAULT', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
      });
      // First event: OPEN_GROUP_CHAT at 09:00 on March 10
      expect(events[0].action).toBe('OPEN_GROUP_CHAT');
      expect(events[0].time).toBe('2026-03-10T09:00:00.000Z');
      // Last event: END_DAY at 23:59
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-10T23:59:00.000Z');
    });

    it('advances to next calendar day for Day 2', () => {
      const events = generateDayTimeline('DEFAULT', 2, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
      });
      expect(events[0].time).toBe('2026-03-11T09:00:00.000Z');
    });
  });

  describe('COMPACT preset', () => {
    const startTime = '2026-03-10T00:00:00.000Z';

    it('uses compressed clock times', () => {
      const events = generateDayTimeline('COMPACT', 1, startTime, {
        gameType: 'TRIVIA',
        activityType: 'PLAYER_PICK',
      });
      expect(events[0].time).toBe('2026-03-10T09:00:00.000Z');
      const endDay = events.find(e => e.action === 'END_DAY');
      expect(endDay?.time).toBe('2026-03-10T17:30:00.000Z');
    });
  });
});

describe('computeNextDayStart', () => {
  it('returns next calendar day at first event time for DEFAULT', () => {
    const next = computeNextDayStart('DEFAULT', 1, '2026-03-10T00:00:00.000Z');
    expect(next).toBe('2026-03-11T09:00:00.000Z');
  });

  it('returns offset-based start for SPEED_RUN', () => {
    const startTime = '2026-03-10T14:00:00.000Z';
    const next = computeNextDayStart('SPEED_RUN', 1, startTime);
    // Day 1 ends at +23min, gap 3min, so Day 2 starts at +26min
    const expected = new Date(new Date(startTime).getTime() + 26 * 60_000).toISOString();
    expect(next).toBe(expected);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/game-server/src/machines/__tests__/timeline-presets.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the timeline generator**

Create `apps/game-server/src/machines/timeline-presets.ts`:

```typescript
import type { SchedulePreset } from '@pecking-order/shared-types';

interface TimelineEvent {
  time: string;  // ISO 8601
  action: string;
}

interface DayOptions {
  gameType: string;
  activityType: string;
}

// ── Preset definitions ──

interface CalendarEventDef {
  action: string;
  clockTime: string;  // "HH:MM"
  condition?: 'hasGame' | 'hasActivity';
}

interface OffsetEventDef {
  action: string;
  offsetMin: number;
  condition?: 'hasGame' | 'hasActivity';
}

interface CalendarPresetConfig {
  type: 'calendar';
  firstEventTime: string;  // "HH:MM" — used for next-day-start scheduling
  events: CalendarEventDef[];
}

interface OffsetPresetConfig {
  type: 'offset';
  dayDurationMin: number;
  interDayGapMin: number;
  events: OffsetEventDef[];
}

type PresetConfig = CalendarPresetConfig | OffsetPresetConfig;

const PRESET_CONFIGS: Record<SchedulePreset, PresetConfig> = {
  DEFAULT: {
    type: 'calendar',
    firstEventTime: '09:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '09:00' },
      { action: 'OPEN_DMS', clockTime: '10:00' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '10:00' },
      { action: 'START_GAME', clockTime: '10:00', condition: 'hasGame' },
      { action: 'END_GAME', clockTime: '12:00', condition: 'hasGame' },
      { action: 'START_ACTIVITY', clockTime: '14:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY', clockTime: '16:00', condition: 'hasActivity' },
      { action: 'OPEN_VOTING', clockTime: '20:00' },
      { action: 'CLOSE_VOTING', clockTime: '23:00' },
      { action: 'CLOSE_DMS', clockTime: '23:00' },
      { action: 'END_DAY', clockTime: '23:59' },
    ],
  },
  COMPACT: {
    type: 'calendar',
    firstEventTime: '09:00',
    events: [
      { action: 'OPEN_GROUP_CHAT', clockTime: '09:00' },
      { action: 'OPEN_DMS', clockTime: '09:30' },
      { action: 'START_GAME', clockTime: '09:30', condition: 'hasGame' },
      { action: 'CLOSE_GROUP_CHAT', clockTime: '10:30' },
      { action: 'END_GAME', clockTime: '11:30', condition: 'hasGame' },
      { action: 'START_ACTIVITY', clockTime: '12:00', condition: 'hasActivity' },
      { action: 'END_ACTIVITY', clockTime: '13:00', condition: 'hasActivity' },
      { action: 'OPEN_VOTING', clockTime: '14:00' },
      { action: 'CLOSE_VOTING', clockTime: '17:00' },
      { action: 'CLOSE_DMS', clockTime: '17:00' },
      { action: 'END_DAY', clockTime: '17:30' },
    ],
  },
  SPEED_RUN: {
    type: 'offset',
    dayDurationMin: 23,
    interDayGapMin: 3,
    events: [
      { action: 'OPEN_GROUP_CHAT', offsetMin: 0 },
      { action: 'OPEN_DMS', offsetMin: 2 },
      { action: 'CLOSE_GROUP_CHAT', offsetMin: 2 },
      { action: 'START_GAME', offsetMin: 3, condition: 'hasGame' },
      { action: 'END_GAME', offsetMin: 8, condition: 'hasGame' },
      { action: 'START_ACTIVITY', offsetMin: 10, condition: 'hasActivity' },
      { action: 'END_ACTIVITY', offsetMin: 15, condition: 'hasActivity' },
      { action: 'OPEN_VOTING', offsetMin: 17 },
      { action: 'CLOSE_VOTING', offsetMin: 20 },
      { action: 'CLOSE_DMS', offsetMin: 20 },
      { action: 'END_DAY', offsetMin: 23 },
    ],
  },
};

// ── Helpers ──

function meetsCondition(condition: string | undefined, opts: DayOptions): boolean {
  if (!condition) return true;
  if (condition === 'hasGame') return opts.gameType !== 'NONE';
  if (condition === 'hasActivity') return opts.activityType !== 'NONE';
  return true;
}

function computeCalendarDayBase(startTime: string, dayIndex: number): string {
  // Extract date from startTime, add (dayIndex - 1) days
  const base = new Date(startTime);
  base.setUTCDate(base.getUTCDate() + (dayIndex - 1));
  return base.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function computeOffsetDayBase(startTime: string, dayIndex: number, config: OffsetPresetConfig): number {
  const base = new Date(startTime).getTime();
  return base + (dayIndex - 1) * (config.dayDurationMin + config.interDayGapMin) * 60_000;
}

// ── Public API ──

export function generateDayTimeline(
  preset: SchedulePreset,
  dayIndex: number,
  startTime: string,
  opts: DayOptions,
): TimelineEvent[] {
  const config = PRESET_CONFIGS[preset];

  if (config.type === 'calendar') {
    const dateStr = computeCalendarDayBase(startTime, dayIndex);
    return config.events
      .filter(e => meetsCondition(e.condition, opts))
      .map(e => ({
        action: e.action,
        time: new Date(`${dateStr}T${e.clockTime}:00.000Z`).toISOString(),
      }));
  }

  // Offset-based (SPEED_RUN)
  const dayBase = computeOffsetDayBase(startTime, dayIndex, config);
  return config.events
    .filter(e => meetsCondition(e.condition, opts))
    .map(e => ({
      action: e.action,
      time: new Date(dayBase + e.offsetMin * 60_000).toISOString(),
    }));
}

export function computeNextDayStart(
  preset: SchedulePreset,
  dayIndex: number,
  startTime: string,
): string {
  const config = PRESET_CONFIGS[preset];

  if (config.type === 'calendar') {
    const nextDateStr = computeCalendarDayBase(startTime, dayIndex + 1);
    return new Date(`${nextDateStr}T${config.firstEventTime}:00.000Z`).toISOString();
  }

  // Offset-based
  const nextBase = computeOffsetDayBase(startTime, dayIndex + 1, config);
  return new Date(nextBase).toISOString();
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/game-server/src/machines/__tests__/timeline-presets.test.ts`
Expected: ALL PASS.

**Step 5: Commit**

```bash
git add apps/game-server/src/machines/timeline-presets.ts apps/game-server/src/machines/__tests__/timeline-presets.test.ts
git commit -m "feat: timeline generator with preset definitions (DEFAULT, COMPACT, SPEED_RUN)"
```

---

## Task 3: Wire Game Master to Generate Timelines

**Files:**
- Modify: `apps/game-server/src/machines/game-master.ts`
- Modify: `apps/game-server/src/machines/actions/l2-day-resolution.ts`
- Modify: `apps/game-server/src/machines/__tests__/game-master.test.ts`

**Step 1: Add `startTime` to GameMasterInput and GameMasterContext**

In `game-master.ts`, find `GameMasterInput` (around line 17):

```typescript
export interface GameMasterInput {
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  startTime: string;          // ← ADD
  gameHistory: GameHistoryEntry[];
}
```

Find `GameMasterContext` (around line 24):

```typescript
interface GameMasterContext {
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  startTime: string;          // ← ADD
  // ... rest unchanged
}
```

In `buildGameMasterContext()` (around line 227):

```typescript
export function buildGameMasterContext(input: GameMasterInput): GameMasterContext {
  return {
    roster: input.roster,
    ruleset: input.ruleset,
    schedulePreset: input.schedulePreset,
    startTime: input.startTime,   // ← ADD
    gameHistory: input.gameHistory,
    // ... rest unchanged
  };
}
```

**Step 2: Update `resolveDay()` to generate timeline + nextDayStart**

Add the import at the top of `game-master.ts`:

```typescript
import { generateDayTimeline, computeNextDayStart } from './timeline-presets';
```

Find `resolveDay()` (around line 194). Update it to accept `schedulePreset`, `startTime`, and compute `totalDays` for `nextDayStart`:

```typescript
function resolveDay(
  dayIndex: number,
  roster: Record<string, SocialPlayer>,
  ruleset: PeckingOrderRuleset,
  gameHistory: GameHistoryEntry[],
  schedulePreset: SchedulePreset,
  startTime: string,
): { resolvedDay: DailyManifest; totalDays: number; reasoning: string } {
  const alive = countAlivePlayers(roster);
  const totalDays = computeTotalDays(alive, ruleset.dayCount);
  const voteType = resolveVoteType(dayIndex, totalDays, ruleset.voting, alive);
  const gameType = resolveGameType(dayIndex, ruleset.games, gameHistory);
  const activityType = resolveActivityType(dayIndex, ruleset.activities, gameHistory);
  const social = resolveSocialParams(dayIndex, totalDays, ruleset.social);

  const timeline = generateDayTimeline(schedulePreset, dayIndex, startTime, {
    gameType,
    activityType,
  });

  const isLastDay = dayIndex >= totalDays;
  const nextDayStart = isLastDay
    ? undefined
    : computeNextDayStart(schedulePreset, dayIndex, startTime);

  return {
    resolvedDay: {
      dayIndex,
      theme: `Day ${dayIndex}`,
      voteType,
      gameType,
      ...(activityType !== 'NONE' ? { activityType } : {}),
      timeline,
      ...(nextDayStart ? { nextDayStart } : {}),
      ...social,
    },
    totalDays,
    reasoning: `Day ${dayIndex}/${totalDays}: ${voteType} vote, ${gameType} game, ${activityType} activity, ${social.dmCharsPerPlayer} DM chars, ${timeline.length} timeline events`,
  };
}
```

**Step 3: Update RESOLVE_DAY event handler to pass new params**

Find the two places in the XState machine where `resolveDay()` is called (around lines 266 and 289). Both should now pass `context.schedulePreset` and `context.startTime`:

```typescript
const { resolvedDay, totalDays, reasoning } = resolveDay(
  event.dayIndex,
  event.roster,
  context.ruleset,
  context.gameHistory,
  context.schedulePreset,
  context.startTime,
);
```

**Step 4: Pass `startTime` when spawning Game Master**

In `apps/game-server/src/machines/actions/l2-day-resolution.ts`, find `spawnGameMasterIfDynamic` (around line 39). Update the input construction:

```typescript
const input: GameMasterInput = {
  roster: context.roster,
  ruleset: manifest.ruleset,
  schedulePreset: manifest.schedulePreset,
  startTime: manifest.startTime,   // ← ADD
  gameHistory: context.gameHistory || [],
};
```

**Step 5: Update existing tests**

In `apps/game-server/src/machines/__tests__/game-master.test.ts`, find `buildGameMasterContext()` calls and add `startTime`:

```typescript
// Add to all test helper / context builder calls:
startTime: '2026-01-01T00:00:00.000Z',
```

Add a new test to verify timeline generation:

```typescript
describe('resolveDay timeline generation', () => {
  it('generates timeline events from schedule preset', () => {
    const input: GameMasterInput = {
      roster: makeRoster(5),
      ruleset: makeRuleset(),
      schedulePreset: 'SPEED_RUN',
      startTime: '2026-03-10T14:00:00.000Z',
      gameHistory: [],
    };
    const ctx = buildGameMasterContext(input);
    // Simulate RESOLVE_DAY by calling resolveDay indirectly through actor
    // Create actor, send RESOLVE_DAY, check snapshot
    const actor = createActor(createGameMasterMachine(), { input });
    actor.start();
    actor.send({ type: 'GAME_MASTER.RESOLVE_DAY', dayIndex: 1, roster: input.roster });
    const snap = actor.getSnapshot();
    expect(snap.context.resolvedDay).toBeDefined();
    expect(snap.context.resolvedDay!.timeline.length).toBeGreaterThan(0);
    expect(snap.context.resolvedDay!.nextDayStart).toBeDefined();
    actor.stop();
  });
});
```

**Step 6: Run tests**

Run: `npx vitest run apps/game-server/src/machines/__tests__/game-master.test.ts`
Expected: ALL PASS.

Run: `npm run build --workspace=apps/game-server`
Expected: Clean build.

**Step 7: Commit**

```bash
git add apps/game-server/src/machines/game-master.ts apps/game-server/src/machines/actions/l2-day-resolution.ts apps/game-server/src/machines/__tests__/game-master.test.ts
git commit -m "feat: wire Game Master resolveDay to generate timelines from schedule preset"
```

---

## Task 4: Alarm Scheduling — Initial + Re-scheduling After Resolution

**Files:**
- Modify: `apps/game-server/src/scheduling.ts`
- Modify: `apps/game-server/src/server.ts`

**Step 1: Schedule initial game-start alarm for dynamic manifests**

In `scheduling.ts`, find `scheduleManifestAlarms()` (line 28). After the existing `if (!manifest.days) return;` check, add handling for dynamic manifests' `startTime`:

```typescript
export async function scheduleManifestAlarms(scheduler: Scheduler<any>, manifest: any): Promise<void> {
  if (!manifest) return;

  if (resolveScheduling(manifest) === 'ADMIN') {
    log('info', 'L1', 'Admin scheduling — no alarms scheduled (admin-triggered)');
    return;
  }

  if (!manifest.days) return;

  const uniqueTimestamps = new Map<number, string>();
  const now = Date.now();

  // Dynamic manifests: schedule alarm at startTime (game-start wake)
  if (manifest.kind === 'DYNAMIC' && manifest.startTime) {
    const startMs = new Date(manifest.startTime).getTime();
    if (startMs > now) {
      uniqueTimestamps.set(Math.floor(startMs / 1000), 'game-start');
    }
  }

  // Schedule timeline events from resolved days
  for (const day of manifest.days) {
    for (const event of day.timeline || []) {
      const timeMs = new Date(event.time).getTime();
      if (timeMs > now) {
        const ts = Math.floor(timeMs / 1000);
        const existing = uniqueTimestamps.get(ts);
        uniqueTimestamps.set(ts, existing ? `${existing}+${event.action}` : `d${day.dayIndex}-${event.action}`);
      }
    }

    // Schedule next-day wake alarm
    if (day.nextDayStart) {
      const nextMs = new Date(day.nextDayStart).getTime();
      if (nextMs > now) {
        uniqueTimestamps.set(Math.floor(nextMs / 1000), `d${day.dayIndex}-next-day-wake`);
      }
    }
  }

  if (uniqueTimestamps.size === 0) {
    log('info', 'L1', 'No future timeline events to schedule');
    return;
  }

  const callback = JSON.stringify({ type: "self", function: "wakeUpL2" });
  for (const [timestamp, label] of uniqueTimestamps) {
    (scheduler as any).querySql([{
      sql: `INSERT OR REPLACE INTO tasks (id, description, payload, callback, type, time)
            VALUES (?, ?, ?, ?, 'scheduled', ?)`,
      params: [`wakeup-${label}`, null, null, callback, timestamp]
    }]);
  }
  await (scheduler as any).scheduleNextAlarm();
  log('info', 'L1', 'Scheduled alarms', {
    uniqueAlarms: uniqueTimestamps.size,
    totalEvents: manifest.days.reduce((n: number, d: any) => n + (d.timeline?.length || 0), 0),
    days: manifest.days.length,
  });
}
```

**Step 2: Re-schedule after each alarm fires (dynamic games)**

In `server.ts`, find the `onAlarm()` method (around line 215). After delivering WAKEUP, re-run scheduling for dynamic manifests:

```typescript
async onAlarm() {
  if (this.realSchedulerAlarm) {
    (this.scheduler as any).alarm = this.realSchedulerAlarm;
    await this.realSchedulerAlarm();
  }

  if (this.actor) {
    this.actor.send({ type: Events.System.WAKEUP });

    // Re-schedule for dynamic manifests — picks up newly resolved day's events
    const snap = this.actor.getSnapshot();
    const manifest = snap?.context?.manifest;
    if (manifest?.kind === 'DYNAMIC') {
      await scheduleManifestAlarms(this.scheduler, manifest);
    }
  }
}
```

Make sure `scheduleManifestAlarms` is imported at the top of `server.ts` (it may already be — check the existing imports).

**Step 3: Build to verify**

Run: `npm run build --workspace=apps/game-server`
Expected: Clean build.

**Step 4: Commit**

```bash
git add apps/game-server/src/scheduling.ts apps/game-server/src/server.ts
git commit -m "feat: schedule initial alarm at startTime + re-schedule after day resolution"
```

---

## Task 5: Lobby UI — Start Time Picker for Dynamic Mode

**Files:**
- Modify: `apps/lobby/app/page.tsx`
- Modify: `apps/lobby/app/actions.ts`
- Modify: `apps/lobby/app/components/DynamicRulesetBuilder.tsx`

**Step 1: Add `startTime` to DynamicRulesetConfig**

In `DynamicRulesetBuilder.tsx`, add to the `DynamicRulesetConfig` interface:

```typescript
export interface DynamicRulesetConfig {
  // ... existing fields ...
  startTime: string;  // ISO 8601
}
```

Update `createDefaultDynamicConfig()` to set a default startTime (tomorrow at 09:00 UTC):

```typescript
export function createDefaultDynamicConfig(): DynamicRulesetConfig {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);

  return {
    // ... existing defaults ...
    startTime: `${dateStr}T09:00`,
  };
}
```

**Step 2: Add start time section to DynamicRulesetBuilder**

In the main `DynamicRulesetBuilder` component, add a section before the Schedule section (around line 482). Adjust the start time default based on the selected preset:

```typescript
{/* ── Start Time ── */}
<Section title="Start Time" defaultOpen>
  <div className="space-y-2 mt-1">
    <div className="flex items-center gap-3">
      <input
        type="datetime-local"
        value={config.startTime}
        onChange={e => onChange({ ...config, startTime: e.target.value })}
        className="flex-1 bg-skin-input text-skin-base border border-skin-base rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-skin-gold/50 transition-all"
      />
    </div>
    {config.schedulePreset === 'SPEED_RUN' && (
      <button
        type="button"
        onClick={() => {
          const soon = new Date(Date.now() + 2 * 60_000);
          const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60_000)
            .toISOString().slice(0, 16);
          onChange({ ...config, startTime: local });
        }}
        className="text-[10px] font-mono text-skin-gold/70 hover:text-skin-gold border border-skin-gold/20 rounded-lg px-2 py-1 transition-all"
      >
        Set to now + 2 min
      </button>
    )}
    <p className="text-[8px] font-mono text-skin-dim/30">
      {config.schedulePreset === 'SPEED_RUN'
        ? 'Game starts at this time — events fire minutes apart'
        : 'Day 1 begins on this date — events follow the preset schedule'}
    </p>
  </div>
</Section>
```

**Step 3: Update `createGame()` dynamic branch to include `startTime`**

In `apps/lobby/app/actions.ts`, find the dynamic manifest construction (around line 177). Add `startTime`:

```typescript
const payload = {
  lobbyId: `lobby-${now}`,
  inviteCode,
  roster: {},
  manifest: {
    kind: 'DYNAMIC' as const,
    id: `manifest-${gameId}`,
    gameMode: 'CONFIGURABLE_CYCLE',
    scheduling: 'PRE_SCHEDULED' as const,
    startTime: new Date(dynamicManifestOverride.startTime).toISOString(),  // ← ADD
    ruleset: dynamicManifestOverride.ruleset,
    schedulePreset: dynamicManifestOverride.schedulePreset,
    maxPlayers: dynamicManifestOverride.maxPlayers,
    days: [],
    pushConfig: dynamicManifestOverride.pushConfig,
  },
};
```

**Step 4: Update lobby's `handleCreateGame()` to pass `startTime`**

In `page.tsx`, find the dynamic branch of `handleCreateGame()` (around line 393). Add `startTime` to the override:

```typescript
if (manifestKind === 'DYNAMIC') {
  // ... existing ruleset building ...
  const result = await createGame('CONFIGURABLE_CYCLE', undefined, {
    kind: 'DYNAMIC',
    ruleset: rulesetFromConfig,
    schedulePreset: dynamicConfig.schedulePreset,
    startTime: dynamicConfig.startTime,   // ← ADD
    maxPlayers: 8,
  });
  // ...
}
```

Also update the type of the `dynamicManifestOverride` parameter in `actions.ts` to include `startTime: string`.

**Step 5: Build to verify**

Run: `npm run build --workspace=apps/lobby`
Expected: Clean build.

**Step 6: Commit**

```bash
git add apps/lobby/app/page.tsx apps/lobby/app/actions.ts apps/lobby/app/components/DynamicRulesetBuilder.tsx
git commit -m "feat(lobby): add start time picker for dynamic mode games"
```

---

## Task 6: End-to-End Verification

**Prerequisites:** Game server running on localhost:8787, lobby on localhost:3000.

**Step 1: Create a dynamic SPEED_RUN game from the lobby**

1. Open localhost:3000
2. Select CONFIGURABLE_CYCLE
3. Toggle to Dynamic
4. Set Schedule Preset to SPEED_RUN
5. Click "Set to now + 2 min" in Start Time section
6. Click Create Game
7. Note the gameId from the URL or response

**Step 2: Add players via API**

```bash
GAME_ID=<your-game-id>
AUTH="Authorization: Bearer dev-secret-change-me"

for i in 0 1 2 3; do
  curl -s -X POST "http://localhost:8787/parties/game-server/$GAME_ID/player-joined" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"playerId\":\"p$i\",\"realUserId\":\"sr-user-p$i\",\"personaName\":\"Player$i\",\"avatarUrl\":\"\",\"bio\":\"\",\"silver\":50}"
done
```

**Step 3: Verify game state**

```bash
curl -s "http://localhost:8787/parties/game-server/$GAME_ID/state" -H "$AUTH" | jq '{
  state: .state,
  manifestKind: .manifest.kind,
  startTime: .manifest.startTime,
  schedulePreset: .manifest.schedulePreset,
  daysResolved: (.manifest.days | length),
  dayIndex: .dayIndex
}'
```

Expected: `state: "preGame"`, `manifestKind: "DYNAMIC"`, `daysResolved: 0`.

**Step 4: Wait for game start**

Wait for the start time to pass (~2 minutes). The alarm should fire, sending WAKEUP.

Check state again — expected:
- `state` includes `activeSession` (game is in Day 1)
- `daysResolved: 1` (Game Master resolved Day 1)
- Day 1 has timeline events with real timestamps

```bash
curl -s "http://localhost:8787/parties/game-server/$GAME_ID/state" -H "$AUTH" | jq '.manifest.days[0] | { dayIndex, voteType, gameType, timelineCount: (.timeline | length), nextDayStart }'
```

**Step 5: Watch the game progress**

Monitor state every 30 seconds. The timeline events should fire via alarms:
- OPEN_GROUP_CHAT → chat opens
- OPEN_DMS → DMs open
- OPEN_VOTING → voting starts
- CLOSE_VOTING → voting ends (random elimination with 0 votes)
- END_DAY → nightSummary

After END_DAY, the nextDayStart alarm fires → morningBriefing → Day 2 resolved.

After the last day (FINALS), game should reach gameSummary → gameOver.

```bash
# Poll state
while true; do
  curl -s "http://localhost:8787/parties/game-server/$GAME_ID/state" -H "$AUTH" | jq '{ state: .state, dayIndex: .dayIndex, daysResolved: (.manifest.days | length) }'
  sleep 30
done
```

**Step 6: Verify final state**

Expected: `state: "gameOver"`, all days resolved, one winner alive.

```bash
curl -s "http://localhost:8787/parties/game-server/$GAME_ID/state" -H "$AUTH" | jq '{
  state: .state,
  daysResolved: (.manifest.days | length),
  roster: [.roster | to_entries[] | { name: .value.personaName, status: .value.status }]
}'
```

**Step 7: Cleanup**

```bash
curl -s -X POST "http://localhost:8787/parties/game-server/$GAME_ID/cleanup" -H "$AUTH"
```
