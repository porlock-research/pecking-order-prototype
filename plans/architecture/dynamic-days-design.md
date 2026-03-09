# Dynamic Days — Design Document

**Date**: 2026-03-08
**Status**: Accepted — Phase 3a+3b implemented
**Depends on**: Phase 1 complete (server.ts extraction), ADR-093 (alarm delivery)

## Problem

The current manifest is a static array of `DailyManifest` objects built entirely at game creation time. This causes several problems:

1. **Day count mismatch**: 8 player slots configured but only 5 join → game runs 7 days instead of 4
2. **Last day must be FINALS**: currently relies on the lobby getting this right
3. **No adaptation**: vote types, game types, social limits are fixed regardless of what happens in-game
4. **Player count constraints**: some vote types need minimum player counts (TRUST_PAIRS needs even, FINALS needs 2 alive) — static manifests can't account for mid-game eliminations
5. **Inactivity**: no mechanism to shorten the game when players disengage

## Goals

- Dynamic days: each day's config is resolved at runtime based on game state
- Static days: completely untouched — zero regression risk
- Modular rules: game mechanics are configurable per game, not hardcoded
- Observable: admin can see what the director decided and override it
- Extensible: new game types (Werewolf, etc.) can be added without modifying the orchestrator

## Non-Goals (Future Work)

- Generic L3 orchestrator (Phase 3 — only when a second game type motivates it)
- L3 contract formalization (Phase 2 — pure typing, no behavioral change)
- Multiple simultaneous game types in one tournament
- AI-driven rule adaptation (the director is configurable, not autonomous)

---

## Architecture

### Manifest Kind — Discriminated Union

The manifest becomes a discriminated union keyed on `kind`. This is the single dispatch point — no scattered `if` checks.

```ts
type GameManifest = StaticManifest | DynamicManifest;

interface StaticManifest {
  kind: 'STATIC';
  scheduling: SchedulingStrategy;  // 'ADMIN' | 'PRE_SCHEDULED'
  days: DailyManifest[];
  pushConfig?: PushConfig;
}

interface DynamicManifest {
  kind: 'DYNAMIC';
  scheduling: SchedulingStrategy;
  ruleset: GameRuleset;
  schedulePreset: SchedulePreset;
  maxPlayers: number;
  days: DailyManifest[];           // starts empty, grows as director resolves each day
  pushConfig?: PushConfig;
}
```

Legacy manifests (no `kind` field) are normalized to `StaticManifest` on read:

```ts
function normalizeManifest(raw: any): GameManifest {
  if (raw.kind) return raw;
  return { kind: 'STATIC' as const, ...raw };
}
```

### GameRuleset — Discriminated Union per Game Type

The ruleset is not a monolithic type. Each game type defines its own ruleset shape. The union is extensible — adding a new game type means adding a new variant.

```ts
type GameRuleset =
  | PeckingOrderRuleset;
  // | WerewolfRuleset;   // future

interface PeckingOrderRuleset {
  kind: 'PECKING_ORDER';
  voting: PeckingOrderVotingRules;
  games: PeckingOrderGameRules;
  activities: PeckingOrderActivityRules;
  social: PeckingOrderSocialRules;
  inactivity: PeckingOrderInactivityRules;
  dayCount: PeckingOrderDayCountRules;
}
```

Each sub-config is specific to Pecking Order. A future Werewolf ruleset would have completely different sub-configs (roles, night actions, accusation rules).

#### Pecking Order Sub-Configs

```ts
interface PeckingOrderVotingRules {
  mode: 'SEQUENCE' | 'POOL';
  sequence?: VoteType[];            // for SEQUENCE: ordered list
  pool?: VoteType[];                // for POOL: director picks
  constraints?: Array<{
    voteType: VoteType;
    minPlayers: number;
  }>;
  // Last day is always overridden to FINALS — enforced by director
}

interface PeckingOrderGameRules {
  mode: 'SEQUENCE' | 'POOL' | 'NONE';
  sequence?: GameType[];
  pool?: GameType[];
  avoidRepeat: boolean;
}

interface PeckingOrderActivityRules {
  mode: 'SEQUENCE' | 'POOL' | 'NONE';
  sequence?: PromptType[];
  pool?: PromptType[];
  avoidRepeat: boolean;
}

type ScalingMode = 'FIXED' | 'PER_ACTIVE_PLAYER' | 'DIMINISHING';

interface PeckingOrderSocialRules {
  dmChars: { mode: ScalingMode; base: number; floor?: number };
  dmPartners: { mode: ScalingMode; base: number; floor?: number };
  dmCost: number;
  groupDmEnabled: boolean;
}

interface PeckingOrderInactivityRules {
  enabled: boolean;
  thresholdDays: number;                // consecutive days with no meaningful action
  socketInactivityHours?: number;       // also consider WS disconnection
  action: 'ELIMINATE' | 'NUDGE_THEN_ELIMINATE';
  nudgeDays?: number;                   // for NUDGE_THEN_ELIMINATE
}

interface PeckingOrderDayCountRules {
  mode: 'ACTIVE_PLAYERS_MINUS_ONE' | 'FIXED';
  fixedCount?: number;
  maxDays?: number;                     // hard cap
}
```

