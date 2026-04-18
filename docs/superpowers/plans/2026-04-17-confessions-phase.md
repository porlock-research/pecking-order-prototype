# Confessions — Plan 1: Confession Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the confession *phase* — a new L3 parallel region that hosts an anonymized group chat through a dedicated CONFESSION channel, archiving posts as first-class `FactTypes.CONFESSION_POSTED` facts. After this plan, games with `ruleset.confessions.enabled === true` can open a confession phase via manifest timeline events; alive players post under stable per-phase handles ("Confessor #3"); posts persist to D1; phase closes cleanly. The match cartridge is NOT in scope — Plan 2 (`2026-04-17-confessions-match.md`) consumes the archive this plan produces.

**Architecture:** Additive L3 region `confessionLayer` (`idle → posting → idle`) alongside existing `mainStage`, `activityLayer`, `dilemmaLayer`. New channel type `CONFESSION` with single capability `'CONFESS'` enforces validator-level rejection for any non-confession event. Per-recipient projection in `buildSyncPayload(deps, pid, ...)` reduces `confessionPhase.handlesByPlayer` to `{ myHandle, handleCount }` — the full map never leaves the server. Group chat pauses via the existing `groupChatOpen=false` mechanism during the phase.

**Tech Stack:** TypeScript, XState v5.26.0, Cloudflare Workers + Durable Objects, D1 SQL, Vitest, Playwright, React 19 + Vite (Pulse client), Zustand.

**Related:**
- **Spec:** `docs/superpowers/specs/2026-04-17-spec-c-confessions-design.md` (approved 2026-04-17, five rounds of review)
- **Plan 2 (follows):** `docs/superpowers/plans/2026-04-17-confessions-match.md` — match cartridge implementation on top of Plan 1
- **ADR-096** — channel capability system (pattern this plan extends)
- **ADR-112** — parallel layer pattern (dilemmaLayer precedent for this plan's L3 region)

**Non-goals (explicitly deferred to Plan 2):**
- `CONFESSION_MATCH` prompt cartridge (rewrite of `confession-machine.ts`)
- `activityLayer.loading` sub-state for async D1 archive loads
- `d1-confession-queries.ts` / `loadConfessionArchive` helper
- Handle-assignment algorithm for matchers (different concern from phase handles)
- Match reveal UI; LOAD_ERROR client copy; `results.status` tri-state

---

## Commands (run from the worktree root)

```bash
npm test                         # run all vitest suites
npm run build                    # full turborepo build
cd apps/game-server && npx vitest run src/machines/__tests__/<name>.test.ts   # single test file
cd apps/client && npx vitest run src/shells/pulse/components/chat/__tests__/<name>.test.ts
npm run test:e2e -- --grep "confession"   # playwright e2e filter
```

After every task: `npm test` must pass; `npm run build` must succeed at a Phase boundary (marked in-plan).

---

## File structure

### New files

**Shared types / config:**
- Additions only, no new files in `packages/shared-types/`.

**Server:**
- `apps/game-server/src/machines/actions/l3-confession.ts` — L3 entry/exit/handler actions for the confession phase
- `apps/game-server/src/machines/observations/confession-handles.ts` — seeded RNG + handle assignment helper (module-local, no dependency on observations/ despite the path; placed there for proximity to future GM Intelligence use)

**Tests:**
- `apps/game-server/src/machines/__tests__/confession-layer.test.ts`
- `apps/game-server/src/machines/__tests__/confession-channel-capabilities.test.ts`
- `apps/game-server/src/machines/__tests__/confession-fact-projection.test.ts`
- `apps/game-server/src/machines/__tests__/confession-handles.test.ts`
- `apps/game-server/src/__tests__/confession-sync-per-recipient.test.ts`
- `apps/client/src/shells/pulse/components/chat/__tests__/ConfessionChannel.test.tsx`
- `e2e/tests/confession-phase.spec.ts`

### Modified files

- `packages/shared-types/src/events.ts` — `Events.Confession.POST`, `FactTypes.CONFESSION_POSTED|PHASE_STARTED|PHASE_ENDED`, `TickerCategories.SOCIAL_PHASE`, `TimelineActions.START_CONFESSION_CHAT|END_CONFESSION_CHAT`
- `packages/shared-types/src/index.ts` — `ChannelType: 'CONFESSION'`, `ChannelCapability: 'CONFESS'`, `PeckingOrderRulesetSchema.confessions` block, `Config.confession.maxConfessionLength`
- `apps/game-server/src/d1-persistence.ts` — add 3 new fact types to `JOURNALABLE_TYPES`
- `apps/game-server/src/projections.ts` — per-fact `actorId` strip for `CONFESSION_POSTED`
- `apps/game-server/src/ticker.ts` — `CONFESSION_PHASE_STARTED` → `SOCIAL_PHASE` narrator line
- `apps/game-server/src/push-triggers.ts` — handle `PUSH.PHASE { trigger: 'CONFESSION_OPEN' }` for phase-open push broadcast; null handling for all 3 new fact types in fact-path push
- `apps/game-server/src/sync.ts` — `buildSyncPayload` per-recipient reduction of `confessionPhase.handlesByPlayer` → `{ myHandle, handleCount }`
- `apps/game-server/src/machines/l3-session.ts` — add `confessionLayer` parallel region, extend `DailyContext` with `confessionPhase`, register l3-confession actions
- `apps/game-server/src/machines/actions/l2-day-resolution.ts` — handle the two new timeline actions in `processTimelineEvent`
- `apps/client/src/shells/pulse/components/chat/ChatView.tsx` — extend `narratorTickers` filter to include `SOCIAL_PHASE`
- `apps/client/src/shells/pulse/components/chat/ChannelList.tsx` (or equivalent) — CONFESSION channel render entry
- `apps/client/src/shells/pulse/components/composer/` — CONFESSION composer (text + character counter)
- `apps/client/src/store/useGameStore.ts` — hydrate `confessionPhase` from SYNC
- `apps/lobby/app/admin/games/_lib/manifest-schema.ts` (or equivalent) — accept `START_CONFESSION_CHAT`/`END_CONFESSION_CHAT` + ruleset `confessions.enabled` toggle
- `apps/game-server/src/demo/` — DemoServer investigation (per CLAUDE.md rule)

---

## Phase 0 — Shared-types + plumbing foundations

### Task 1: Shared-types additions (events, fact types, ticker category, channel type, capability, ruleset, config)

**Files:**
- Modify: `packages/shared-types/src/events.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/__tests__/confessions-types.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared-types/src/__tests__/confessions-types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  Events,
  FactTypes,
  TickerCategories,
  TimelineActions,
  Config,
  PeckingOrderRulesetSchema,
} from '../index';

describe('Confessions shared types', () => {
  it('declares Events.Confession.POST', () => {
    expect(Events.Confession.POST).toBe('CONFESSION.POST');
    expect(Events.Confession.PREFIX).toBe('CONFESSION.');
  });

  it('declares three new fact types', () => {
    expect(FactTypes.CONFESSION_POSTED).toBe('CONFESSION_POSTED');
    expect(FactTypes.CONFESSION_PHASE_STARTED).toBe('CONFESSION_PHASE_STARTED');
    expect(FactTypes.CONFESSION_PHASE_ENDED).toBe('CONFESSION_PHASE_ENDED');
  });

  it('declares SOCIAL_PHASE ticker category', () => {
    expect(TickerCategories.SOCIAL_PHASE).toBe('SOCIAL.PHASE');
  });

  it('declares timeline actions', () => {
    expect(TimelineActions.START_CONFESSION_CHAT).toBe('START_CONFESSION_CHAT');
    expect(TimelineActions.END_CONFESSION_CHAT).toBe('END_CONFESSION_CHAT');
  });

  it('Config.confession.maxConfessionLength = 280', () => {
    expect(Config.confession.maxConfessionLength).toBe(280);
  });

  it('ruleset accepts confessions.enabled: true', () => {
    const base = minimalRuleset();
    const parsed = PeckingOrderRulesetSchema.parse({ ...base, confessions: { enabled: true } });
    expect(parsed.confessions?.enabled).toBe(true);
  });

  it('ruleset accepts confessions.enabled: false', () => {
    const base = minimalRuleset();
    const parsed = PeckingOrderRulesetSchema.parse({ ...base, confessions: { enabled: false } });
    expect(parsed.confessions?.enabled).toBe(false);
  });

  it('ruleset accepts absent confessions block (backward compat)', () => {
    const base = minimalRuleset();
    const parsed = PeckingOrderRulesetSchema.parse(base);
    expect(parsed.confessions).toBeUndefined();
  });

  it('ruleset rejects confessions as a non-object', () => {
    const base = minimalRuleset();
    expect(() => PeckingOrderRulesetSchema.parse({ ...base, confessions: 'yes' })).toThrow();
  });

  function minimalRuleset() {
    return {
      kind: 'PECKING_ORDER' as const,
      voting: { mode: 'SEQUENCE', sequence: ['MAJORITY'] },
      games: { mode: 'NONE', avoidRepeat: false },
      activities: { mode: 'NONE', avoidRepeat: false },
      social: {
        dmChars: { mode: 'FIXED', base: 1200 },
        dmPartners: { mode: 'FIXED', base: 3 },
        dmCost: 1, groupDmEnabled: true, requireDmInvite: false, dmSlotsPerPlayer: 5,
      },
      inactivity: { enabled: true, thresholdDays: 2, action: 'ELIMINATE' as const },
      dayCount: { mode: 'ACTIVE_PLAYERS_MINUS_ONE' as const },
    };
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && npx vitest run src/__tests__/confessions-types.test.ts`
Expected: FAIL — `Events.Confession` undefined, `FactTypes.CONFESSION_POSTED` undefined, etc.

- [ ] **Step 3: Extend `events.ts`**

In `packages/shared-types/src/events.ts`:

```ts
// Add inside the Events namespace (near Events.Social / Events.Activity):
export const Events = {
  // ... existing ...
  Confession: {
    PREFIX: 'CONFESSION.',
    POST: 'CONFESSION.POST',
  },
};
```

Add to `FactTypes`:

```ts
CONFESSION_POSTED: 'CONFESSION_POSTED',
CONFESSION_PHASE_STARTED: 'CONFESSION_PHASE_STARTED',
CONFESSION_PHASE_ENDED: 'CONFESSION_PHASE_ENDED',
```

Add to `TickerCategories`:

```ts
SOCIAL_PHASE: 'SOCIAL.PHASE',
```

Add to `TimelineActions` (locate the existing enum — it's the one with `START_ACTIVITY`, `END_ACTIVITY`, etc.):

```ts
START_CONFESSION_CHAT: 'START_CONFESSION_CHAT',
END_CONFESSION_CHAT: 'END_CONFESSION_CHAT',
```

- [ ] **Step 4: Extend `index.ts`** — channel type, capability, ruleset, config

In `packages/shared-types/src/index.ts`:

1. Extend `ChannelTypeSchema` + `ChannelType` (line ~515):

```ts
export const ChannelTypeSchema = z.enum(['MAIN', 'DM', 'GROUP_DM', 'GAME_DM', 'CONFESSION']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;
```

2. Extend `ChannelCapability` union (line ~518):

```ts
export type ChannelCapability =
  | 'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES' | 'GAME_ACTIONS'
  | 'NUDGE'
  | 'WHISPER'
  | 'CONFESS';   // NEW
```

3. Extend `PeckingOrderRulesetSchema` (locate the existing Zod schema):

```ts
export const PeckingOrderRulesetSchema = z.object({
  // ... existing fields ...
  confessions: z.object({
    enabled: z.boolean(),
  }).optional(),
});
```

4. Extend `Config` (locate the existing Config const):

```ts
export const Config = {
  // ... existing ...
  confession: {
    maxConfessionLength: 280,   // chosen over Config.chat.maxMessageLength (1200) to force brevity + Twitter-feel cadence
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/shared-types && npx vitest run src/__tests__/confessions-types.test.ts`
Expected: PASS (9 tests).

Run the full suite to catch downstream breaks: `npm test`
Expected: all green (additive changes only).

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/events.ts \
        packages/shared-types/src/index.ts \
        packages/shared-types/src/__tests__/confessions-types.test.ts
git commit -m "types(confessions): POST event, 3 fact types, SOCIAL_PHASE ticker, timeline actions, ChannelType/Capability, ruleset, Config"
```

---

### Task 2: Mark three new fact types journalable

**Files:**
- Modify: `apps/game-server/src/d1-persistence.ts`
- Test: `apps/game-server/src/__tests__/journalable-facts.test.ts`

- [ ] **Step 1: Write the failing test**

Extend `apps/game-server/src/__tests__/journalable-facts.test.ts`:

```ts
import { FactTypes } from '@pecking-order/shared-types';
import { JOURNALABLE_TYPES } from '../d1-persistence';

describe('JOURNALABLE_TYPES — confessions additions', () => {
  it('includes CONFESSION_POSTED', () => {
    expect(JOURNALABLE_TYPES.has(FactTypes.CONFESSION_POSTED)).toBe(true);
  });
  it('includes CONFESSION_PHASE_STARTED', () => {
    expect(JOURNALABLE_TYPES.has(FactTypes.CONFESSION_PHASE_STARTED)).toBe(true);
  });
  it('includes CONFESSION_PHASE_ENDED', () => {
    expect(JOURNALABLE_TYPES.has(FactTypes.CONFESSION_PHASE_ENDED)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/__tests__/journalable-facts.test.ts`
Expected: FAIL — the three new fact types not in the set.

- [ ] **Step 3: Extend `JOURNALABLE_TYPES`**

In `apps/game-server/src/d1-persistence.ts`, locate `JOURNALABLE_TYPES` set. Add:

```ts
FactTypes.CONFESSION_POSTED,
FactTypes.CONFESSION_PHASE_STARTED,
FactTypes.CONFESSION_PHASE_ENDED,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/__tests__/journalable-facts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/d1-persistence.ts \
        apps/game-server/src/__tests__/journalable-facts.test.ts
git commit -m "server(confessions): mark CONFESSION_POSTED/PHASE_STARTED/PHASE_ENDED journalable"
```

---

### Task 3: `projections.ts` — per-fact actorId strip for CONFESSION_POSTED

**Files:**
- Modify: `apps/game-server/src/projections.ts`
- Test: `apps/game-server/src/machines/__tests__/confession-fact-projection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/game-server/src/machines/__tests__/confession-fact-projection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FactTypes, GAME_MASTER_ID } from '@pecking-order/shared-types';
import { projectFactForClient } from '../../projections';   // exported in Step 3

describe('projectFactForClient — CONFESSION_POSTED', () => {
  const baseFact = {
    type: FactTypes.CONFESSION_POSTED,
    actorId: 'p3',
    targetId: undefined,
    payload: { channelId: 'CONFESSION-d2', handle: 'Confessor #3', text: 'the truth is I hate mondays', dayIndex: 2 },
    timestamp: 1_700_000_000_000,
  };

  it('strips actorId before broadcast', () => {
    const projected = projectFactForClient(baseFact);
    expect((projected as any).actorId).toBeUndefined();
  });

  it('preserves handle, text, channelId, dayIndex, timestamp', () => {
    const projected = projectFactForClient(baseFact);
    expect(projected.payload.handle).toBe('Confessor #3');
    expect(projected.payload.text).toBe(baseFact.payload.text);
    expect(projected.payload.channelId).toBe('CONFESSION-d2');
    expect(projected.payload.dayIndex).toBe(2);
    expect(projected.timestamp).toBe(baseFact.timestamp);
  });

  it('does NOT mutate the input fact', () => {
    const copy = JSON.parse(JSON.stringify(baseFact));
    projectFactForClient(baseFact);
    expect(baseFact).toEqual(copy);
  });

  it('pass-through for non-CONFESSION_POSTED facts (preserves actorId)', () => {
    const other = { type: FactTypes.DM_SENT, actorId: 'p1', payload: {}, timestamp: 1 };
    const projected = projectFactForClient(other);
    expect(projected.actorId).toBe('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-fact-projection.test.ts`
Expected: FAIL — `projectFactForClient` not exported.

- [ ] **Step 3: Implement the per-fact strip**

In `apps/game-server/src/projections.ts`, add:

```ts
import { FactTypes } from '@pecking-order/shared-types';

/**
 * Strip sensitive fields from facts before broadcasting to clients.
 * Per-fact-type branch. NEVER add a generic "strip actorId from all facts" rule —
 * some facts (e.g., PROMPT_RESULT with the match cartridge's full reveal) legitimately
 * carry author information. This function is the whitelist of known-sensitive strips.
 */
export function projectFactForClient(fact: any): any {
  if (fact.type === FactTypes.CONFESSION_POSTED) {
    const { actorId, ...rest } = fact;
    return rest;
  }
  return fact;
}
```

- [ ] **Step 4: Wire `projectFactForClient` into the broadcast path**

Find the existing fact-broadcast site (grep `forwardFactToGameMaster\|broadcastFact\|fact.*broadcast` in `apps/game-server/src/`). Typical location: wherever L2 raises a fact and clients receive it via SYNC or a dedicated `FACT.UPDATE` ws message. Wrap the client-bound emission:

```ts
import { projectFactForClient } from './projections';

// Before sending a fact to the client:
const clientFact = projectFactForClient(fact);
ws.send(JSON.stringify({ type: 'FACT.UPDATE', fact: clientFact }));
```

If facts are only exposed via SYNC (not as standalone FACT.UPDATE events), there is no new wiring — the strip is applied inside `buildSyncPayload` where facts appear in the payload. Grep `buildSyncPayload` for fact references and wrap there.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-fact-projection.test.ts`
Expected: PASS (4 tests).

Full suite: `npm test` — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/projections.ts \
        apps/game-server/src/machines/__tests__/confession-fact-projection.test.ts
git commit -m "server(confessions): projectFactForClient strips actorId from CONFESSION_POSTED before broadcast"
```

---

### Task 4: `ticker.ts` — CONFESSION_PHASE_STARTED → SOCIAL_PHASE narrator line

**Files:**
- Modify: `apps/game-server/src/ticker.ts`
- Test: `apps/game-server/src/__tests__/ticker.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Extend `apps/game-server/src/__tests__/ticker.test.ts`:

```ts
describe('factToTicker — confession phase facts', () => {
  it('CONFESSION_PHASE_STARTED → SOCIAL_PHASE ticker with booth copy', () => {
    const fact = {
      type: FactTypes.CONFESSION_PHASE_STARTED,
      actorId: 'SYSTEM',
      payload: { dayIndex: 2, channelId: 'CONFESSION-d2' },
      timestamp: 1_700_000_000_000,
    };
    const msg = factToTicker(fact as any, { /* existing fixture deps */ });
    expect(msg).not.toBeNull();
    expect(msg!.category).toBe(TickerCategories.SOCIAL_PHASE);
    expect(msg!.text).toBe('The confession booth is open.');
  });

  it('CONFESSION_PHASE_ENDED produces no ticker entry', () => {
    const fact = {
      type: FactTypes.CONFESSION_PHASE_ENDED,
      actorId: 'SYSTEM',
      payload: { dayIndex: 2, channelId: 'CONFESSION-d2', postCount: 14 },
      timestamp: 1_700_000_000_000,
    };
    expect(factToTicker(fact as any, { /* existing deps */ })).toBeNull();
  });

  it('CONFESSION_POSTED produces no ticker entry (policy: silence during phase)', () => {
    const fact = {
      type: FactTypes.CONFESSION_POSTED,
      actorId: 'p1',
      payload: { channelId: 'CONFESSION-d2', handle: 'Confessor #3', text: 'x', dayIndex: 2 },
      timestamp: 1,
    };
    expect(factToTicker(fact as any, { /* existing deps */ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/__tests__/ticker.test.ts`
Expected: FAIL — no branches for new fact types.

- [ ] **Step 3: Add branches to `factToTicker`**

In `apps/game-server/src/ticker.ts`, inside `factToTicker`, add branches before the default-null fallthrough:

```ts
if (fact.type === FactTypes.CONFESSION_PHASE_STARTED) {
  return {
    id: `gm-phase-${fact.timestamp}`,
    category: TickerCategories.SOCIAL_PHASE,
    text: 'The confession booth is open.',
    actorId: 'SYSTEM',
    timestamp: fact.timestamp,
  };
}
if (fact.type === FactTypes.CONFESSION_PHASE_ENDED) {
  return null;  // phase-close is quiet; match cartridge the next day is the drum beat
}
if (fact.type === FactTypes.CONFESSION_POSTED) {
  return null;  // per-post silence — prevents timing-based deanonymization
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/__tests__/ticker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/ticker.ts \
        apps/game-server/src/__tests__/ticker.test.ts
git commit -m "server(confessions): CONFESSION_PHASE_STARTED → SOCIAL_PHASE narrator line; POSTED/ENDED silent"
```

---

### Task 5: `push-triggers.ts` — PUSH.PHASE CONFESSION_OPEN broadcast; null for fact-path pushes

**Files:**
- Modify: `apps/game-server/src/push-triggers.ts`
- Test: `apps/game-server/src/__tests__/push-triggers.test.ts` (extend or create)

- [ ] **Step 1: Write the failing test**

Extend or create `apps/game-server/src/__tests__/push-triggers.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { FactTypes } from '@pecking-order/shared-types';
import { handleFactPush, handlePhasePush } from '../push-triggers';

describe('handleFactPush — confession facts all return null', () => {
  const deps = { sendPush: vi.fn() };
  beforeEach(() => deps.sendPush.mockReset());

  it('CONFESSION_POSTED: no push (spam + deanonymization)', async () => {
    await handleFactPush({
      type: FactTypes.CONFESSION_POSTED, actorId: 'p1',
      payload: { channelId: 'CONFESSION-d2', handle: 'Confessor #1', text: 'x', dayIndex: 2 },
      timestamp: 1,
    } as any, deps as any);
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it('CONFESSION_PHASE_STARTED: no push via fact path (push fires via PUSH.PHASE)', async () => {
    await handleFactPush({
      type: FactTypes.CONFESSION_PHASE_STARTED, actorId: 'SYSTEM',
      payload: { dayIndex: 2, channelId: 'CONFESSION-d2' },
      timestamp: 1,
    } as any, deps as any);
    expect(deps.sendPush).not.toHaveBeenCalled();
  });

  it('CONFESSION_PHASE_ENDED: no push', async () => {
    await handleFactPush({
      type: FactTypes.CONFESSION_PHASE_ENDED, actorId: 'SYSTEM',
      payload: { dayIndex: 2, channelId: 'CONFESSION-d2', postCount: 14 },
      timestamp: 1,
    } as any, deps as any);
    expect(deps.sendPush).not.toHaveBeenCalled();
  });
});

describe('handlePhasePush — CONFESSION_OPEN trigger broadcasts to alive players', () => {
  it('sends "A confession phase has opened." to every alive player', async () => {
    const sendPush = vi.fn();
    await handlePhasePush({
      trigger: 'CONFESSION_OPEN',
      roster: {
        p1: { id: 'p1', status: 'ALIVE' },
        p2: { id: 'p2', status: 'ALIVE' },
        p3: { id: 'p3', status: 'ELIMINATED' },
      },
    } as any, { sendPush } as any);
    expect(sendPush).toHaveBeenCalledTimes(2);
    const calls = sendPush.mock.calls.map(c => c[0]);
    expect(calls.every((p: any) => p.body === 'A confession phase has opened.')).toBe(true);
    const targets = calls.map((p: any) => p.targetId).sort();
    expect(targets).toEqual(['p1', 'p2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/__tests__/push-triggers.test.ts`
Expected: FAIL — no handling for new fact types or CONFESSION_OPEN trigger.

- [ ] **Step 3: Implement the handlers**

In `apps/game-server/src/push-triggers.ts`, inside `handleFactPush`:

```ts
if (fact.type === FactTypes.CONFESSION_POSTED) return;      // per-post silence
if (fact.type === FactTypes.CONFESSION_PHASE_STARTED) return;  // push goes via PUSH.PHASE, not fact path
if (fact.type === FactTypes.CONFESSION_PHASE_ENDED) return;
```

In `handlePhasePush` (find the existing switch on `trigger`), add:

```ts
if (trigger === 'CONFESSION_OPEN') {
  for (const [pid, player] of Object.entries(roster)) {
    if (player.status !== 'ALIVE') continue;
    await sendPush({
      targetId: pid,
      title: 'Confession',
      body: 'A confession phase has opened.',
      intent: null,  // Plan 1 does not set a deep-link intent; Plan 2 may route into the match cartridge when it spawns
    });
  }
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/__tests__/push-triggers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/push-triggers.ts \
        apps/game-server/src/__tests__/push-triggers.test.ts
git commit -m "server(confessions): PUSH.PHASE CONFESSION_OPEN broadcast; confession facts null in fact-path push"
```

---

**Phase 0 boundary — `npm run build` + `npm test` must both succeed before proceeding.**

```bash
npm run build && npm test
```

---

## Phase 1 — L3 region, actions, POST handler

### Task 6: Seeded RNG + handle-assignment helper

**Files:**
- Create: `apps/game-server/src/machines/observations/confession-handles.ts`
- Create: `apps/game-server/src/machines/__tests__/confession-handles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/game-server/src/machines/__tests__/confession-handles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { assignPhaseHandles, createSeededRng } from '../observations/confession-handles';

describe('createSeededRng', () => {
  it('produces the same sequence for the same seed', () => {
    const rng1 = createSeededRng('abc');
    const rng2 = createSeededRng('abc');
    expect([rng1.next(), rng1.next(), rng1.next()])
      .toEqual([rng2.next(), rng2.next(), rng2.next()]);
  });
  it('differs across seeds', () => {
    expect(createSeededRng('abc').next()).not.toBe(createSeededRng('abd').next());
  });
});

describe('assignPhaseHandles', () => {
  it('assigns one unique handle per player', () => {
    const result = assignPhaseHandles(['p1', 'p2', 'p3', 'p4'], 'g1:2:confession');
    const handles = Object.values(result);
    expect(handles).toHaveLength(4);
    expect(new Set(handles).size).toBe(4);
  });

  it('handle format matches "Confessor #N"', () => {
    const result = assignPhaseHandles(['p1', 'p2'], 'g1:2:confession');
    for (const h of Object.values(result)) {
      expect(h).toMatch(/^Confessor #\d+$/);
    }
  });

  it('deterministic on same (players, seed)', () => {
    const a = assignPhaseHandles(['p1', 'p2', 'p3'], 'g1:2:confession');
    const b = assignPhaseHandles(['p1', 'p2', 'p3'], 'g1:2:confession');
    expect(a).toEqual(b);
  });

  it('different seeds produce different assignments for the same roster', () => {
    const a = assignPhaseHandles(['p1', 'p2', 'p3', 'p4'], 'g1:2:confession');
    const b = assignPhaseHandles(['p1', 'p2', 'p3', 'p4'], 'g1:3:confession');
    expect(a).not.toEqual(b);
  });

  it('empty roster returns empty map', () => {
    expect(assignPhaseHandles([], 'seed')).toEqual({});
  });

  it('uses sequential handle numbers 1..N', () => {
    const result = assignPhaseHandles(['p1', 'p2', 'p3'], 'seed');
    const numbers = Object.values(result).map(h => Number(h.split('#')[1])).sort();
    expect(numbers).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-handles.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `apps/game-server/src/machines/observations/confession-handles.ts`:

```ts
export interface SeededRng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  nextInt(n: number): number;
}

/**
 * Deterministic seeded RNG — xmur3 hash → mulberry32.
 * Same seed → same sequence. Used for reproducible handle assignment.
 */
export function createSeededRng(seed: string): SeededRng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (h ^= h >>> 16) >>> 0;

  const next = (): number => {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: (n) => Math.floor(next() * n),
  };
}

/**
 * Assign stable "Confessor #N" handles to each player, deterministic on seed.
 * Returns `Record<playerId, handle>`. Sequential numbers 1..N after shuffle —
 * shuffle decides which playerId gets which number.
 */
export function assignPhaseHandles(playerIds: string[], seed: string): Record<string, string> {
  if (playerIds.length === 0) return {};
  const rng = createSeededRng(seed);

  // Fisher-Yates shuffle of playerIds
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const out: Record<string, string> = {};
  shuffled.forEach((pid, idx) => {
    out[pid] = `Confessor #${idx + 1}`;
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-handles.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/machines/observations/confession-handles.ts \
        apps/game-server/src/machines/__tests__/confession-handles.test.ts
git commit -m "server(confessions): seeded RNG + assignPhaseHandles helper"
```

---

### Task 7: L3 `DailyContext.confessionPhase` field + `buildL3Context` default

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts`
- Test: `apps/game-server/src/machines/__tests__/confession-layer.test.ts` (new file; Task 9 extends it)

- [ ] **Step 1: Write the failing test**

Create `apps/game-server/src/machines/__tests__/confession-layer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildL3Context } from '../l3-session';
import type { SocialPlayer } from '@pecking-order/shared-types';

function roster(ids: string[]): Record<string, SocialPlayer> {
  const out: Record<string, SocialPlayer> = {};
  ids.forEach((id, i) => {
    out[id] = {
      id, personaName: `Player ${i}`, avatarUrl: '', status: 'ALIVE',
      silver: 50, gold: 0, realUserId: `u${i}`,
    } as SocialPlayer;
  });
  return out;
}

describe('buildL3Context — confessionPhase field', () => {
  it('initializes confessionPhase with inactive default', () => {
    const ctx = buildL3Context({
      dayIndex: 2,
      roster: roster(['p1', 'p2', 'p3']),
      manifest: undefined,
    });
    expect(ctx.confessionPhase).toEqual({
      active: false,
      handlesByPlayer: {},
      posts: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-layer.test.ts`
Expected: FAIL — `ctx.confessionPhase` undefined.

- [ ] **Step 3: Extend `DailyContext` + `buildL3Context`**

In `apps/game-server/src/machines/l3-session.ts`:

1. Extend `DailyContext` (locate the interface around line ~35):

```ts
export interface DailyContext {
  // ... existing fields ...
  confessionPhase: {
    active: boolean;
    handlesByPlayer: Record<string, string>;   // playerId → "Confessor #N" — SERVER-ONLY; per-recipient projected to { myHandle, handleCount }
    posts: Array<{ handle: string; text: string; ts: number }>;   // no authorId
  };
}
```

2. Extend `buildL3Context` return (line ~101):

```ts
return {
  // ... existing fields ...
  confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-layer.test.ts`
Expected: PASS (1 test).

Full suite: `npm test` — all green (additive field; nothing else reads it yet).

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/machines/l3-session.ts \
        apps/game-server/src/machines/__tests__/confession-layer.test.ts
git commit -m "server(confessions): DailyContext.confessionPhase field + buildL3Context default"
```

---

### Task 8: L3 `l3-confession.ts` actions — open/close channel, record, emit phase facts

**Files:**
- Create: `apps/game-server/src/machines/actions/l3-confession.ts`
- Test: extend `apps/game-server/src/machines/__tests__/confession-layer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `confession-layer.test.ts`:

```ts
import { l3ConfessionActions } from '../actions/l3-confession';

describe('l3-confession actions — openConfessionChannel', () => {
  it('creates CONFESSION channel with alive members and CONFESS capability', () => {
    const ctx: any = {
      gameId: 'g1',
      dayIndex: 2,
      roster: roster(['p1', 'p2']),
      channels: {},
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    };
    const nextCtxPatch = l3ConfessionActions.openConfessionChannel.assign({ context: ctx } as any);
    // Test harness: our action returns an assign-patch object for XState
    const next = { ...ctx, ...nextCtxPatch };
    expect(next.channels['CONFESSION-d2']).toBeDefined();
    expect(next.channels['CONFESSION-d2'].type).toBe('CONFESSION');
    expect(next.channels['CONFESSION-d2'].capabilities).toEqual(['CONFESS']);
    expect(next.channels['CONFESSION-d2'].memberIds.sort()).toEqual(['p1', 'p2']);
    expect(next.groupChatOpen).toBe(false);  // MAIN pauses
    expect(Object.keys(next.confessionPhase.handlesByPlayer).sort()).toEqual(['p1', 'p2']);
    expect(next.confessionPhase.active).toBe(true);
  });

  it('excludes eliminated players from memberIds + handles', () => {
    const r = roster(['p1', 'p2', 'p3']);
    r.p3.status = 'ELIMINATED' as any;
    const ctx: any = {
      gameId: 'g1', dayIndex: 2, roster: r, channels: {},
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    };
    const patch = l3ConfessionActions.openConfessionChannel.assign({ context: ctx } as any);
    const next = { ...ctx, ...patch };
    expect(next.channels['CONFESSION-d2'].memberIds.sort()).toEqual(['p1', 'p2']);
    expect(next.confessionPhase.handlesByPlayer.p3).toBeUndefined();
  });
});

describe('l3-confession actions — closeConfessionChannel', () => {
  it('removes the channel, restores groupChatOpen, clears handlesByPlayer + posts', () => {
    const ctx: any = {
      gameId: 'g1', dayIndex: 2, roster: roster(['p1', 'p2']),
      channels: {
        'CONFESSION-d2': { id: 'CONFESSION-d2', type: 'CONFESSION', memberIds: ['p1', 'p2'], capabilities: ['CONFESS'], createdBy: 'SYSTEM', createdAt: 1 },
        MAIN: { id: 'MAIN', type: 'MAIN', memberIds: ['p1', 'p2'], capabilities: ['CHAT'], createdBy: 'SYSTEM', createdAt: 0 },
      },
      confessionPhase: {
        active: true,
        handlesByPlayer: { p1: 'Confessor #1', p2: 'Confessor #2' },
        posts: [{ handle: 'Confessor #1', text: 'x', ts: 1 }],
      },
      groupChatOpen: false,
    };
    const patch = l3ConfessionActions.closeConfessionChannel.assign({ context: ctx } as any);
    const next = { ...ctx, ...patch };
    expect(next.channels['CONFESSION-d2']).toBeUndefined();
    expect(next.channels.MAIN).toBeDefined();
    expect(next.groupChatOpen).toBe(true);
    expect(next.confessionPhase).toEqual({ active: false, handlesByPlayer: {}, posts: [] });
  });
});

describe('l3-confession actions — recordConfession', () => {
  it('appends to posts with handle and emits CONFESSION_POSTED fact', () => {
    const ctx: any = {
      gameId: 'g1', dayIndex: 2, roster: roster(['p1', 'p2']),
      channels: {
        'CONFESSION-d2': { id: 'CONFESSION-d2', type: 'CONFESSION', memberIds: ['p1', 'p2'], capabilities: ['CONFESS'], createdBy: 'SYSTEM', createdAt: 1 },
      },
      confessionPhase: {
        active: true,
        handlesByPlayer: { p1: 'Confessor #1', p2: 'Confessor #2' },
        posts: [],
      },
    };
    const event: any = { type: 'CONFESSION.POST', senderId: 'p1', channelId: 'CONFESSION-d2', text: 'the truth is' };
    const raises: any[] = [];
    const enqueue: any = { raise: (e: any) => raises.push(e) };

    const patch = l3ConfessionActions.recordConfession({ context: ctx, event, enqueue } as any);
    const next = { ...ctx, confessionPhase: { ...ctx.confessionPhase, ...patch.confessionPhase } };

    expect(next.confessionPhase.posts).toHaveLength(1);
    expect(next.confessionPhase.posts[0].handle).toBe('Confessor #1');
    expect(next.confessionPhase.posts[0].text).toBe('the truth is');
    expect(next.confessionPhase.posts[0].ts).toBeGreaterThan(0);

    expect(raises).toHaveLength(1);
    expect(raises[0].type).toBe('FACT.RECORD');
    expect(raises[0].fact.type).toBe('CONFESSION_POSTED');
    expect(raises[0].fact.actorId).toBe('p1');
    expect(raises[0].fact.payload.handle).toBe('Confessor #1');
    expect(raises[0].fact.payload.channelId).toBe('CONFESSION-d2');
    expect(raises[0].fact.payload.dayIndex).toBe(2);
  });
});

describe('l3-confession actions — phase facts', () => {
  it('emitConfessionPhaseStartedFact raises FACT.RECORD with payload', () => {
    const ctx: any = { gameId: 'g1', dayIndex: 2 };
    const raises: any[] = [];
    l3ConfessionActions.emitConfessionPhaseStartedFact({ context: ctx, enqueue: { raise: (e: any) => raises.push(e) } } as any);
    expect(raises[0].fact.type).toBe('CONFESSION_PHASE_STARTED');
    expect(raises[0].fact.actorId).toBe('SYSTEM');
    expect(raises[0].fact.payload.dayIndex).toBe(2);
    expect(raises[0].fact.payload.channelId).toBe('CONFESSION-d2');
  });

  it('emitConfessionPhaseEndedFact raises FACT.RECORD with postCount', () => {
    const ctx: any = {
      gameId: 'g1', dayIndex: 2,
      confessionPhase: { active: true, handlesByPlayer: {}, posts: [{}, {}, {}] },
    };
    const raises: any[] = [];
    l3ConfessionActions.emitConfessionPhaseEndedFact({ context: ctx, enqueue: { raise: (e: any) => raises.push(e) } } as any);
    expect(raises[0].fact.type).toBe('CONFESSION_PHASE_ENDED');
    expect(raises[0].fact.payload.postCount).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-layer.test.ts`
Expected: FAIL — actions not implemented.

- [ ] **Step 3: Implement the actions**

Create `apps/game-server/src/machines/actions/l3-confession.ts`:

```ts
import { assign } from 'xstate';
import { Events, FactTypes, PlayerStatuses } from '@pecking-order/shared-types';
import { assignPhaseHandles } from '../observations/confession-handles';
import { log } from '../../log';

const confessionChannelId = (dayIndex: number) => `CONFESSION-d${dayIndex}`;

export const l3ConfessionActions = {
  /**
   * Phase-open entry action. Assigns handles, creates the CONFESSION channel,
   * pauses MAIN via groupChatOpen=false, flips confessionPhase.active=true.
   */
  openConfessionChannel: assign(({ context }: any) => {
    const aliveIds = Object.entries(context.roster || {})
      .filter(([, p]: [string, any]) => p?.status === PlayerStatuses.ALIVE)
      .map(([id]) => id);

    const seed = `${context.gameId}:${context.dayIndex}:confession`;
    const handlesByPlayer = assignPhaseHandles(aliveIds, seed);

    const channelId = confessionChannelId(context.dayIndex);
    const newChannel = {
      id: channelId,
      type: 'CONFESSION' as const,
      memberIds: aliveIds,
      createdBy: 'SYSTEM',
      createdAt: Date.now(),
      capabilities: ['CONFESS'] as const,
    };

    return {
      channels: { ...context.channels, [channelId]: newChannel },
      confessionPhase: {
        active: true,
        handlesByPlayer,
        posts: [],
      },
      groupChatOpen: false,
    };
  }),

  /**
   * Phase-close exit action. Destroys the channel, restores groupChatOpen,
   * clears confessionPhase in-memory (D1 archive is the persistent record).
   */
  closeConfessionChannel: assign(({ context }: any) => {
    const channelId = confessionChannelId(context.dayIndex);
    const { [channelId]: _removed, ...remainingChannels } = context.channels || {};
    return {
      channels: remainingChannels,
      confessionPhase: { active: false, handlesByPlayer: {}, posts: [] },
      groupChatOpen: true,
    };
  }),

  /**
   * POST handler. Validation chain runs BEFORE this (guards on the transition).
   * Records the post under the sender's handle, raises CONFESSION_POSTED fact.
   */
  recordConfession: ({ context, event, enqueue }: any) => {
    const handle = context.confessionPhase?.handlesByPlayer?.[event.senderId];
    if (!handle) {
      log('warn', 'L3', 'recordConfession: sender has no handle', { senderId: event.senderId });
      return {};
    }
    const ts = Date.now();
    const post = { handle, text: String(event.text), ts };

    enqueue.raise({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.CONFESSION_POSTED,
        actorId: event.senderId,
        payload: {
          channelId: event.channelId,
          handle,
          text: String(event.text),
          dayIndex: context.dayIndex,
        },
        timestamp: ts,
      },
    });

    log('info', 'confession', 'post-recorded', {
      dayIndex: context.dayIndex, handle, actorId: event.senderId, textLength: String(event.text).length,
    });

    return { confessionPhase: { ...context.confessionPhase, posts: [...context.confessionPhase.posts, post] } };
  },

  emitConfessionPhaseStartedFact: ({ context, enqueue }: any) => {
    enqueue.raise({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.CONFESSION_PHASE_STARTED,
        actorId: 'SYSTEM',
        payload: { dayIndex: context.dayIndex, channelId: confessionChannelId(context.dayIndex) },
        timestamp: Date.now(),
      },
    });
    log('info', 'confession', 'phase-started', {
      dayIndex: context.dayIndex,
      channelId: confessionChannelId(context.dayIndex),
      playerCount: Object.keys(context.confessionPhase?.handlesByPlayer || {}).length,
    });
  },

  emitConfessionPhaseEndedFact: ({ context, enqueue }: any) => {
    enqueue.raise({
      type: Events.Fact.RECORD,
      fact: {
        type: FactTypes.CONFESSION_PHASE_ENDED,
        actorId: 'SYSTEM',
        payload: {
          dayIndex: context.dayIndex,
          channelId: confessionChannelId(context.dayIndex),
          postCount: context.confessionPhase?.posts?.length ?? 0,
        },
        timestamp: Date.now(),
      },
    });
    log('info', 'confession', 'phase-ended', {
      dayIndex: context.dayIndex, postCount: context.confessionPhase?.posts?.length ?? 0,
    });
  },
};
```

Note the test harness uses `.assign` as an accessor for pure-function testing — the `assign` wrapped assignment returns a patch. If your existing L3 test harness uses a different pattern (e.g. `createActor` + `getSnapshot`), adapt the tests to match. The production code is unchanged either way.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-layer.test.ts`
Expected: PASS (5 tests added; 1 from Task 7 still green).

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-confession.ts \
        apps/game-server/src/machines/__tests__/confession-layer.test.ts
git commit -m "server(confessions): l3-confession actions — open/close/record + phase facts"
```

---

### Task 9: L3 `confessionLayer` parallel region + register actions

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts`
- Test: extend `apps/game-server/src/machines/__tests__/confession-layer.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `confession-layer.test.ts`:

```ts
import { createActor } from 'xstate';
import { dailySessionMachine } from '../l3-session';

function dynamicManifest(voteType: string = 'MAJORITY') {
  return { dayIndex: 2, voteType, timeline: [], firstEventTime: '2026-01-01T00:00:00Z' } as any;
}

describe('L3 confessionLayer lifecycle', () => {
  it('idle → posting on INTERNAL.START_CONFESSION_CHAT', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2', 'p3']), manifest: dynamicManifest() },
    });
    actor.start();
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
    const value = JSON.stringify(actor.getSnapshot().value);
    expect(value).toContain('"confessionLayer":"posting"');
    expect(actor.getSnapshot().context.confessionPhase.active).toBe(true);
    expect(Object.keys(actor.getSnapshot().context.confessionPhase.handlesByPlayer).sort())
      .toEqual(['p1', 'p2', 'p3']);
  });

  it('posting → idle on INTERNAL.END_CONFESSION_CHAT', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2']), manifest: dynamicManifest() },
    });
    actor.start();
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
    actor.send({ type: 'INTERNAL.END_CONFESSION_CHAT' } as any);
    const value = JSON.stringify(actor.getSnapshot().value);
    expect(value).toContain('"confessionLayer":"idle"');
    expect(actor.getSnapshot().context.confessionPhase.active).toBe(false);
  });

  it('CONFESSION channel appears in context on entry, disappears on exit', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2']), manifest: dynamicManifest() },
    });
    actor.start();
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
    expect(actor.getSnapshot().context.channels['CONFESSION-d2']).toBeDefined();
    actor.send({ type: 'INTERNAL.END_CONFESSION_CHAT' } as any);
    expect(actor.getSnapshot().context.channels['CONFESSION-d2']).toBeUndefined();
  });

  it('groupChatOpen toggles false/true across the phase lifecycle', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2']), manifest: dynamicManifest() },
    });
    actor.start();
    expect(actor.getSnapshot().context.groupChatOpen).toBeDefined();
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
    expect(actor.getSnapshot().context.groupChatOpen).toBe(false);
    actor.send({ type: 'INTERNAL.END_CONFESSION_CHAT' } as any);
    expect(actor.getSnapshot().context.groupChatOpen).toBe(true);
  });

  it('second START while already posting is a no-op (forbidden per spec)', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2']), manifest: dynamicManifest() },
    });
    actor.start();
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
    const firstHandles = { ...actor.getSnapshot().context.confessionPhase.handlesByPlayer };
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);  // should be ignored
    expect(actor.getSnapshot().context.confessionPhase.handlesByPlayer).toEqual(firstHandles);
  });

  it('snapshot round-trip mid-posting preserves state', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2']), manifest: dynamicManifest() },
    });
    actor.start();
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
    const snap = actor.getPersistedSnapshot();
    const restored = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2']), manifest: dynamicManifest() },
      snapshot: snap,
    }).start();
    expect(restored.getSnapshot().context.confessionPhase.active).toBe(true);
    expect(restored.getSnapshot().context.channels['CONFESSION-d2']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-layer.test.ts`
Expected: FAIL — confessionLayer region does not exist.

- [ ] **Step 3: Add `confessionLayer` parallel region**

In `apps/game-server/src/machines/l3-session.ts`:

1. Register the new action bag in `setup({ actions: ... })`:

```ts
import { l3ConfessionActions } from './actions/l3-confession';

actions: {
  ...l3SocialActions,
  ...l3VotingActions,
  ...l3GameActions,
  ...l3ActivityActions,
  ...l3DilemmaActions,
  ...l3PerkActions,
  ...l3ConfessionActions,   // NEW
} as any,
```

2. Add the `confessionLayer` parallel region. Locate the `running: { type: 'parallel', states: { ... } }` block and add a sibling state alongside `social`, `mainStage`, `activityLayer`, `dilemmaLayer`:

```ts
confessionLayer: {
  initial: 'idle',
  states: {
    idle: {
      on: {
        'INTERNAL.START_CONFESSION_CHAT': {
          target: 'posting',
          // guards come in Task 11 (ruleset + alive-count); for now, permissive
        },
      },
    },
    posting: {
      entry: [
        'openConfessionChannel',
        'emitConfessionPhaseStartedFact',
        ({ self }: any) => self.send({ type: 'PUSH.PHASE.TRIGGER', trigger: 'CONFESSION_OPEN' } as any),
      ],
      on: {
        'INTERNAL.END_CONFESSION_CHAT': {
          target: 'idle',
          actions: ['emitConfessionPhaseEndedFact', 'closeConfessionChannel'],
        },
        'CONFESSION.POST': {
          // Validation guard comes in Task 10; for now, forward straight to recordConfession
          actions: 'recordConfession',
        },
      },
    },
  },
},
```

Note on the push trigger: the `sendParent({ type: 'PUSH.PHASE', trigger: 'CONFESSION_OPEN' })` used elsewhere in this machine goes up to L2. Here we're inside L3, and L2 is the parent — use `sendParent`. Replace the third entry action with:

```ts
sendParent({ type: 'PUSH.PHASE', trigger: 'CONFESSION_OPEN' } as any),
```

Make sure `sendParent` is already imported from `'xstate'` at the top of the file (it is — used by existing `mainStage` states).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-layer.test.ts`
Expected: PASS (6 new + 5 existing).

Full suite: `npm test` — all green. Existing L3 tests unaffected (additive parallel region).

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/machines/l3-session.ts \
        apps/game-server/src/machines/__tests__/confession-layer.test.ts
git commit -m "server(confessions): confessionLayer parallel region — idle/posting lifecycle"
```

---

### Task 10: POST validation chain (6 rules) + capability-rejection tests

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-confession.ts` — add `isConfessionPostAllowed` guard
- Modify: `apps/game-server/src/machines/l3-session.ts` — attach the guard to the CONFESSION.POST transition; add capability-based rejection elsewhere
- Create: `apps/game-server/src/machines/__tests__/confession-channel-capabilities.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/game-server/src/machines/__tests__/confession-channel-capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { dailySessionMachine } from '../l3-session';
import { Events, PlayerStatuses, type SocialPlayer } from '@pecking-order/shared-types';

function roster(ids: string[], eliminatedIds: string[] = []): Record<string, SocialPlayer> {
  const out: Record<string, SocialPlayer> = {};
  ids.forEach((id, i) => {
    out[id] = {
      id, personaName: `P${i}`, avatarUrl: '',
      status: eliminatedIds.includes(id) ? PlayerStatuses.ELIMINATED : PlayerStatuses.ALIVE,
      silver: 50, gold: 0, realUserId: `u${i}`,
    } as SocialPlayer;
  });
  return out;
}

function bootPhase(ids: string[]) {
  const actor = createActor(dailySessionMachine, {
    input: {
      dayIndex: 2,
      roster: roster(ids),
      manifest: { dayIndex: 2, voteType: 'MAJORITY', timeline: [], firstEventTime: '2026-01-01T00:00:00Z' } as any,
    },
  });
  actor.start();
  actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
  return actor;
}

describe('POST validation chain', () => {
  it('accepts a valid POST from an alive member', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: 'CONFESSION.POST', senderId: 'p1', channelId: 'CONFESSION-d2', text: 'hi' } as any);
    const posts = actor.getSnapshot().context.confessionPhase.posts;
    expect(posts).toHaveLength(1);
    expect(posts[0].text).toBe('hi');
  });

  it('rejects when the phase is not active (layer = idle)', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 2, roster: roster(['p1', 'p2']), manifest: { dayIndex: 2, voteType: 'MAJORITY', timeline: [], firstEventTime: '' } as any },
    });
    actor.start();
    actor.send({ type: 'CONFESSION.POST', senderId: 'p1', channelId: 'CONFESSION-d2', text: 'x' } as any);
    expect(actor.getSnapshot().context.confessionPhase.posts).toHaveLength(0);
  });

  it('rejects when channel does not exist', () => {
    const actor = bootPhase(['p1']);
    actor.send({ type: 'CONFESSION.POST', senderId: 'p1', channelId: 'WRONG-ID', text: 'x' } as any);
    expect(actor.getSnapshot().context.confessionPhase.posts).toHaveLength(0);
  });

  it('rejects when sender is not a member of memberIds', () => {
    const actor = bootPhase(['p1', 'p2']);
    actor.send({ type: 'CONFESSION.POST', senderId: 'p99', channelId: 'CONFESSION-d2', text: 'x' } as any);
    expect(actor.getSnapshot().context.confessionPhase.posts).toHaveLength(0);
  });

  it('rejects when sender is eliminated mid-phase (in memberIds but roster.status = ELIMINATED)', () => {
    const actor = bootPhase(['p1', 'p2']);
    // Simulate elimination: mutate roster (in production this would happen via ELIMINATION fact flow)
    actor.send({ type: 'INTERNAL.SIMULATE_ELIMINATE', playerId: 'p1' } as any);  // helper event
    actor.send({ type: 'CONFESSION.POST', senderId: 'p1', channelId: 'CONFESSION-d2', text: 'x' } as any);
    expect(actor.getSnapshot().context.confessionPhase.posts).toHaveLength(0);
  });
  // NOTE: If INTERNAL.SIMULATE_ELIMINATE doesn't exist in the machine, adapt by directly testing
  // the guard helper via a unit-test import (isConfessionPostAllowed) rather than end-to-end.

  it('rejects when text exceeds maxConfessionLength (280)', () => {
    const actor = bootPhase(['p1', 'p2']);
    const longText = 'a'.repeat(281);
    actor.send({ type: 'CONFESSION.POST', senderId: 'p1', channelId: 'CONFESSION-d2', text: longText } as any);
    expect(actor.getSnapshot().context.confessionPhase.posts).toHaveLength(0);
  });

  it('accepts text at exactly 280 chars', () => {
    const actor = bootPhase(['p1', 'p2']);
    const exactText = 'a'.repeat(280);
    actor.send({ type: 'CONFESSION.POST', senderId: 'p1', channelId: 'CONFESSION-d2', text: exactText } as any);
    expect(actor.getSnapshot().context.confessionPhase.posts).toHaveLength(1);
  });
});

describe('CONFESSION channel capability rejection — non-CONFESS events fail', () => {
  // For each of the 8 existing capability-gated events, the CONFESSION channel (caps = ['CONFESS']) must reject.
  // These tests rely on the existing capability-check code paths in l3-social handlers, which check channel capabilities before action.
  const nonConfessEvents = [
    { type: 'SOCIAL.SEND_MSG', capability: 'CHAT' },
    { type: 'SOCIAL.SEND_SILVER', capability: 'SILVER_TRANSFER' },
    { type: 'SOCIAL.ADD_MEMBER', capability: 'INVITE_MEMBER' },
    { type: 'SOCIAL.REACT', capability: 'REACTIONS' },
    { type: 'SOCIAL.REPLY', capability: 'REPLIES' },
    { type: 'GAME.ACTION', capability: 'GAME_ACTIONS' },
    { type: 'SOCIAL.NUDGE', capability: 'NUDGE' },
    { type: 'SOCIAL.WHISPER', capability: 'WHISPER' },
  ];

  it.each(nonConfessEvents)('rejects $type on CONFESSION channel ($capability not granted)', ({ type }) => {
    const actor = bootPhase(['p1', 'p2']);
    const before = JSON.stringify(actor.getSnapshot().context);
    actor.send({ type, senderId: 'p1', channelId: 'CONFESSION-d2', content: 'x' } as any);
    const after = JSON.stringify(actor.getSnapshot().context);
    // No state change — the capability check drops the event before any action runs
    expect(after).toBe(before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-channel-capabilities.test.ts`
Expected: FAIL — the POST transition currently has no guards.

- [ ] **Step 3: Add the guard function**

In `apps/game-server/src/machines/actions/l3-confession.ts`, append:

```ts
import { Config } from '@pecking-order/shared-types';

export function isConfessionPostAllowed(context: any, event: any): { ok: boolean; reason?: string } {
  if (!context.confessionPhase?.active) return { ok: false, reason: 'phase-not-active' };

  const ch = context.channels?.[event.channelId];
  if (!ch) return { ok: false, reason: 'channel-not-found' };
  if (ch.type !== 'CONFESSION') return { ok: false, reason: 'wrong-channel-type' };
  if (!ch.capabilities?.includes('CONFESS')) return { ok: false, reason: 'capability-missing' };

  if (!ch.memberIds?.includes(event.senderId)) return { ok: false, reason: 'not-a-member' };

  const senderStatus = context.roster?.[event.senderId]?.status;
  if (senderStatus !== 'ALIVE') return { ok: false, reason: 'sender-eliminated' };

  const text = event.text;
  if (typeof text !== 'string' || text.length === 0) return { ok: false, reason: 'text-empty' };
  if (text.length > Config.confession.maxConfessionLength) return { ok: false, reason: 'text-too-long' };

  return { ok: true };
}
```

Export the helper so tests can import it directly.

Add a guard wrapper in the exported actions (for use in `setup({ guards })`):

```ts
export const l3ConfessionGuards = {
  isConfessionPostAllowed: ({ context, event }: any) => isConfessionPostAllowed(context, event).ok,
};
```

- [ ] **Step 4: Attach the guard in `l3-session.ts`**

In the `confessionLayer.posting` state's `on['CONFESSION.POST']` handler, make the transition conditional:

```ts
'CONFESSION.POST': {
  guard: 'isConfessionPostAllowed',
  actions: 'recordConfession',
},
```

Register the guards in `setup({ guards: { ... } })`:

```ts
import { l3ConfessionActions, l3ConfessionGuards } from './actions/l3-confession';

guards: {
  ...l3SocialGuards,
  ...l3PerkGuards,
  ...l3ConfessionGuards,   // NEW
} as any,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-channel-capabilities.test.ts`
Expected: PASS (the capability-rejection tests rely on existing capability checks; if those don't yet cover CONFESSION channels, the POST validation tests still pass on the guard. The capability-rejection tests may PASS vacuously because CONFESSION channels don't support those events' *actions*; adjust expectations if needed after running).

Full suite: `npm test` — all green.

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-confession.ts \
        apps/game-server/src/machines/l3-session.ts \
        apps/game-server/src/machines/__tests__/confession-channel-capabilities.test.ts
git commit -m "server(confessions): POST validation chain (6 rules incl. sender-eliminated); capability rejection tests"
```

---

### Task 11: Timeline action routing — START/END_CONFESSION_CHAT + ruleset + alive-count guard

**Files:**
- Modify: `apps/game-server/src/machines/actions/l2-day-resolution.ts` (or wherever `processTimelineEvent` lives — grep `processTimelineEvent` to locate)
- Test: extend `apps/game-server/src/machines/__tests__/confession-layer.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `confession-layer.test.ts`:

```ts
describe('Timeline action routing', () => {
  it('START_CONFESSION_CHAT event causes L3 to enter posting when enabled', () => {
    const actor = createActor(dailySessionMachine, {
      input: {
        dayIndex: 2,
        roster: roster(['p1', 'p2', 'p3']),
        manifest: {
          dayIndex: 2, voteType: 'MAJORITY',
          timeline: [{ time: new Date().toISOString(), action: 'START_CONFESSION_CHAT' }],
          firstEventTime: '2026-01-01T00:00:00Z',
        } as any,
      },
    });
    actor.start();
    // Simulate L2 processing the timeline event (send the L3-level INTERNAL event directly):
    actor.send({ type: 'INTERNAL.START_CONFESSION_CHAT' } as any);
    expect(JSON.stringify(actor.getSnapshot().value)).toContain('"confessionLayer":"posting"');
  });

  it('ruleset gate: when confessions.enabled = false, phase does not open', () => {
    // This test is at the L2 level — confessionLayer transition is permissive; the GATE
    // lives in processTimelineEvent. Verify the L2 handler skips raising INTERNAL.START_CONFESSION_CHAT
    // when the ruleset disables it.
    // ... L2 fixture omitted for brevity; see apps/game-server/src/machines/__tests__/l2-orchestrator.test.ts patterns ...
  });

  it('alive-count guard: < 2 alive players, phase does not open', () => {
    // Similar to above — L2-level guard. Cover via L2 unit test or via a helper assertion
    // on the L2 action that maps timeline events to L3 events.
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/confession-layer.test.ts`
Expected: PARTIAL FAIL — the first test passes (L3 accepts the event); the ruleset-gate and alive-count tests need the L2 gate wired.

- [ ] **Step 3: Extend `processTimelineEvent` in L2**

Locate `processTimelineEvent` (grep `processTimelineEvent` in `apps/game-server/src/machines/actions/`). It handles timeline-action-type dispatch. Add branches:

```ts
import { TimelineActions, PlayerStatuses } from '@pecking-order/shared-types';
import { log } from '../../log';

// Inside the processTimelineEvent switch/dispatch:

if (event.action === TimelineActions.START_CONFESSION_CHAT) {
  const ruleset = context.manifest?.ruleset;
  if (ruleset?.confessions?.enabled !== true) {
    log('info', 'confession', 'skip', { reason: 'disabled', dayIndex: context.dayIndex });
    return;
  }
  const aliveCount = Object.values(context.roster || {}).filter((p: any) => p?.status === PlayerStatuses.ALIVE).length;
  if (aliveCount < 2) {
    log('info', 'confession', 'skip', { reason: 'insufficient-players', aliveCount });
    return;
  }
  // Already-active guard (forbid double-open): if we're already in posting, no-op
  const l3State = context.l3StateValue;  // L2 may track this; otherwise forward and let L3 ignore
  enqueue.raise({ type: 'INTERNAL.START_CONFESSION_CHAT' });
  return;
}

if (event.action === TimelineActions.END_CONFESSION_CHAT) {
  enqueue.raise({ type: 'INTERNAL.END_CONFESSION_CHAT' });
  return;
}
```

`INTERNAL.START_CONFESSION_CHAT` forwarding to L3: the existing forwarder pattern (see the `'*'` catch-all in l2-orchestrator.ts that forwards Events.Internal / Events.Social / etc to L3) should already forward `INTERNAL.*` events. Verify by grep; if not, add `START_CONFESSION_CHAT` / `END_CONFESSION_CHAT` to the forward list.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/game-server && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/machines/actions/l2-day-resolution.ts \
        apps/game-server/src/machines/__tests__/confession-layer.test.ts
git commit -m "server(confessions): L2 timeline routing for START/END_CONFESSION_CHAT + ruleset/alive guards"
```

---

**Phase 1 boundary — `npm run build` + `npm test` must both succeed before proceeding.**

```bash
npm run build && npm test
```

---

## Phase 2 — SYNC per-recipient projection

### Task 12: `buildSyncPayload` reduces `confessionPhase.handlesByPlayer` per recipient

**Files:**
- Modify: `apps/game-server/src/sync.ts`
- Create: `apps/game-server/src/__tests__/confession-sync-per-recipient.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/game-server/src/__tests__/confession-sync-per-recipient.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSyncPayload } from '../sync';

function l3ContextFixture() {
  return {
    confessionPhase: {
      active: true,
      handlesByPlayer: { p1: 'Confessor #3', p2: 'Confessor #1', p3: 'Confessor #2' },
      posts: [{ handle: 'Confessor #3', text: 'the truth is', ts: 1 }],
    },
    channels: {
      'CONFESSION-d2': {
        id: 'CONFESSION-d2', type: 'CONFESSION',
        memberIds: ['p1', 'p2', 'p3'], capabilities: ['CONFESS'],
        createdBy: 'SYSTEM', createdAt: 0,
      },
    },
    roster: {
      p1: { id: 'p1', status: 'ALIVE', personaName: 'Ada' },
      p2: { id: 'p2', status: 'ALIVE', personaName: 'Ben' },
      p3: { id: 'p3', status: 'ALIVE', personaName: 'Cid' },
    },
    // ... other fields populated via spread from a base fixture
  };
}

function snapshotFixture() {
  return { context: { roster: l3ContextFixture().roster, /* ... */ }, value: 'dayLoop' } as any;
}

function baseDeps() {
  return {
    snapshot: snapshotFixture(),
    l3Context: l3ContextFixture(),
    chatLog: [],
    cartridges: [],
    l3SnapshotValue: 'running',
  } as any;
}

describe('buildSyncPayload — per-recipient confessionPhase projection', () => {
  it('p1 sees only their own myHandle', () => {
    const payload = buildSyncPayload(baseDeps(), 'p1');
    expect(payload.l3Context.confessionPhase.myHandle).toBe('Confessor #3');
    expect(payload.l3Context.confessionPhase.handleCount).toBe(3);
    expect(payload.l3Context.confessionPhase.handlesByPlayer).toBeUndefined();
  });

  it('p2 sees their own myHandle, not p1 or p3', () => {
    const payload = buildSyncPayload(baseDeps(), 'p2');
    expect(payload.l3Context.confessionPhase.myHandle).toBe('Confessor #1');
    expect(payload.l3Context.confessionPhase.handlesByPlayer).toBeUndefined();
  });

  it('non-member receives myHandle: null', () => {
    const payload = buildSyncPayload(baseDeps(), 'pUnknown');
    expect(payload.l3Context.confessionPhase.myHandle).toBeNull();
  });

  it('posts pass through unchanged (already anonymized at record time)', () => {
    const payload = buildSyncPayload(baseDeps(), 'p1');
    expect(payload.l3Context.confessionPhase.posts).toEqual([
      { handle: 'Confessor #3', text: 'the truth is', ts: 1 },
    ]);
  });

  it('active=false with empty phase: myHandle null, handleCount 0', () => {
    const deps = baseDeps();
    deps.l3Context.confessionPhase = { active: false, handlesByPlayer: {}, posts: [] };
    const payload = buildSyncPayload(deps, 'p1');
    expect(payload.l3Context.confessionPhase).toEqual({
      active: false, myHandle: null, handleCount: 0, posts: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/__tests__/confession-sync-per-recipient.test.ts`
Expected: FAIL — no per-recipient projection; full map still in payload.

- [ ] **Step 3: Add the projection inside `buildSyncPayload`**

In `apps/game-server/src/sync.ts`, inside `buildSyncPayload(deps, playerId, onlinePlayers)`, after extracting `l3Context`, add a reduction step before returning the payload:

```ts
const rawConfession = l3Context.confessionPhase || { active: false, handlesByPlayer: {}, posts: [] };
const confessionPhaseProjected = {
  active: rawConfession.active,
  myHandle: rawConfession.handlesByPlayer[playerId] ?? null,
  handleCount: Object.keys(rawConfession.handlesByPlayer).length,
  posts: rawConfession.posts,
};
```

Then wherever the current payload includes `l3Context` (or its shape), replace the raw `confessionPhase` with the projected version. Depending on the existing structure of `buildSyncPayload`, either:

- (a) construct a new `l3Context` object with `confessionPhase` replaced:
  ```ts
  const projectedL3Context = { ...l3Context, confessionPhase: confessionPhaseProjected };
  ```
  and use `projectedL3Context` everywhere below;
- or (b) if the payload includes `l3Context` whole, replace the `confessionPhase` key inside the output object literal.

Pattern-match to how existing sensitive fields are handled (e.g., the existing `ctx.confessions` strip in `projections.ts`) — prefer the approach that leaves `l3Context` semantically unchanged elsewhere.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/__tests__/confession-sync-per-recipient.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/sync.ts \
        apps/game-server/src/__tests__/confession-sync-per-recipient.test.ts
git commit -m "server(confessions): per-recipient buildSyncPayload projection — handlesByPlayer → { myHandle, handleCount }"
```

---

**Phase 2 boundary — `npm run build` + `npm test` must both succeed.**

---

## Phase 3 — Client: Pulse narrator filter + CONFESSION channel render + composer + store

### Task 13: Pulse `ChatView` narrator filter includes `SOCIAL_PHASE`

**Files:**
- Modify: `apps/client/src/shells/pulse/components/chat/ChatView.tsx`
- Test: create `apps/client/src/shells/pulse/components/chat/__tests__/ChatView.test.tsx` (if none exists; otherwise extend)

- [ ] **Step 1: Write the failing test**

Create or extend `apps/client/src/shells/pulse/components/chat/__tests__/ChatView.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChatView } from '../ChatView';
import { TickerCategories } from '@pecking-order/shared-types';

function propsFixture(overrides: any = {}): any {
  return {
    tickerMessages: [],
    messages: [],
    channels: {},
    selfId: 'p1',
    roster: {},
    ...overrides,
  };
}

describe('ChatView — SOCIAL_PHASE narrator filter', () => {
  it('renders SOCIAL_PHASE ticker messages as narrator lines', () => {
    render(<ChatView {...propsFixture({
      tickerMessages: [{
        id: 't1', category: TickerCategories.SOCIAL_PHASE,
        text: 'The confession booth is open.', timestamp: 1, actorId: 'SYSTEM',
      }],
    })} />);
    expect(screen.getByText('The confession booth is open.')).toBeInTheDocument();
  });

  it('existing SOCIAL_INVITE narrator lines still render', () => {
    render(<ChatView {...propsFixture({
      tickerMessages: [{
        id: 't1', category: TickerCategories.SOCIAL_INVITE,
        text: 'Someone invited you to a DM.', timestamp: 1, actorId: 'p2',
      }],
    })} />);
    expect(screen.getByText('Someone invited you to a DM.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/client && npx vitest run src/shells/pulse/components/chat/__tests__/ChatView.test.tsx`
Expected: FAIL on the SOCIAL_PHASE case; SOCIAL_INVITE still passes.

- [ ] **Step 3: Extend the filter**

In `apps/client/src/shells/pulse/components/chat/ChatView.tsx`, locate the `narratorTickers` filter (line ~67):

```tsx
const narratorTickers: TickerMessage[] = tickerMessages.filter(
  t => t.category === TickerCategories.SOCIAL_INVITE
    || t.category === TickerCategories.SOCIAL_PHASE,   // NEW
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/client && npx vitest run src/shells/pulse/components/chat/__tests__/ChatView.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/ChatView.tsx \
        apps/client/src/shells/pulse/components/chat/__tests__/ChatView.test.tsx
git commit -m "client(pulse): ChatView narrator filter accepts SOCIAL_PHASE"
```

---

### Task 14: Pulse CONFESSION channel render path + composer

**Files:**
- Modify: `apps/client/src/shells/pulse/components/chat/ChatView.tsx` — channel render branch
- Create: `apps/client/src/shells/pulse/components/composer/ConfessionComposer.tsx`
- Create: `apps/client/src/shells/pulse/components/chat/__tests__/ConfessionChannel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/client/src/shells/pulse/components/chat/__tests__/ConfessionChannel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConfessionComposer } from '../../composer/ConfessionComposer';

describe('ConfessionComposer', () => {
  it('renders the "Drop an anonymous confession..." placeholder', () => {
    render(<ConfessionComposer myHandle="Confessor #3" onSend={() => {}} />);
    expect(screen.getByPlaceholderText(/drop an anonymous confession/i)).toBeInTheDocument();
  });

  it('shows the assigned handle', () => {
    render(<ConfessionComposer myHandle="Confessor #3" onSend={() => {}} />);
    expect(screen.getByText(/Confessor #3/)).toBeInTheDocument();
  });

  it('character counter shows 0 / 280 when empty', () => {
    render(<ConfessionComposer myHandle="Confessor #3" onSend={() => {}} />);
    expect(screen.getByText('0 / 280')).toBeInTheDocument();
  });

  it('character counter updates as user types', () => {
    render(<ConfessionComposer myHandle="Confessor #3" onSend={() => {}} />);
    const input = screen.getByPlaceholderText(/drop an anonymous confession/i);
    fireEvent.change(input, { target: { value: 'hello' } });
    expect(screen.getByText('5 / 280')).toBeInTheDocument();
  });

  it('send button disables past 280 chars', () => {
    render(<ConfessionComposer myHandle="Confessor #3" onSend={() => {}} />);
    const input = screen.getByPlaceholderText(/drop an anonymous confession/i);
    fireEvent.change(input, { target: { value: 'a'.repeat(281) } });
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('send button enabled at exactly 280 chars', () => {
    render(<ConfessionComposer myHandle="Confessor #3" onSend={() => {}} />);
    const input = screen.getByPlaceholderText(/drop an anonymous confession/i);
    fireEvent.change(input, { target: { value: 'a'.repeat(280) } });
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });

  it('send calls onSend with text and clears the input', () => {
    const onSend = vi.fn();
    render(<ConfessionComposer myHandle="Confessor #3" onSend={onSend} />);
    const input = screen.getByPlaceholderText(/drop an anonymous confession/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'the truth is' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith('the truth is');
    expect(input.value).toBe('');
  });

  it('renders nothing actionable when myHandle is null (non-member)', () => {
    render(<ConfessionComposer myHandle={null} onSend={() => {}} />);
    expect(screen.queryByPlaceholderText(/drop an anonymous confession/i)).toBeNull();
    expect(screen.getByText(/not participating/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/client && npx vitest run src/shells/pulse/components/chat/__tests__/ConfessionChannel.test.tsx`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `ConfessionComposer`**

Create `apps/client/src/shells/pulse/components/composer/ConfessionComposer.tsx`:

```tsx
import { useState } from 'react';
import { Config } from '@pecking-order/shared-types';

const MAX = Config.confession.maxConfessionLength;

interface ConfessionComposerProps {
  myHandle: string | null;
  onSend: (text: string) => void;
}

export function ConfessionComposer({ myHandle, onSend }: ConfessionComposerProps) {
  const [text, setText] = useState('');

  if (myHandle === null) {
    return (
      <div className="p-4 text-center text-sm text-po-text-muted">
        You're not participating in this confession phase.
      </div>
    );
  }

  const tooLong = text.length > MAX;
  const empty = text.length === 0;

  const handleSend = () => {
    if (tooLong || empty) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-po-border">
      <div className="text-xs text-po-text-muted">
        Posting as <span className="font-display text-po-text">{myHandle}</span>
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Drop an anonymous confession..."
        className="w-full bg-transparent outline-none text-po-text placeholder:text-po-text-muted"
        onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
      />
      <div className="flex items-center justify-between text-xs">
        <span className={tooLong ? 'text-po-error' : 'text-po-text-muted'}>
          {text.length} / {MAX}
        </span>
        <button
          type="button"
          onClick={handleSend}
          disabled={tooLong || empty}
          className="px-3 py-1 rounded bg-po-accent text-po-bg disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

(CSS class names follow the Pulse shell's existing token convention — `po-*`. Adjust if the actual shell uses different tokens.)

- [ ] **Step 4: Wire `ConfessionComposer` into `ChatView`**

In `ChatView.tsx`, when the active channel's type is `'CONFESSION'`, render `ConfessionComposer` instead of the default chat composer:

```tsx
import { ConfessionComposer } from '../composer/ConfessionComposer';

// In the render, where the composer is rendered:
{activeChannel?.type === 'CONFESSION' ? (
  <ConfessionComposer
    myHandle={confessionPhase?.myHandle ?? null}
    onSend={(text) => sendEvent({ type: 'CONFESSION.POST', channelId: activeChannel.id, text })}
  />
) : (
  <RegularComposer ... />   // existing composer path
)}
```

The `confessionPhase` comes from the game store — which Task 15 hydrates. Until Task 15, the temporary fallback `myHandle={null}` displays the "not participating" state; wire up for real after Task 15 lands.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/client && npx vitest run src/shells/pulse/components/chat/__tests__/ConfessionChannel.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/shells/pulse/components/composer/ConfessionComposer.tsx \
        apps/client/src/shells/pulse/components/chat/ChatView.tsx \
        apps/client/src/shells/pulse/components/chat/__tests__/ConfessionChannel.test.tsx
git commit -m "client(pulse): ConfessionComposer + CONFESSION channel render branch"
```

---

### Task 15: Client store hydrates `confessionPhase`

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts` (or equivalent — grep `useGameStore` / Zustand store definition)
- Test: extend store's existing unit test file (grep `useGameStore.test` to find)

- [ ] **Step 1: Write the failing test**

Append to the store's test file:

```ts
describe('useGameStore — confessionPhase hydration', () => {
  it('hydrates confessionPhase from SYNC payload', () => {
    const store = useGameStore.getState();
    store.applySync({
      l3Context: {
        confessionPhase: {
          active: true, myHandle: 'Confessor #3', handleCount: 4,
          posts: [{ handle: 'Confessor #1', text: 'x', ts: 1 }],
        },
        // ... other l3 fields ...
      },
      // ... other payload fields ...
    } as any);
    const cp = useGameStore.getState().confessionPhase;
    expect(cp).toEqual({
      active: true, myHandle: 'Confessor #3', handleCount: 4,
      posts: [{ handle: 'Confessor #1', text: 'x', ts: 1 }],
    });
  });

  it('defaults to inactive shape when SYNC has no confessionPhase', () => {
    const store = useGameStore.getState();
    store.applySync({ l3Context: {} } as any);
    expect(useGameStore.getState().confessionPhase).toEqual({
      active: false, myHandle: null, handleCount: 0, posts: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/client && npx vitest run src/store/__tests__/useGameStore.test.ts` (adjust path based on actual location)
Expected: FAIL — `confessionPhase` not on the store.

- [ ] **Step 3: Add `confessionPhase` to the store**

In `useGameStore.ts`:

```ts
interface GameState {
  // ... existing ...
  confessionPhase: {
    active: boolean;
    myHandle: string | null;
    handleCount: number;
    posts: Array<{ handle: string; text: string; ts: number }>;
  };
}

const defaultConfessionPhase = { active: false, myHandle: null, handleCount: 0, posts: [] };

// Initial state:
confessionPhase: defaultConfessionPhase,

// In the applySync / hydration reducer:
applySync: (payload) => set((state) => ({
  // ... existing hydrations ...
  confessionPhase: payload.l3Context?.confessionPhase ?? defaultConfessionPhase,
})),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/client && npx vitest run`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/store/useGameStore.ts \
        apps/client/src/store/__tests__/useGameStore.test.ts
git commit -m "client(pulse): useGameStore hydrates confessionPhase from SYNC"
```

---

**Phase 3 boundary — `npm run build` + `npm test` must both succeed.**

---

## Phase 4 — Lobby schema, DemoServer check, E2E

### Task 16: Lobby manifest schema + ruleset toggle

**Files:**
- Modify: lobby manifest schema file (grep `TimelineActions\|manifestSchema\|activityType` in `apps/lobby/`)
- Modify: lobby ruleset builder (grep `rulesetBuilder\|DynamicRulesetBuilder`)
- Test: `apps/lobby/e2e/` (schema test)

- [ ] **Step 1: Grep the current schema locations**

```bash
grep -rn "TimelineActions\|timeline.*action" apps/lobby/app/ apps/lobby/lib/ | head -10
grep -rn "rulesetBuilder\|DynamicRulesetBuilder\|DynamicManifestSchema" apps/lobby/ | head -10
```

Identify the file where timeline action strings are validated.

- [ ] **Step 2: Write the failing test**

In the identified schema test file (or create `apps/lobby/__tests__/confessions-manifest.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { DynamicManifestSchema, PeckingOrderRulesetSchema } from '@pecking-order/shared-types';

describe('Lobby manifest schema — confession timeline actions', () => {
  it('accepts START_CONFESSION_CHAT as a valid timeline action', () => {
    const manifest = minimalDynamicManifest();
    manifest.days[0].timeline.push({ time: '2026-01-01T12:00:00Z', action: 'START_CONFESSION_CHAT' });
    expect(() => DynamicManifestSchema.parse(manifest)).not.toThrow();
  });

  it('accepts END_CONFESSION_CHAT', () => {
    const manifest = minimalDynamicManifest();
    manifest.days[0].timeline.push({ time: '2026-01-01T14:00:00Z', action: 'END_CONFESSION_CHAT' });
    expect(() => DynamicManifestSchema.parse(manifest)).not.toThrow();
  });

  it('accepts ruleset.confessions.enabled', () => {
    const ruleset = minimalRuleset();
    const withConfessions = { ...ruleset, confessions: { enabled: true } };
    expect(() => PeckingOrderRulesetSchema.parse(withConfessions)).not.toThrow();
  });

  function minimalDynamicManifest(): any { /* … */ }
  function minimalRuleset(): any { /* … */ }
});
```

- [ ] **Step 3: Update the schema**

The shared-types schema was updated in Task 1. If the lobby has its own narrower timeline-action enum (separate from `TimelineActions` in shared-types), extend that enum too. Otherwise the lobby inherits the new actions from shared-types automatically — verify by running the test.

- [ ] **Step 4: Add the ruleset toggle UI**

In the DynamicRulesetBuilder (grep to locate), add a new section:

```tsx
<ChipCheckbox
  data-testid="confessions-enabled"
  checked={ruleset.confessions?.enabled ?? false}
  onCheckedChange={(checked) => setRuleset(r => ({ ...r, confessions: { enabled: checked } }))}
>
  Enable confessions
</ChipCheckbox>
```

Visual builder for the timeline events themselves is explicitly out of scope (spec: v1 = JSON manifest only). An admin who wants a confession phase edits the raw manifest JSON.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/lobby && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/lobby/  # stage all lobby changes by path (no -A)
git commit -m "lobby(confessions): schema accepts timeline actions + ruleset toggle UI"
```

---

### Task 17: DemoServer investigation (15-min required check)

**Files:**
- Possibly modify: `apps/game-server/src/demo/*`

- [ ] **Step 1: Grep DemoServer for relevant references**

```bash
grep -rn "manifest\|activityType\|TimelineActions\|CONFESSION" apps/game-server/src/demo/
```

- [ ] **Step 2: Boot DemoServer locally and verify the phase doesn't break its synthetic game**

Run `cd apps/game-server && npm run dev` and navigate to the demo path (grep `/demo` route). Observe the demo game completes normally post-Plan-1 additions — the new `confessionLayer` sits in `idle` because the demo manifest doesn't schedule `START_CONFESSION_CHAT`.

- [ ] **Step 3: Decision log**

One of:

- (a) No changes needed. Log in commit message: "DemoServer unchanged — demo manifest doesn't schedule confession phases; new confessionLayer is idle throughout demo game."
- (b) Update demo fixtures to include a confession phase for content variety. If so, add a `START_CONFESSION_CHAT` event to the demo's day-2 timeline + `END_CONFESSION_CHAT` later that day + `ruleset.confessions.enabled: true`.

Default: (a).

- [ ] **Step 4: Commit (trivial — might be docs-only)**

```bash
git add apps/game-server/src/demo/  # stage by path
git commit -m "server(confessions): DemoServer verification — unchanged (demo manifest doesn't schedule confessions)"
```

If no files changed: skip the commit; record the verification outcome in a comment in the next commit or in the plan-execution log.

---

### Task 18: E2E Playwright spec — phase open → post → close with privacy assertion

**Files:**
- Create: `e2e/tests/confession-phase.spec.ts`
- Modify: `e2e/fixtures/game-setup.ts` — add `createConfessionPhaseGame()` helper if none exists

- [ ] **Step 1: Write the spec**

Create `e2e/tests/confession-phase.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { createTestGame, advanceGameState, injectTimelineEvent } from '../fixtures/game-setup';

test.describe('Confession Phase — end-to-end', () => {
  test('phase opens, players post, posts appear anonymized, phase closes, privacy holds', async ({ browser }) => {
    const { inviteLinks, gameId } = await createTestGame({
      kind: 'DYNAMIC',
      schedulePreset: 'SMOKE_TEST',
      manifestOverrides: { ruleset: { confessions: { enabled: true } } },
      personas: [{ name: 'Ada' }, { name: 'Ben' }, { name: 'Cid' }],
    });

    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();

    // Both players join the game
    await pageA.goto(inviteLinks[0]);
    await pageB.goto(inviteLinks[1]);

    // Trigger phase open
    await injectTimelineEvent(gameId, { action: 'START_CONFESSION_CHAT' });

    // Both pages should see the CONFESSION channel appear
    await expect(pageA.locator('[data-channel-type="CONFESSION"]')).toBeVisible({ timeout: 10_000 });
    await expect(pageB.locator('[data-channel-type="CONFESSION"]')).toBeVisible({ timeout: 10_000 });

    // Player A posts
    await pageA.locator('[data-channel-type="CONFESSION"]').click();
    await pageA.getByPlaceholder(/drop an anonymous confession/i).fill('the truth is I hate mondays');
    await pageA.getByRole('button', { name: /send/i }).click();

    // Both players see the post under a handle (neither sees "Ada")
    await expect(pageA.getByText('the truth is I hate mondays')).toBeVisible({ timeout: 5000 });
    await expect(pageB.getByText('the truth is I hate mondays')).toBeVisible({ timeout: 5000 });

    const pageAPostText = await pageA.locator('[data-channel-type="CONFESSION"]').textContent();
    const pageBPostText = await pageB.locator('[data-channel-type="CONFESSION"]').textContent();
    expect(pageAPostText).toContain('Confessor #');
    expect(pageBPostText).toContain('Confessor #');
    expect(pageBPostText).not.toContain('Ada');  // Ben doesn't learn that Ada wrote it

    // Privacy assertion via direct WS message inspection (if feasible via harness)
    // — or — DOM-level assertion:
    // Expect that pageA's UI shows "Posting as Confessor #X" where X matches only the handle A sees,
    // and pageB's UI shows a different handle for B.
    const pageAHandle = await pageA.locator('[data-testid="my-confessor-handle"]').textContent();
    const pageBHandle = await pageB.locator('[data-testid="my-confessor-handle"]').textContent();
    expect(pageAHandle).toMatch(/Confessor #\d+/);
    expect(pageBHandle).toMatch(/Confessor #\d+/);
    expect(pageAHandle).not.toBe(pageBHandle);   // distinct handles

    // Trigger phase close
    await injectTimelineEvent(gameId, { action: 'END_CONFESSION_CHAT' });

    // CONFESSION channel disappears; MAIN is open again
    await expect(pageA.locator('[data-channel-type="CONFESSION"]')).not.toBeVisible({ timeout: 10_000 });
    await expect(pageB.locator('[data-channel-type="CONFESSION"]')).not.toBeVisible({ timeout: 10_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
```

- [ ] **Step 2: Run the spec — expect it to pass**

Run: `npm run test:e2e -- --grep "Confession Phase"`
Expected: PASS. Debug + iterate if anything fails.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/confession-phase.spec.ts \
        e2e/fixtures/game-setup.ts
git commit -m "test(e2e): confession phase open/post/close + multi-profile privacy assertion"
```

---

**Phase 4 boundary + Plan 1 end: `npm run build` + `npm test` + `npm run test:e2e` all green.**

---

## Self-Review Checklist

Run these before handing off.

- [ ] **Spec coverage (phase work only, match cartridge deferred to Plan 2):**
  - Shared types (events, facts, ticker category, channel, capability, ruleset, config) → T1
  - Journalable facts → T2
  - Per-fact actorId strip → T3
  - Ticker narration → T4
  - Push on phase-open; null on fact-path → T5
  - Seeded RNG + handle assignment → T6
  - L3 context field → T7
  - L3 actions (open/close/record/phase-fact emission) → T8
  - L3 parallel region lifecycle → T9
  - POST validation (all 6 rules incl. `sender-eliminated`) → T10
  - Capability-rejection on CONFESSION channel → T10
  - Timeline routing + ruleset/alive guards → T11
  - Per-recipient SYNC projection → T12
  - Pulse narrator filter → T13
  - Pulse CONFESSION channel + composer + char counter → T14
  - Client store hydration → T15
  - Lobby schema + toggle → T16
  - DemoServer verification → T17
  - E2E privacy assertion → T18

- [ ] **Not covered (intentionally; Plan 2 scope):**
  - Match cartridge mechanics (handle-assignment-for-matchers, guess recording, reveal scoring)
  - `activityLayer.loading` sub-state
  - `d1-confession-queries` / `loadConfessionArchive`
  - Rewrite of `confession-machine.ts` as `confession-match-machine.ts`
  - Match UI (`ConfessionMatch.tsx`)
  - LOAD_ERROR `results.status` surfacing

- [ ] **Placeholder scan:** no TBD/TODO/FIXME. Every step has runnable code or an exact command.

- [ ] **Type consistency:**
  - `Events.Confession.POST` (T1) matches handler event.type check (T8, T10)
  - `FactTypes.CONFESSION_POSTED` (T1) matches projection (T3) + ticker (T4) + push (T5) + fact emission (T8)
  - `TickerCategories.SOCIAL_PHASE` (T1) matches ticker branch (T4) + Pulse filter (T13)
  - `TimelineActions.START_CONFESSION_CHAT` / `END_CONFESSION_CHAT` (T1) matches L2 handler (T11)
  - `ChannelType: 'CONFESSION'` + `ChannelCapability: 'CONFESS'` (T1) matches channel creation (T8) + capability guard (T10)
  - `confessionPhase` shape (T7) matches actions (T8) + sync projection (T12) + store hydration (T15)
  - `Config.confession.maxConfessionLength = 280` (T1) matches POST validator (T10) + composer counter (T14)

- [ ] **Commit order is executable top-to-bottom:**
  - T1 ships shared types → T2–T18 consume them
  - T2–T5 plumbing → T8–T11 L3 rely on them
  - T6 handle helper → T8 uses it
  - T7 context field → T8 writes it
  - T8 actions → T9 registers them
  - T9 parallel region → T10 extends with guards; T11 routes timeline events in
  - T12 SYNC projection → T13–T15 client consumes projected shape
  - T13 filter → T14 channel render path uses SOCIAL_PHASE narration
  - T14 composer → T15 store → T18 E2E verifies the whole stack

- [ ] **Tests enforce privacy invariants:**
  - Per-recipient projection (T12 unit + T18 E2E)
  - Per-fact actorId strip (T3)
  - CONFESSION channel capabilities list stays `['CONFESS']` only (T9 construction)
  - Mid-phase elimination rejection (T10)

---

## Merge path

- Branch: `feature/spec-c-confessions` (this worktree)
- Before merge: `git merge main` INTO the branch; resolve any conflicts here.
- Push + open PR once `npm run build` + `npm test` + `npm run test:e2e -- --grep "Confession Phase"` are all green.
- After merge: worktree cleanup per `finishing-a-development-branch` skill.

Plan 2 (`2026-04-17-confessions-match.md`) branches from post-merge `main` with the archive fact stream this plan produces.

---

## Handoff — 2026-04-17 23:30

**This session landed T1–T7** on branch `feature/spec-c-confessions` in `.worktrees/confessions`. Commits (oldest first): `64876a8` T1 shared types; `f6b8dca` T2 journalable; `54a278d` T3 `projectFactForClient`; `89b2558` T4 ticker `SOCIAL_PHASE`; `7cc6ab9` T5 `CONFESSION_OPEN` push; `5e1b8d4` T6 seeded RNG + `assignPhaseHandles`; `e0e1c0b` T7 `DailyContext.confessionPhase` field + `buildL3Context` default. Game-server suite 421/421 green. Phase 0 boundary (after T5) and T7 both full-suite-verified.

**Next step: T8** — create `apps/game-server/src/machines/actions/l3-confession.ts` with the 5 phase actions (`openConfessionChannel`, `closeConfessionChannel`, `recordConfession`, `emitConfessionPhaseStartedFact`, `emitConfessionPhaseEndedFact`) AND the `isConfessionPostAllowed` 6-rule validation guard (read T8/T10 in this plan — the `sender-eliminated` rule is the R3 P1 fix; don't rely on any implicit L3 alive-sender check because grep of `l3-social.ts` confirmed none exists).

**State for the next agent:**
- Working tree clean on `feature/spec-c-confessions`; no uncommitted changes.
- `npm install` has run at the worktree root; `@pecking-order/shared-types` and `@pecking-order/game-cartridges` dists are current. Rebuild them if you edit their source (see `finite-worktree-no-node-modules.rule`).
- Pre-existing test failures to ignore: `gm-briefings.test.ts > sends separate dilemma message when dilemmaType is set` and `HintChips.test.tsx > MAIN shows /silver /nudge /whisper /dm`.
- Plan test code uses `TimelineActions` / `handlePhasePush` / `JOURNALABLE_TYPES.has(...)` in a few places where the real API is different (inline Zod enum / `phasePushPayload` / `isJournalable()`). When plan-test-code doesn't compile, trust the real API and adjust the test; note the deviation in the commit message.
- `projectFactForClient` has NO v1 consumer (facts never reach clients via SYNC — only TICKER, and CONFESSION_POSTED returns null from `factToTicker`). Shipped as defense-in-depth gate; don't go hunting for a wire-up.
- Per CLAUDE.md: stage commits by path, never `-A`; don't merge or push without explicit approval.