### Schedule Presets — Lobby-Side Only

Presets are templates that stamp out concrete timelines with real timestamps at game creation time. The server never sees the preset name — it only sees the resulting timeline.

```ts
type SchedulePreset = 'DEFAULT' | 'COMPACT' | 'SPEED_RUN';
// Stored in DynamicManifest so the director can stamp out
// timelines for future days using the same preset.
```

Each preset defines a phase sequence with relative times:

```ts
// Lobby-side only — not in shared-types
const PRESETS: Record<SchedulePreset, PresetTemplate> = {
  DEFAULT: {
    // 9am to midnight
    phases: [
      { action: 'OPEN_GROUP_CHAT', offset: '09:00' },
      { action: 'OPEN_DMS',        offset: '10:00' },
      // ...
      { action: 'END_DAY',         offset: '23:59' },
    ],
  },
  COMPACT: {
    // 10am to 5pm
    phases: [/* ... */],
  },
  SPEED_RUN: {
    // 30-second intervals
    phases: [/* ... */],
  },
};
```

The preset is stored on the `DynamicManifest` so the director can stamp out timelines for future days. But the resolution (preset + date → concrete ISO timestamps) always happens before the timeline reaches the server.

### Director Actor (L2.5)

The director is an XState actor spawned by L2 at the start of each day in dynamic mode. It runs alongside L3, observes facts, and accumulates state to build the next day's config.

#### Lifecycle

```
morningBriefing (L2)
  ├── if STATIC:  look up day from manifest.days[] (current behavior)
  └── if DYNAMIC: read director output → append to manifest.days[]
                  spawn new director for this day

activeSession (L2)
  ├── L3 session (runs the day — unchanged)
  └── director (observes FACT.* events, builds recommendations)

nightSummary (L2)
  └── director output available as next day's config
      admin can view and override before NEXT_STAGE
```

#### Director Contract

```ts
interface DirectorInput {
  dayIndex: number;
  roster: Record<string, SocialPlayer>;
  ruleset: PeckingOrderRuleset;
  schedulePreset: SchedulePreset;
  gameHistory: GameHistoryEntry[];
  completedPhases: CompletedPhase[];
}

interface DirectorOutput {
  nextDay: DailyManifest;           // the resolved day config
  inactivityReport: Array<{
    playerId: string;
    daysMissed: number;
    recommendation: 'ELIMINATE' | 'NUDGE' | 'OK';
  }>;
  reasoning: string;                 // human-readable explanation for admin
}

// Events the director consumes (forwarded from L2)
type DirectorEvent =
  | { type: 'FACT.RECORD'; fact: Fact }
  | { type: 'ADMIN.OVERRIDE_NEXT_DAY'; day: Partial<DailyManifest> };
```

#### Mid-Day Influence

The director can also emit events back to L2 during the day:

```ts
// Director → L2 (via sendParent or xstate.done patterns)
type DirectorEmission =
  | { type: 'DIRECTOR.INJECT_PROMPT'; payload: { text: string; targetId?: string } }
  | { type: 'DIRECTOR.NUDGE_PLAYER'; playerId: string; reason: string }
  | { type: 'DIRECTOR.RECOMMENDATION'; recommendation: string };
```

L2 decides whether to act on these — the director recommends, L2 (or the admin) decides.

### Russian Doll — Revised

```
L1  — DO shell (platform infra: persistence, WebSocket, push, scheduling)
L2  — generic day-cycle orchestrator (roster, economy, day increment, L3 dispatch)
L2.5— director (dynamic mode only: observes facts, resolves days, influences game)
L3  — daily session (phase execution, social channels, cartridge spawning)
L4  — cartridges (voting, games, prompts — self-contained, contract-driven)
```

Each layer is an orchestrator delegating downward. Game-specific logic lives in:
- The **ruleset** config (declarative, serializable)
- The **director** actor (interprets the ruleset)
- The **L4 cartridges** (execute specific mechanics)

L2 and L3 remain generic orchestrators that don't contain game-specific logic.

### L2 Changes

Minimal. One new branch in `morningBriefing`:

```ts
morningBriefing: {
  entry: [
    'incrementDay',
    'resolveCurrentDay',        // NEW — dispatches based on manifest.kind
    'clearRestoredChatLog',
    raise({ type: 'PUSH.PHASE', trigger: 'DAY_START' }),
  ],
  always: 'activeSession',
},
```

`resolveCurrentDay` action:
- `STATIC`: no-op (day already exists in `manifest.days[]`)
- `DYNAMIC`: reads director output, stamps timeline from preset, appends to `manifest.days[]`

In `activeSession`, director is spawned alongside L3:
- `STATIC`: no director spawned
- `DYNAMIC`: director spawned with ruleset + game state as input

The existing `manifest.days.find(d => d.dayIndex === context.dayIndex)` pattern works in both modes — dynamic mode just appends the day before the lookup happens.

### L3 Changes

Minimal. Social limits read from input instead of hardcoded constants:

```ts
context: ({ input }) => ({
  ...existing,
  dmCharsLimit: input.manifest?.dmCharsPerPlayer ?? 1200,
  dmPartnersLimit: input.manifest?.dmPartnersPerPlayer ?? 3,
})
```

Guards (`isDmAllowed`, etc.) read from context. Defaults maintain backward compatibility.

### DailyManifest Extension

```ts
interface DailyManifest {
  dayIndex: number;
  theme: string;
  voteType: VoteType;
  gameType: GameType;
  gameMode?: 'SOLO' | 'LIVE';
  timeline: TimelineEvent[];
  // NEW: optional social parameters (backward-compatible defaults)
  dmCharsPerPlayer?: number;
  dmPartnersPerPlayer?: number;
}
```

### Backward Compatibility

- Old persisted snapshots (no `kind`): normalized to `StaticManifest` via `normalizeManifest()`
- Old manifests with `gameMode` field: `resolveScheduling()` already handles this
- L3 social limits: defaults match current hardcoded values
- Static mode: zero code path changes

### Persistence / Rehydration

- Director state is part of L2's snapshot (spawned child, same as L3)
- Growing `days[]` array is persisted in the manifest (already in snapshot)
- On DO restart with dynamic manifest mid-day: director restores from snapshot like L3 does
  - Same limitation as L3 (PROD-016): spawned children are fragile on restore
  - Acceptable for now — same risk profile as current L3

---

## Future Work (Sketched, Not Built)

### Phase 2: L3 Contract Formalization

Extract the implicit L2↔L3 contract into explicit types:

```ts
interface L3Contract {
  input: { dayIndex: number; roster: Record<string, SocialPlayer>; manifest?: DailyManifest };
  output: { reason: string };
  forwardedEvents: readonly string[];
}
```

This is pure typing work — no behavioral change. Once the contract is explicit, swapping L3 implementations becomes type-safe.

### Phase 3: Generic L3 Orchestrator

When a second game type motivates it, L3 becomes a generic phase runner that receives its phase sequence from the manifest/director rather than having hardcoded states. The current L3 becomes the "Pecking Order daily session" cartridge behind the L3 contract.

### Phase 4: New Game Types

A new game type (e.g., Werewolf) would provide:
- A new `GameRuleset` variant (`WerewolfRuleset`)
- A new L3 machine (different phase sequence: night → day → accusation)
- New L4 cartridges (night kill, role reveal, etc.)
- A new director implementation (Werewolf-specific observation and adaptation)

L1 and L2 remain unchanged. The manifest `kind` dispatches to the right L3.

---

## Implementation Phasing

### Phase 3a: Types + Manifest Union (no behavioral change) — COMPLETE
- Added `StaticManifest`, `DynamicManifest`, `GameRuleset`, `SchedulePreset` to shared-types
- Added `normalizeManifest()` to handle legacy snapshots
- Added `DailyManifest` social parameter fields (optional, backward-compatible)
- Updated L2 to normalize manifest on init + snapshot restore
- Extracted `buildL3Context()` for testability; L3 reads social limits from manifest
- All 105 tests pass, speed run verified

### Phase 3b: Director Actor + Dynamic Day Resolution — COMPLETE
- Implemented `PeckingOrderRuleset` sub-configs (voting, games, activities, social, inactivity, dayCount)
- Implemented director actor machine (`director.ts`) with pure resolution functions
- Added `resolveCurrentDay` + `spawnDirectorIfDynamic` + `captureDirectorDay` to L2
- Added FACT.* forwarding from L2 to director
- Added `isGameComplete` / `isDayIndexPastEnd` guards (consolidated from inline guards)

### Phase 3c: Schedule Presets + Lobby Integration
- Define preset templates in lobby
- Update lobby game creation to support dynamic mode
- Admin dashboard shows director recommendations
- Admin override endpoint for next day config

### Phase 3d: Inactivity Rules
- Director tracks player activity from FACT.* events
- Inactivity report included in director output
- L2 acts on inactivity recommendations (eliminate or nudge)
- Admin visibility and override

---

## Key Design Decisions

1. **Discriminated union on `kind`** — not version numbers, not feature flags. Each manifest variant is a complete, self-describing type.

2. **Director is an actor, not a pure function** — because it needs to accumulate observations throughout the day and can influence the current day in real-time.

3. **Ruleset is a discriminated union per game type** — not a monolithic config. Each game type defines its own shape. This prevents coupling between game types.

4. **Schedule presets are lobby-side only** — the server sees concrete timestamps, not preset names. The preset name is stored in the dynamic manifest so the director can resolve future days' timelines.

5. **`days[]` grows in dynamic mode** — the director appends each resolved day. This maintains the existing L3 input pattern (`manifest.days.find()`) and creates an audit trail of director decisions.

6. **Static mode is untouched** — zero changes to the current code path. All dynamic day logic is behind the `manifest.kind === 'DYNAMIC'` check.

7. **Future-ready seams without premature abstraction** — the L3 contract and generic orchestrator are sketched but not built. The type system defines the boundaries; the runtime stays simple.
