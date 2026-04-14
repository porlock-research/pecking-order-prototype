# Pulse Phase 4 — Catch-up & Deep Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the ambient-unread vocabulary and push-driven deep-link intents described in `docs/superpowers/specs/2026-04-14-pulse-phase4-catchup-design.md`. After this plan lands, a returning Pulse player sees unread signals on every relevant surface, and push notifications route to the specific target they describe.

**Architecture:** Three server preconditions (stable `cartridgeId`, `updatedAt`, roster `eliminatedOnDay`) land first in shared-types and game-server. Client store gains three seen-state maps + pendingIntent plus selectors. Push triggers thread a `DeepLinkIntent` through existing send helpers. Service worker parses intents and routes them to the shell via postMessage / `?intent=` fallback. Per-surface renderers (pulse pill, cast chip, chat divider, panel button, reveals) consume the selectors and participate in unified routing.

**Tech Stack:** TypeScript, XState v5, Cloudflare Workers (game-server), Zustand (client store), React 19 + RTL + jsdom (client tests), Vitest (unit tests, both sides), Workbox service worker (apps/client/src/sw.ts).

**Branch:** `feature/pulse-phase4-catchup` (already created; spec committed).

**Critical pattern awareness — Zustand selectors under React 19.** Commit `24b5cf6` landed a `memoSelector(inputs, compute)` helper in `apps/client/src/store/useGameStore.ts` and a guardrail at `.claude/guardrails/finite-zustand-selector-fresh-objects.rule`. **Any selector that returns a fresh object or array literal MUST be wrapped with `memoSelector` or the Pulse shell crashes with "Maximum update depth exceeded" under React 19's `useSyncExternalStore`.** Selectors returning primitives (number/boolean/string/null) or existing state references are safe without wrapping. Phase 4 selectors are added to `useGameStore.ts` directly (matches the `selectStandings`/`selectCastStripEntries` convention), not to a separate file — this keeps `memoSelector` in scope without widening its export surface.

---

## Phase 0 — Server Preconditions

These land first. Every client task depends on data shape added here.

### Task 1: Shared types — `DeepLinkIntent` and `CartridgeKind`

**Files:**
- Create: `packages/shared-types/src/push.ts`
- Modify: `packages/shared-types/src/index.ts` (re-export)
- Test: `packages/shared-types/src/__tests__/push.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared-types/src/__tests__/push.test.ts
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { DeepLinkIntent, CartridgeKind } from '../push';

describe('DeepLinkIntent', () => {
  it('CartridgeKind covers the four lowercase values', () => {
    expectTypeOf<CartridgeKind>().toEqualTypeOf<'voting' | 'game' | 'prompt' | 'dilemma'>();
  });

  it('accepts main intent', () => {
    const intent: DeepLinkIntent = { kind: 'main' };
    expect(intent.kind).toBe('main');
  });

  it('accepts dm intent with channelId', () => {
    const intent: DeepLinkIntent = { kind: 'dm', channelId: 'DM-p1-p3' };
    expect(intent.channelId).toBe('DM-p1-p3');
  });

  it('accepts cartridge_active intent with cartridgeKind', () => {
    const intent: DeepLinkIntent = {
      kind: 'cartridge_active',
      cartridgeId: 'voting-3-MAJORITY',
      cartridgeKind: 'voting',
    };
    expect(intent.cartridgeKind).toBe('voting');
  });

  it('accepts cartridge_result intent with cartridgeId', () => {
    const intent: DeepLinkIntent = { kind: 'cartridge_result', cartridgeId: 'game-3-TRIVIA' };
    expect(intent.cartridgeId).toBe('game-3-TRIVIA');
  });

  it('accepts elimination_reveal with dayIndex and winner_reveal scalar', () => {
    const elim: DeepLinkIntent = { kind: 'elimination_reveal', dayIndex: 3 };
    const winner: DeepLinkIntent = { kind: 'winner_reveal' };
    expect(elim.dayIndex).toBe(3);
    expect(winner.kind).toBe('winner_reveal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/shared-types && npx vitest run src/__tests__/push.test.ts`
Expected: FAIL with "Cannot find module '../push'" or similar.

- [ ] **Step 3: Write the types**

```typescript
// packages/shared-types/src/push.ts
/**
 * Deep-link intent shapes carried in push notification `data.intent`.
 * See: docs/superpowers/specs/2026-04-14-pulse-phase4-catchup-design.md §2
 */

export type CartridgeKind = 'voting' | 'game' | 'prompt' | 'dilemma';

export type DeepLinkIntent =
  | { kind: 'main' }
  | { kind: 'dm'; channelId: string }
  | { kind: 'dm_invite'; senderId: string }
  | { kind: 'cartridge_active'; cartridgeId: string; cartridgeKind: CartridgeKind }
  | { kind: 'cartridge_result'; cartridgeId: string }
  | { kind: 'elimination_reveal'; dayIndex: number }
  | { kind: 'winner_reveal' };
```

Then in `packages/shared-types/src/index.ts`, append:

```typescript
export type { CartridgeKind, DeepLinkIntent } from './push';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/shared-types && npx vitest run src/__tests__/push.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/push.ts packages/shared-types/src/index.ts packages/shared-types/src/__tests__/push.test.ts
git commit -m "feat(shared-types): add DeepLinkIntent and CartridgeKind types"
```

---

### Task 2: Server — `cartridgeUpdatedAt` in L3 + `cartridgeId`/`updatedAt` in SYNC

**Context:** L3 (`l3-session.ts`) invokes cartridge children in four named slots (`activeVotingCartridge`, `activeGameCartridge`, `activePromptCartridge`, `activeDilemmaCartridge`). We need to (a) record a timestamp whenever L3 forwards an event to a cartridge child, (b) inject `cartridgeId` and `updatedAt` into the SYNC projection.

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts` (add context field + action)
- Modify: `apps/game-server/src/sync.ts` (inject into SYNC)
- Test: `apps/game-server/src/__tests__/sync-cartridge-id.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/game-server/src/__tests__/sync-cartridge-id.test.ts
import { describe, it, expect } from 'vitest';
import { buildSyncPayload } from '../sync';

function makeFakeL2Snapshot(opts: { dayIndex: number; l3Context: any }) {
  return {
    value: { activeSession: {} },
    context: {
      gameId: 'test-game',
      dayIndex: opts.dayIndex,
      roster: { p1: { personaName: 'Alice', status: 'ALIVE' } },
      manifest: null,
      completedPhases: [],
      winner: null,
      goldPool: 0,
      goldPayouts: [],
      gameHistory: [],
    },
    children: {},
  };
}

describe('buildSyncPayload — cartridgeId + updatedAt', () => {
  it('injects cartridgeId and updatedAt on active voting cartridge', () => {
    const l3Context = {
      cartridgeUpdatedAt: { activeVotingCartridge: 1700000000000 },
      channels: {},
      chatLog: [],
    };
    const cartridges = {
      activeVotingCartridge: { mechanism: 'MAJORITY', votes: {}, eligibleVoters: ['p1'] },
      rawGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
    };
    const snapshot = makeFakeL2Snapshot({ dayIndex: 3, l3Context });

    const sync = buildSyncPayload(
      { snapshot, l3Context, chatLog: [], cartridges },
      'p1',
    );

    expect(sync.context.activeVotingCartridge.cartridgeId).toBe('voting-3-MAJORITY');
    expect(sync.context.activeVotingCartridge.updatedAt).toBe(1700000000000);
  });

  it('uses UNKNOWN typeKey when mechanism absent', () => {
    const cartridges = {
      activeVotingCartridge: { votes: {} },
      rawGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
    };
    const sync = buildSyncPayload(
      {
        snapshot: makeFakeL2Snapshot({ dayIndex: 1, l3Context: {} }),
        l3Context: { cartridgeUpdatedAt: {} },
        chatLog: [],
        cartridges,
      },
      'p1',
    );
    expect(sync.context.activeVotingCartridge.cartridgeId).toBe('voting-1-UNKNOWN');
  });

  it('omits cartridge fields when cartridge is null', () => {
    const cartridges = {
      activeVotingCartridge: null,
      rawGameCartridge: null,
      activePromptCartridge: null,
      activeDilemmaCartridge: null,
    };
    const sync = buildSyncPayload(
      {
        snapshot: makeFakeL2Snapshot({ dayIndex: 1, l3Context: {} }),
        l3Context: {},
        chatLog: [],
        cartridges,
      },
      'p1',
    );
    expect(sync.context.activeVotingCartridge).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/__tests__/sync-cartridge-id.test.ts`
Expected: FAIL — `cartridgeId` and `updatedAt` are undefined on projection.

- [ ] **Step 3: Add typeKey resolver and project cartridgeId/updatedAt in sync.ts**

In `apps/game-server/src/sync.ts`, above `buildSyncPayload`, add:

```typescript
function typeKeyFor(kind: 'voting' | 'game' | 'prompt' | 'dilemma', cartridge: any): string {
  if (!cartridge) return 'UNKNOWN';
  switch (kind) {
    case 'voting': return cartridge.mechanism || 'UNKNOWN';
    case 'game': return cartridge.gameType || 'UNKNOWN';
    case 'prompt': return cartridge.promptType || 'UNKNOWN';
    case 'dilemma': return cartridge.dilemmaType || 'UNKNOWN';
  }
}

function decorateCartridge(
  cartridge: any,
  kind: 'voting' | 'game' | 'prompt' | 'dilemma',
  dayIndex: number,
  updatedAt: number | undefined,
): any {
  if (!cartridge) return null;
  return {
    ...cartridge,
    cartridgeId: `${kind}-${dayIndex}-${typeKeyFor(kind, cartridge)}`,
    updatedAt: updatedAt ?? Date.now(),
  };
}
```

Inside `buildSyncPayload`, after `const activeGameCartridge = projectGameCartridge(...)`, replace the four cartridge assignments with:

```typescript
  const dayIdx = snapshot.context.dayIndex ?? 0;
  const updatedAtMap = l3Context.cartridgeUpdatedAt || {};
  const decoratedVoting = decorateCartridge(cartridges.activeVotingCartridge, 'voting', dayIdx, updatedAtMap.activeVotingCartridge);
  const decoratedGame = decorateCartridge(activeGameCartridge, 'game', dayIdx, updatedAtMap.activeGameCartridge);
  const decoratedPrompt = decorateCartridge(projectPromptCartridge(cartridges.activePromptCartridge), 'prompt', dayIdx, updatedAtMap.activePromptCartridge);
  const decoratedDilemma = decorateCartridge(projectDilemmaCartridge(cartridges.activeDilemmaCartridge), 'dilemma', dayIdx, updatedAtMap.activeDilemmaCartridge);
```

Then in the return's `context:` block, replace the four cartridge lines with:

```typescript
      activeVotingCartridge: decoratedVoting,
      activeGameCartridge: decoratedGame,
      activePromptCartridge: decoratedPrompt,
      activeDilemmaCartridge: decoratedDilemma,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/game-server && npx vitest run src/__tests__/sync-cartridge-id.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `cartridgeUpdatedAt` to L3 context**

In `apps/game-server/src/machines/l3-session.ts`, add `cartridgeUpdatedAt: Record<string, number>` to the context type. Initialize to `{}`. In every action that sends an event via `sendTo('activeVotingCartridge', ...)`, `sendTo('activeGameCartridge', ...)`, etc., add an `assign` to bump the corresponding key to `Date.now()`.

Find the L3 event forwarders (grep for `sendTo('active`). For each forwarder, convert `sendTo(...)` to `enqueueActions(enqueue => { enqueue.sendTo(...); enqueue.assign({ cartridgeUpdatedAt: ({context}) => ({ ...context.cartridgeUpdatedAt, [childKey]: Date.now() }) }); })` or equivalent, where `childKey` is the static child id string.

**Sanity test:**

```typescript
// apps/game-server/src/__tests__/l3-cartridge-updated-at.test.ts
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { l3SessionMachine } from '../machines/l3-session';

describe('L3 cartridgeUpdatedAt', () => {
  it('initializes to empty object', () => {
    const actor = createActor(l3SessionMachine, { /* minimal input */ });
    actor.start();
    expect(actor.getSnapshot().context.cartridgeUpdatedAt).toEqual({});
    actor.stop();
  });
  // A proper integration test would drive L3 through START_CARTRIDGE and assert the map updates.
  // Mark as skipped with a TODO comment if the test harness for L3 needs input shape work.
});
```

If a full integration test is impractical in this step, leave the initialization check and file a follow-up test task for a future iteration. Document in a code comment.

- [ ] **Step 6: Run all game-server tests**

Run: `cd apps/game-server && npm run test`
Expected: all prior tests still PASS; new tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/game-server/src/sync.ts apps/game-server/src/machines/l3-session.ts apps/game-server/src/__tests__/sync-cartridge-id.test.ts apps/game-server/src/__tests__/l3-cartridge-updated-at.test.ts
git commit -m "feat(server): inject cartridgeId and updatedAt on active cartridge SYNC projections

Adds cartridgeUpdatedAt map in L3 context, bumped whenever L3 forwards an event
to a cartridge child. sync.ts decorates each of the four active-cartridge slots
with a stable cartridgeId (matches completed-cartridge key scheme) and the
current updatedAt timestamp."
```

---

### Task 3: Server — verify/add `eliminatedOnDay` on roster

**Context:** Reveal replay keys `revealsSeen.elimination[dayIndex]`. Client needs `roster[id].eliminatedOnDay` to key correctly. Verify whether it's already projected; add if missing.

**Files:**
- Read: `apps/game-server/src/machines/l2-orchestrator.ts` (grep for `eliminatedOnDay`)
- Read: `packages/shared-types/src/*` (grep for RosterEntry / eliminatedOnDay)
- Modify (if missing): wherever the roster is mutated on elimination
- Test: `apps/game-server/src/__tests__/roster-eliminated-on-day.test.ts`

- [ ] **Step 1: Verify whether `eliminatedOnDay` already exists**

Run:
```bash
grep -rn "eliminatedOnDay" apps/game-server/src packages/shared-types/src
```

If present and populated on elimination: skip to Step 5.
If absent: continue.

- [ ] **Step 2: Write the failing test**

```typescript
// apps/game-server/src/__tests__/roster-eliminated-on-day.test.ts
import { describe, it, expect } from 'vitest';
// Import the action that mutates roster on elimination — path discovered in Step 1
import { eliminatePlayerAction } from '../machines/actions/l2-eliminate'; // adjust path

describe('eliminatePlayerAction', () => {
  it('sets eliminatedOnDay on the target roster entry', () => {
    const context = {
      dayIndex: 3,
      roster: {
        p1: { personaName: 'Alice', status: 'ALIVE' },
        p2: { personaName: 'Bob', status: 'ALIVE' },
      },
    };
    const next = eliminatePlayerAction({ context, event: { targetId: 'p2' } } as any);
    expect(next.roster.p2.status).toBe('ELIMINATED');
    expect(next.roster.p2.eliminatedOnDay).toBe(3);
    expect(next.roster.p1.eliminatedOnDay).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/game-server && npx vitest run src/__tests__/roster-eliminated-on-day.test.ts`
Expected: FAIL — `eliminatedOnDay` not assigned.

- [ ] **Step 4: Add `eliminatedOnDay: context.dayIndex` to the elimination action**

Edit the discovered action so that when it sets `status: 'ELIMINATED'`, it also sets `eliminatedOnDay: context.dayIndex`. Keep the exact pattern the action already uses (`assign({ roster: ... })`).

Also update the `RosterEntry` type in `packages/shared-types` if present to include `eliminatedOnDay?: number`.

- [ ] **Step 5: Run test + all game-server tests**

Run: `cd apps/game-server && npm run test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/machines/actions/l2-eliminate.ts apps/game-server/src/__tests__/roster-eliminated-on-day.test.ts packages/shared-types/src/index.ts
git commit -m "feat(server): record eliminatedOnDay on roster at elimination time"
```

If Step 1 verified it already exists, commit is:

```bash
# No changes. Skip this task entirely.
```

---

### Task 4: Server — verify ticker retention, convert to time-based if needed

**Context:** Per spec §0.3, verify whether the 20-count server ticker cap at `apps/game-server/src/ticker.ts:255` is sufficient for 4-hour catch-up scenarios. Convert to time-based only if verification shows it's the bottleneck.

**Files:**
- Verify: `apps/game-server/src/ticker.ts` (existing `.slice(-20)`)
- Modify (conditional): `apps/game-server/src/ticker.ts`
- Test (conditional): `apps/game-server/src/__tests__/ticker-retention.test.ts`

- [ ] **Step 1: Write a verification test that fails under realistic load**

```typescript
// apps/game-server/src/__tests__/ticker-retention-sizing.test.ts
import { describe, it, expect } from 'vitest';
import { broadcastTicker } from '../ticker';

describe('ticker retention sizing', () => {
  it('keeps ≥30 messages in a simulated 10-player 60-min busy scenario', () => {
    // 10 players × ~3 events/min × 60 min = ~1800 events over an hour.
    // We simulate 30 events — a much lower bar — and assert the buffer keeps them.
    let history: any[] = [];
    for (let i = 0; i < 30; i++) {
      history = broadcastTicker(
        { type: 'SILVER', timestamp: Date.now() - (30 - i) * 60_000, payload: {} as any },
        history,
        () => [] as any,
      );
    }
    expect(history.length).toBeGreaterThanOrEqual(30);
  });
});
```

- [ ] **Step 2: Run — expect FAIL under the current 20-count cap**

Run: `cd apps/game-server && npx vitest run src/__tests__/ticker-retention-sizing.test.ts`
Expected: FAIL — `history.length` is 20, not ≥30.

- [ ] **Step 3: Convert to time-based retention with safety cap**

Dimension the safety cap first. Realistic upper bound: 10 players × 3 events/min × 60 min = 1800. Set safety cap to **2000** (headroom above worst case). Document this in the code comment.

Edit `apps/game-server/src/ticker.ts:250-261`:

```typescript
/** Time-based ticker retention: last 60 minutes.
 * Safety cap at 2000 entries prevents unbounded memory in pathological cases
 * (10 players × ~3 events/min × 60 min ≈ 1800; headroom above that). */
const TICKER_RETENTION_MS = 60 * 60 * 1000;
const TICKER_SAFETY_CAP = 2000;

export function broadcastTicker(
  msg: TickerMessage,
  tickerHistory: TickerMessage[],
  getConnections: () => Iterable<Connection>,
): TickerMessage[] {
  const cutoff = Date.now() - TICKER_RETENTION_MS;
  const timestamped = [...tickerHistory, msg];
  const withinWindow = timestamped.filter(m => {
    const ts = typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp as any).getTime();
    return ts >= cutoff;
  });
  // Safety cap: if within-window exceeds cap, keep the most recent
  const updated = withinWindow.length > TICKER_SAFETY_CAP
    ? withinWindow.slice(-TICKER_SAFETY_CAP)
    : withinWindow;

  const payload = JSON.stringify({ type: Events.Ticker.UPDATE, message: msg });
  for (const ws of getConnections()) {
    ws.send(payload);
  }
  return updated;
}
```

- [ ] **Step 4: Run test to verify it passes + drops-entries-older-than-60m test**

Add:

```typescript
it('drops entries older than 60 minutes', () => {
  const oldMsg = { type: 'SILVER', timestamp: Date.now() - 61 * 60_000, payload: {} as any };
  const newMsg = { type: 'SILVER', timestamp: Date.now(), payload: {} as any };
  const result = broadcastTicker(newMsg, [oldMsg], () => [] as any);
  expect(result).not.toContain(oldMsg);
  expect(result).toContain(newMsg);
});

it('enforces safety cap of 2000', () => {
  const base = Date.now();
  const flood: any[] = Array.from({ length: 2500 }, (_, i) => ({
    type: 'SILVER',
    timestamp: base - i,
    payload: {} as any,
  }));
  const result = broadcastTicker({ type: 'SILVER', timestamp: base + 1, payload: {} as any }, flood, () => [] as any);
  expect(result.length).toBeLessThanOrEqual(2000);
});
```

Run: `cd apps/game-server && npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/ticker.ts apps/game-server/src/__tests__/ticker-retention-sizing.test.ts
git commit -m "feat(server): convert ticker retention to 60-min time-based with 2000-entry safety cap

Replaces slice(-20) with time-based filtering so 4-hour-gap returning players
receive meaningful narrator/silver backfill. Safety cap dimensioned at ~1.1x
realistic worst case (10 players × 3 events/min × 60 min)."
```

---

## Phase 1 — Client Store Foundation

### Task 5: Client store — new fields + hydration

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts` (add fields to interface, initialize, hydrate in SYNC reducer)
- Test: `apps/client/src/store/__tests__/phase4-state.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/client/src/store/__tests__/phase4-state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('useGameStore — Phase 4 state fields', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      lastSeenCartridge: {},
      lastSeenSilverFrom: {},
      revealsSeen: { elimination: {}, winner: false },
      pendingIntent: null,
      pendingIntentAttempts: 0,
      pendingIntentFirstReceivedAt: null,
    });
  });

  it('initializes empty maps and null intent', () => {
    const s = useGameStore.getState();
    expect(s.lastSeenCartridge).toEqual({});
    expect(s.lastSeenSilverFrom).toEqual({});
    expect(s.revealsSeen).toEqual({ elimination: {}, winner: false });
    expect(s.pendingIntent).toBeNull();
  });

  it('hydrates lastSeenCartridge from localStorage on game scope', () => {
    localStorage.setItem('po-lastSeenCartridge-game1-p1', JSON.stringify({ 'voting-3-MAJORITY': 1700000000000 }));
    // Simulate SYNC for (gameId, playerId) = (game1, p1)
    useGameStore.setState({ gameId: 'game1', playerId: 'p1' });
    useGameStore.getState().hydratePhase4FromStorage();
    expect(useGameStore.getState().lastSeenCartridge['voting-3-MAJORITY']).toBe(1700000000000);
  });
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `cd apps/client && npx vitest run src/store/__tests__/phase4-state.test.ts`
Expected: FAIL (field does not exist or hydrate action missing).

- [ ] **Step 3: Add fields + hydrate action to the store**

In `apps/client/src/store/useGameStore.ts`, extend the `GameStore` interface:

```typescript
import type { DeepLinkIntent } from '@pecking-order/shared-types';

// Add to interface:
  lastSeenCartridge: Record<string, number>;
  lastSeenSilverFrom: Record<string, number>;
  revealsSeen: { elimination: Record<number, boolean>; winner: boolean };
  pendingIntent: DeepLinkIntent | null;
  pendingIntentAttempts: number;
  pendingIntentFirstReceivedAt: number | null;
  hydratePhase4FromStorage: () => void;
```

Initial state (in `create`):

```typescript
  lastSeenCartridge: {},
  lastSeenSilverFrom: {},
  revealsSeen: { elimination: {}, winner: false },
  pendingIntent: null,
  pendingIntentAttempts: 0,
  pendingIntentFirstReceivedAt: null,
```

Action:

```typescript
  hydratePhase4FromStorage: () => {
    const { gameId, playerId } = get();
    if (!gameId || !playerId) return;
    const scope = `${gameId}-${playerId}`;
    const read = <T>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(`po-${key}-${scope}`);
        return raw ? JSON.parse(raw) as T : fallback;
      } catch { return fallback; }
    };
    set({
      lastSeenCartridge: read('lastSeenCartridge', {}),
      lastSeenSilverFrom: read('lastSeenSilverFrom', {}),
      revealsSeen: read('revealsSeen', { elimination: {}, winner: false }),
    });
  },
```

Call `hydratePhase4FromStorage()` inside the SYNC reducer immediately after `gameId` is set, alongside the existing `welcomeSeen` hydration.

- [ ] **Step 4: Run test — PASS**

Run: `cd apps/client && npx vitest run src/store/__tests__/phase4-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/store/useGameStore.ts apps/client/src/store/__tests__/phase4-state.test.ts
git commit -m "feat(client): add Phase 4 seen-state fields to game store with localStorage hydration"
```

---

### Task 6: Client store — `mark*` actions with persistence

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`
- Test: `apps/client/src/store/__tests__/phase4-actions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/client/src/store/__tests__/phase4-actions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('Phase 4 mark actions', () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({
      gameId: 'g1',
      playerId: 'p1',
      lastSeenCartridge: {},
      lastSeenSilverFrom: {},
      revealsSeen: { elimination: {}, winner: false },
    });
  });

  it('markCartridgeSeen updates map and persists to localStorage', () => {
    vi.setSystemTime(new Date(1700000000000));
    useGameStore.getState().markCartridgeSeen('voting-3-MAJORITY');
    const { lastSeenCartridge } = useGameStore.getState();
    expect(lastSeenCartridge['voting-3-MAJORITY']).toBe(1700000000000);
    const stored = JSON.parse(localStorage.getItem('po-lastSeenCartridge-g1-p1')!);
    expect(stored['voting-3-MAJORITY']).toBe(1700000000000);
  });

  it('markSilverSeen updates map and persists', () => {
    vi.setSystemTime(new Date(1700000000000));
    useGameStore.getState().markSilverSeen('p3');
    expect(useGameStore.getState().lastSeenSilverFrom['p3']).toBe(1700000000000);
  });

  it('markRevealSeen(elimination, 3) persists dayIndex entry', () => {
    useGameStore.getState().markRevealSeen('elimination', 3);
    expect(useGameStore.getState().revealsSeen.elimination[3]).toBe(true);
  });

  it('markRevealSeen(winner) sets scalar', () => {
    useGameStore.getState().markRevealSeen('winner');
    expect(useGameStore.getState().revealsSeen.winner).toBe(true);
  });

  it('setPendingIntent records firstReceivedAt only on first set', () => {
    vi.setSystemTime(new Date(1000));
    useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'ch-1' });
    expect(useGameStore.getState().pendingIntentFirstReceivedAt).toBe(1000);
    vi.setSystemTime(new Date(2000));
    useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'ch-1' });
    expect(useGameStore.getState().pendingIntentFirstReceivedAt).toBe(1000);
  });

  it('setPendingIntent(null) resets attempts and first-received', () => {
    useGameStore.getState().setPendingIntent({ kind: 'main' });
    useGameStore.getState().incrementIntentAttempts();
    useGameStore.getState().setPendingIntent(null);
    const s = useGameStore.getState();
    expect(s.pendingIntentAttempts).toBe(0);
    expect(s.pendingIntentFirstReceivedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — FAIL**

Run: `cd apps/client && npx vitest run src/store/__tests__/phase4-actions.test.ts`
Expected: FAIL — actions missing.

- [ ] **Step 3: Add actions**

In `apps/client/src/store/useGameStore.ts`, add to the interface:

```typescript
  markCartridgeSeen: (cartridgeId: string) => void;
  markSilverSeen: (senderId: string) => void;
  markRevealSeen: (kind: 'elimination' | 'winner', dayIndex?: number) => void;
  setPendingIntent: (intent: DeepLinkIntent | null) => void;
  incrementIntentAttempts: () => void;
```

Implementations (inside the `create` body):

```typescript
  markCartridgeSeen: (cartridgeId) => set((state) => {
    const next = { ...state.lastSeenCartridge, [cartridgeId]: Date.now() };
    if (state.gameId && state.playerId) {
      localStorage.setItem(`po-lastSeenCartridge-${state.gameId}-${state.playerId}`, JSON.stringify(next));
    }
    return { lastSeenCartridge: next };
  }),

  markSilverSeen: (senderId) => set((state) => {
    const next = { ...state.lastSeenSilverFrom, [senderId]: Date.now() };
    if (state.gameId && state.playerId) {
      localStorage.setItem(`po-lastSeenSilverFrom-${state.gameId}-${state.playerId}`, JSON.stringify(next));
    }
    return { lastSeenSilverFrom: next };
  }),

  markRevealSeen: (kind, dayIndex) => set((state) => {
    const next = kind === 'elimination'
      ? { ...state.revealsSeen, elimination: { ...state.revealsSeen.elimination, [dayIndex!]: true } }
      : { ...state.revealsSeen, winner: true };
    if (state.gameId && state.playerId) {
      localStorage.setItem(`po-revealsSeen-${state.gameId}-${state.playerId}`, JSON.stringify(next));
    }
    return { revealsSeen: next };
  }),

  setPendingIntent: (intent) => set((state) => {
    if (intent === null) {
      return { pendingIntent: null, pendingIntentAttempts: 0, pendingIntentFirstReceivedAt: null };
    }
    return {
      pendingIntent: intent,
      pendingIntentFirstReceivedAt: state.pendingIntentFirstReceivedAt ?? Date.now(),
    };
  }),

  incrementIntentAttempts: () => set((state) => ({
    pendingIntentAttempts: state.pendingIntentAttempts + 1,
  })),
```

- [ ] **Step 4: Run test — PASS**

Run: `cd apps/client && npx vitest run src/store/__tests__/phase4-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/store/useGameStore.ts apps/client/src/store/__tests__/phase4-actions.test.ts
git commit -m "feat(client): add Phase 4 mark* actions with localStorage persistence"
```

---

### Task 7: Client store — derived selectors

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts` (selectors live here, colocated with `selectStandings` et al. — per the commit `24b5cf6` pattern)
- Test: `apps/client/src/store/__tests__/phase4-selectors.test.ts`

**Pattern reminder:** `selectRevealsToReplay` returns a fresh array → MUST be wrapped with `memoSelector`. The other four return primitives (boolean / number / 'dm'|'silver'|'invite'|null) → do NOT need wrapping.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/client/src/store/__tests__/phase4-selectors.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';
import {
  selectCartridgeUnread,
  selectSilverUnread,
  selectRevealsToReplay,
  selectAggregatePulseUnread,
  selectCastChipUnreadKind,
} from '../useGameStore';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1',
    lastSeenCartridge: {},
    lastSeenSilverFrom: {},
    revealsSeen: { elimination: {}, winner: false },
    roster: {
      p1: { personaName: 'You', status: 'ALIVE', silver: 0 },
      p2: { personaName: 'Bob', status: 'ELIMINATED', eliminatedOnDay: 2, silver: 10 },
      p3: { personaName: 'Cat', status: 'ALIVE', silver: 20 },
    } as any,
    winner: null,
    activeVotingCartridge: { cartridgeId: 'voting-3-MAJORITY', updatedAt: 5000, votes: {} } as any,
    activeGameCartridge: null,
    activePromptCartridge: null,
    activeDilemma: null,
    completedCartridges: [],
    tickerMessages: [],
    chatLog: [],
    channels: {},
    pendingDmInvites: [],
  });
});

describe('selectCartridgeUnread', () => {
  it('returns true when active cartridge has no lastSeen entry', () => {
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(true);
  });
  it('returns true when updatedAt > lastSeen', () => {
    useGameStore.setState({ lastSeenCartridge: { 'voting-3-MAJORITY': 1000 } });
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(true);
  });
  it('returns false when lastSeen ≥ updatedAt', () => {
    useGameStore.setState({ lastSeenCartridge: { 'voting-3-MAJORITY': 5000 } });
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(false);
  });
  it('returns true for completed cartridge when completedAt > lastSeen', () => {
    useGameStore.setState({
      activeVotingCartridge: null,
      completedCartridges: [{ kind: 'voting', snapshot: { mechanism: 'MAJORITY', dayIndex: 3 }, completedAt: 8000, key: 'voting-3-MAJORITY' }] as any,
      lastSeenCartridge: { 'voting-3-MAJORITY': 5000 },
    });
    expect(selectCartridgeUnread(useGameStore.getState(), 'voting-3-MAJORITY')).toBe(true);
  });
});

describe('selectSilverUnread', () => {
  it('returns true when a SILVER ticker entry from sender is after lastSeen', () => {
    useGameStore.setState({
      tickerMessages: [
        { category: 'SILVER', timestamp: 2000, payload: { senderId: 'p3', recipientId: 'p1', amount: 5 } },
      ] as any,
    });
    expect(selectSilverUnread(useGameStore.getState(), 'p3')).toBe(true);
  });
  it('returns false when no matching ticker entry or already seen', () => {
    useGameStore.setState({
      tickerMessages: [
        { category: 'SILVER', timestamp: 2000, payload: { senderId: 'p3', recipientId: 'p1', amount: 5 } },
      ] as any,
      lastSeenSilverFrom: { p3: 3000 },
    });
    expect(selectSilverUnread(useGameStore.getState(), 'p3')).toBe(false);
  });
});

describe('selectRevealsToReplay', () => {
  it('returns elimination for a player eliminated on day 2 with no revealsSeen entry', () => {
    const result = selectRevealsToReplay(useGameStore.getState());
    expect(result).toContainEqual({ kind: 'elimination', dayIndex: 2 });
  });
  it('omits elimination when revealsSeen.elimination[2] is true', () => {
    useGameStore.setState({ revealsSeen: { elimination: { 2: true }, winner: false } });
    const result = selectRevealsToReplay(useGameStore.getState());
    expect(result).toEqual([]);
  });
  it('includes winner when winner set and not seen', () => {
    useGameStore.setState({
      winner: { playerId: 'p3', mechanism: 'FINALS' } as any,
      revealsSeen: { elimination: { 2: true }, winner: false },
    });
    const result = selectRevealsToReplay(useGameStore.getState());
    expect(result).toContainEqual({ kind: 'winner' });
  });
});

describe('selectAggregatePulseUnread', () => {
  it('sums DM unread + cartridge unread + invite + silver', () => {
    useGameStore.setState({
      channels: { 'DM-p1-p3': { type: 'DM', memberIds: ['p1', 'p3'] } } as any,
      chatLog: [{ channelId: 'DM-p1-p3', timestamp: 5000, senderId: 'p3' }] as any,
      lastReadTimestamp: {},
      pendingDmInvites: [{ senderId: 'p2', channelId: 'DM-p2-p1' }] as any,
      tickerMessages: [{ category: 'SILVER', timestamp: 4000, payload: { senderId: 'p3', recipientId: 'p1' } }] as any,
    });
    expect(selectAggregatePulseUnread(useGameStore.getState())).toBeGreaterThanOrEqual(3);
  });
});

describe('selectCastChipUnreadKind', () => {
  it('returns invite first when present', () => {
    useGameStore.setState({
      pendingDmInvites: [{ senderId: 'p3', channelId: 'DM-p3-p1' }] as any,
      tickerMessages: [{ category: 'SILVER', timestamp: 5000, payload: { senderId: 'p3', recipientId: 'p1' } }] as any,
    });
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBe('invite');
  });
  it('returns dm when dm unread but no invite', () => {
    useGameStore.setState({
      channels: { 'DM-p1-p3': { type: 'DM', memberIds: ['p1', 'p3'] } } as any,
      chatLog: [{ channelId: 'DM-p1-p3', timestamp: 5000, senderId: 'p3' }] as any,
      lastReadTimestamp: {},
    });
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBe('dm');
  });
  it('returns silver when no invite/dm but silver pip applies', () => {
    useGameStore.setState({
      tickerMessages: [{ category: 'SILVER', timestamp: 5000, payload: { senderId: 'p3', recipientId: 'p1' } }] as any,
    });
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBe('silver');
  });
  it('returns null when no signals', () => {
    expect(selectCastChipUnreadKind(useGameStore.getState(), 'p3')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd apps/client && npx vitest run src/store/__tests__/phase4-selectors.test.ts`
Expected: FAIL — file missing.

- [ ] **Step 3: Implement selectors**

Append these to `apps/client/src/store/useGameStore.ts` (below the existing `selectCastStripEntries` / `selectStandings` block, using the same export style). The `memoSelector` helper is already defined in this file.

```typescript
// Phase 4 selectors. selectRevealsToReplay is the only fresh-array selector;
// it is wrapped with memoSelector (guardrail: finite-zustand-selector-fresh-objects).
// Other selectors return primitives and do not need wrapping.

export function selectCartridgeUnread(s: GameState, cartridgeId: string): boolean {
  const lastSeen = s.lastSeenCartridge[cartridgeId];
  // Active cartridge?
  const actives = [s.activeVotingCartridge, s.activeGameCartridge, s.activePromptCartridge, s.activeDilemma];
  const active = actives.find((c: any) => c?.cartridgeId === cartridgeId);
  if (active) {
    if (lastSeen === undefined) return true;
    return (active.updatedAt ?? 0) > lastSeen;
  }
  // Completed?
  const completed = s.completedCartridges.find((c: any) => c.key === cartridgeId);
  if (completed) {
    if (lastSeen === undefined) return true;
    return (completed.completedAt ?? 0) > lastSeen;
  }
  return false;
}

export function selectSilverUnread(s: GameState, senderId: string): boolean {
  const lastSeen = s.lastSeenSilverFrom[senderId] ?? 0;
  return s.tickerMessages.some((m: any) =>
    m.category === 'SILVER' &&
    m.payload?.senderId === senderId &&
    m.payload?.recipientId === s.playerId &&
    (typeof m.timestamp === 'number' ? m.timestamp : new Date(m.timestamp).getTime()) > lastSeen
  );
}

export const selectRevealsToReplay = memoSelector(
  (s) => [s.roster, s.winner, s.revealsSeen, s.dayIndex],
  (s: GameState): Array<{kind: 'elimination' | 'winner'; dayIndex?: number}> => {
    const out: Array<{kind: 'elimination' | 'winner'; dayIndex?: number}> = [];
    for (const [, r] of Object.entries(s.roster) as Array<[string, any]>) {
      if (r.status === 'ELIMINATED') {
        const day = r.eliminatedOnDay ?? s.dayIndex;
        if (!s.revealsSeen.elimination[day]) {
          out.push({ kind: 'elimination', dayIndex: day });
        }
      }
    }
    if (s.winner && !s.revealsSeen.winner) {
      out.push({ kind: 'winner' });
    }
    return out;
  },
);

function getDmUnreadCount(s: GameState): number {
  const lrt = s.lastReadTimestamp || {};
  let count = 0;
  for (const [chId, ch] of Object.entries(s.channels) as Array<[string, any]>) {
    if (ch.type !== 'DM' && ch.type !== 'GROUP_DM') continue;
    if (!ch.memberIds.includes(s.playerId)) continue;
    const lastRead = lrt[chId] ?? 0;
    const unread = s.chatLog.filter((m: any) =>
      m.channelId === chId &&
      m.senderId !== s.playerId &&
      (m.timestamp ?? 0) > lastRead
    ).length;
    count += unread;
  }
  return count;
}

function getCartridgeUnreadCount(s: GameState): number {
  const ids = new Set<string>();
  for (const c of [s.activeVotingCartridge, s.activeGameCartridge, s.activePromptCartridge, s.activeDilemma] as any[]) {
    if (c?.cartridgeId) ids.add(c.cartridgeId);
  }
  for (const c of s.completedCartridges as any[]) {
    if (c?.key) ids.add(c.key);
  }
  let count = 0;
  for (const id of ids) {
    if (selectCartridgeUnread(s, id)) count++;
  }
  return count;
}

function getSilverUnreadCount(s: GameState): number {
  const senders = new Set<string>();
  for (const m of s.tickerMessages as any[]) {
    if (m.category === 'SILVER' && m.payload?.recipientId === s.playerId && m.payload?.senderId) {
      senders.add(m.payload.senderId);
    }
  }
  let count = 0;
  for (const id of senders) {
    if (selectSilverUnread(s, id)) count++;
  }
  return count;
}

export function selectAggregatePulseUnread(s: GameState): number {
  return getDmUnreadCount(s)
    + (s.pendingDmInvites?.length ?? 0)
    + getCartridgeUnreadCount(s)
    + getSilverUnreadCount(s);
}

export function selectCastChipUnreadKind(s: GameState, personaId: string): 'dm' | 'silver' | 'invite' | null {
  // Priority: invite > dm > silver (social salience — unanswered invite is strongest CTA)
  if ((s.pendingDmInvites ?? []).some((inv: any) => inv.senderId === personaId)) return 'invite';
  const lrt = s.lastReadTimestamp || {};
  for (const [chId, ch] of Object.entries(s.channels) as Array<[string, any]>) {
    if (ch.type !== 'DM') continue;
    if (!ch.memberIds.includes(personaId) || !ch.memberIds.includes(s.playerId)) continue;
    const lastRead = lrt[chId] ?? 0;
    const hasUnread = s.chatLog.some((m: any) =>
      m.channelId === chId && m.senderId === personaId && (m.timestamp ?? 0) > lastRead
    );
    if (hasUnread) return 'dm';
  }
  if (selectSilverUnread(s, personaId)) return 'silver';
  return null;
}
```

- [ ] **Step 4: Run — PASS**

Run: `cd apps/client && npx vitest run src/store/__tests__/phase4-selectors.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/store/useGameStore.ts apps/client/src/store/__tests__/phase4-selectors.test.ts
git commit -m "feat(client): Phase 4 derived selectors for unread state across surfaces

selectRevealsToReplay is memoSelector-wrapped (returns fresh array — avoids
React 19 useSyncExternalStore infinite loop per the finite-zustand-selector-
fresh-objects guardrail). Other selectors return primitives and are safe unwrapped."
```

---

## Phase 2 — Push + Service Worker + Deep-link Intent

### Task 8: Server push-triggers — thread `intent` parameter through send helpers

**Files:**
- Modify: `apps/game-server/src/push-triggers.ts` (pushToPlayer, pushBroadcast)
- Test: `apps/game-server/src/__tests__/push-intent.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/game-server/src/__tests__/push-intent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pushToPlayer } from '../push-triggers';
import * as pushSend from '../push-send';
import * as d1 from '../d1-persistence';

vi.mock('../push-send');
vi.mock('../d1-persistence');

describe('pushToPlayer — intent threading', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    (d1.getPushSubscriptionD1 as any).mockResolvedValue({ endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } });
    (pushSend.sendPushNotification as any).mockResolvedValue('ok');
  });

  it('includes intent in payload.data when provided', async () => {
    await pushToPlayer(
      { roster: { p1: { realUserId: 'p1' } }, db: {} as any, vapidPrivateJwk: '', clientHost: 'https://x', inviteCode: 'ABC' } as any,
      'p1',
      { title: 'Hi', body: 'Msg' },
      3600,
      { kind: 'dm', channelId: 'ch-1' },
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    const enriched = call[1];
    expect(enriched.intent).toBe(JSON.stringify({ kind: 'dm', channelId: 'ch-1' }));
  });

  it('omits intent when not provided', async () => {
    await pushToPlayer(
      { roster: { p1: {} }, db: {} as any, vapidPrivateJwk: '', clientHost: 'https://x', inviteCode: 'ABC' } as any,
      'p1',
      { title: 'Hi', body: 'Msg' },
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(call[1].intent).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd apps/game-server && npx vitest run src/__tests__/push-intent.test.ts`
Expected: FAIL — pushToPlayer signature doesn't accept intent.

- [ ] **Step 3: Thread `intent` through `pushToPlayer` and `pushBroadcast`**

In `apps/game-server/src/push-triggers.ts`:

```typescript
import type { DeepLinkIntent } from "@pecking-order/shared-types";

export async function pushToPlayer(
  ctx: PushContext,
  playerId: string,
  payload: Record<string, string>,
  ttl?: number,
  intent?: DeepLinkIntent,
): Promise<void> {
  const pushKey = pushKeyForPlayer(playerId, ctx.roster);
  const sub = await getPushSubscriptionD1(ctx.db, pushKey);
  if (!sub) {
    console.log(`[L1] [Push] Skip ${playerId} — no subscription stored`);
    return;
  }

  const url = ctx.inviteCode ? `${ctx.clientHost}/game/${ctx.inviteCode}` : ctx.clientHost;
  const enriched: Record<string, string> = { ...payload, url };
  if (intent) enriched.intent = JSON.stringify(intent);

  console.log(`[L1] [Push] Sending to ${playerId}: ${payload.body}`);
  const result = await sendPushNotification(sub, enriched, ctx.vapidPrivateJwk, undefined, ttl);
  console.log(`[L1] [Push] Result for ${playerId}: ${result}`);
  if (result === "expired") {
    await deletePushSubscriptionD1(ctx.db, pushKey);
  }
}

export async function pushBroadcast(
  ctx: PushContext,
  payload: Record<string, string>,
  ttl?: number,
  excludePlayerIds?: string[],
  intent?: DeepLinkIntent,
): Promise<void> {
  const exclude = new Set(excludePlayerIds);
  const playerIds = Object.keys(ctx.roster).filter(pid => !exclude.has(pid));
  console.log(`[L1] [Push] Broadcasting to ${playerIds.length} players: ${payload.body}`);
  await Promise.allSettled(
    playerIds.map((pid) => pushToPlayer(ctx, pid, payload, ttl, intent)),
  );
}
```

- [ ] **Step 4: Run — PASS**

Run: `cd apps/game-server && npx vitest run src/__tests__/push-intent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/push-triggers.ts apps/game-server/src/__tests__/push-intent.test.ts
git commit -m "feat(server): thread DeepLinkIntent through pushToPlayer and pushBroadcast"
```

---

### Task 9: Server push-triggers — fact-push intents

**Files:**
- Modify: `apps/game-server/src/push-triggers.ts` (`handleFactPush`)
- Test: `apps/game-server/src/__tests__/push-intent-facts.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/game-server/src/__tests__/push-intent-facts.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFactPush } from '../push-triggers';
import * as pushSend from '../push-send';
import * as d1 from '../d1-persistence';
import { FactTypes } from '@pecking-order/shared-types';

vi.mock('../push-send');
vi.mock('../d1-persistence');

const makeCtx = () => ({
  roster: { p1: { realUserId: 'p1', personaName: 'Alice' }, p2: { realUserId: 'p2', personaName: 'Bob' } },
  db: {} as any, vapidPrivateJwk: '', clientHost: 'https://x', inviteCode: 'ABC',
});

beforeEach(() => {
  vi.resetAllMocks();
  (d1.getPushSubscriptionD1 as any).mockResolvedValue({ endpoint: 'x', keys: { p256dh: 'a', auth: 'b' } });
  (pushSend.sendPushNotification as any).mockResolvedValue('ok');
});

describe('handleFactPush intent construction', () => {
  it('DM_SENT → dm intent with channelId', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.DM_SENT, actorId: 'p2', targetId: 'p1', payload: { channelId: 'DM-p1-p2', content: 'hi' } },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'dm', channelId: 'DM-p1-p2' });
  });

  it('DM_INVITE_SENT → dm_invite intent with senderId', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.DM_INVITE_SENT, actorId: 'p2', payload: { memberIds: ['p1'] } },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'dm_invite', senderId: 'p2' });
  });

  it('ELIMINATION → elimination_reveal with dayIndex', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.ELIMINATION, targetId: 'p2', payload: { dayIndex: 3 } },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'elimination_reveal', dayIndex: 3 });
  });

  it('WINNER_DECLARED → winner_reveal scalar', async () => {
    await handleFactPush(
      makeCtx() as any,
      { type: FactTypes.WINNER_DECLARED, targetId: 'p2' },
      null,
    );
    const call = (pushSend.sendPushNotification as any).mock.calls[0];
    expect(JSON.parse(call[1].intent)).toEqual({ kind: 'winner_reveal' });
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd apps/game-server && npx vitest run src/__tests__/push-intent-facts.test.ts`
Expected: FAIL.

- [ ] **Step 3: Build intents in `handleFactPush`**

In `apps/game-server/src/push-triggers.ts`, update `handleFactPush`:

```typescript
  if (fact.type === FactTypes.CHAT_MSG && fact.payload?.channelId === 'MAIN') {
    if (!isPushEnabled(manifest, 'GROUP_CHAT_MSG')) return;
    return pushBroadcast(ctx, {
      title: name(fact.actorId),
      body: (fact.payload?.content || '').slice(0, 100),
    }, EVENT_TTL, [fact.actorId], { kind: 'main' }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_SENT) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;
    const snippet = (fact.payload?.content || '').slice(0, 100);
    const payload = { title: name(fact.actorId), body: snippet || 'Sent you a message' };
    const channelId = fact.payload?.channelId as string | undefined;
    const intent = channelId ? { kind: 'dm' as const, channelId } : undefined;

    const targetIds: string[] | undefined = fact.payload?.targetIds;
    if (targetIds && targetIds.length > 0) {
      return Promise.allSettled(
        targetIds.map((tid: string) => pushToPlayer(ctx, tid, payload, DM_TTL, intent))
      ).then(() => {}).catch(err => console.error('[L1] [Push] Error:', err));
    }
    if (fact.targetId) {
      return pushToPlayer(ctx, fact.targetId, payload, DM_TTL, intent)
        .catch(err => console.error('[L1] [Push] Error:', err));
    }
    return;
  } else if (fact.type === FactTypes.ELIMINATION) {
    if (!isPushEnabled(manifest, 'ELIMINATION')) return;
    const dayIndex = fact.payload?.dayIndex as number | undefined;
    const intent = dayIndex !== undefined ? { kind: 'elimination_reveal' as const, dayIndex } : undefined;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} has been eliminated!`,
    }, ELIMINATION_TTL, undefined, intent).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.WINNER_DECLARED) {
    if (!isPushEnabled(manifest, 'WINNER_DECLARED')) return;
    return pushBroadcast(ctx, {
      title: 'Pecking Order',
      body: `${name(fact.targetId || fact.actorId)} wins!`,
    }, WINNER_TTL, undefined, { kind: 'winner_reveal' }).catch(err => console.error('[L1] [Push] Error:', err));
  } else if (fact.type === FactTypes.DM_INVITE_SENT && fact.payload?.memberIds) {
    if (!isPushEnabled(manifest, 'DM_SENT')) return;
    const memberIds = fact.payload.memberIds as string[];
    const intent = { kind: 'dm_invite' as const, senderId: fact.actorId };
    return Promise.all(
      memberIds.map((memberId: string) =>
        pushToPlayer(ctx, memberId, {
          title: name(fact.actorId),
          body: `${name(fact.actorId)} invited you to chat`,
        }, DM_TTL, intent)
      )
    ).then(() => {}).catch(err => console.error('[L1] [Push] Error:', err));
  }
```

Verify `dayIndex` is present on `ELIMINATION` fact payloads. If not, either (a) add to the fact construction site (grep for `FactTypes.ELIMINATION`), or (b) derive from current dayIndex in the emitter. Document which path was taken.

- [ ] **Step 4: Run — PASS**

Run: `cd apps/game-server && npm run test`
Expected: all PASS including new tests.

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/push-triggers.ts apps/game-server/src/__tests__/push-intent-facts.test.ts
git commit -m "feat(server): attach DeepLinkIntent to DM, invite, elimination, and winner pushes"
```

---

### Task 10: Server push-triggers — phase-push intents

**Files:**
- Modify: `apps/game-server/src/push-triggers.ts` (`phasePushPayload`) and call sites
- Test: `apps/game-server/src/__tests__/push-intent-phase.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/game-server/src/__tests__/push-intent-phase.test.ts
import { describe, it, expect } from 'vitest';
import { phasePushPayload } from '../push-triggers';

describe('phasePushPayload — intents', () => {
  const dayManifest = { gameType: 'TRIVIA', voteType: 'MAJORITY' } as any;

  it('VOTING returns cartridge_active intent with voting kind and cartridgeId', () => {
    const result = phasePushPayload('VOTING', 3, dayManifest);
    expect(result?.intent).toEqual({
      kind: 'cartridge_active',
      cartridgeId: 'voting-3-MAJORITY',
      cartridgeKind: 'voting',
    });
  });

  it('DAILY_GAME returns cartridge_active with game kind', () => {
    const result = phasePushPayload('DAILY_GAME', 3, dayManifest);
    expect(result?.intent).toEqual({
      kind: 'cartridge_active',
      cartridgeId: 'game-3-TRIVIA',
      cartridgeKind: 'game',
    });
  });

  it('ACTIVITY returns cartridge_active with prompt kind', () => {
    const result = phasePushPayload('ACTIVITY', 3, { ...dayManifest, promptType: 'POLL' } as any);
    expect(result?.intent).toEqual({
      kind: 'cartridge_active',
      cartridgeId: 'prompt-3-POLL',
      cartridgeKind: 'prompt',
    });
  });

  it('END_GAME returns cartridge_result intent', () => {
    const result = phasePushPayload('END_GAME', 3, dayManifest);
    expect(result?.intent).toEqual({ kind: 'cartridge_result', cartridgeId: 'game-3-TRIVIA' });
  });

  it('END_ACTIVITY returns cartridge_result with prompt kind', () => {
    const result = phasePushPayload('END_ACTIVITY', 3, { promptType: 'POLL' } as any);
    expect(result?.intent).toEqual({ kind: 'cartridge_result', cartridgeId: 'prompt-3-POLL' });
  });

  it('DAY_START, NIGHT_SUMMARY, OPEN/CLOSE gates return main intent', () => {
    for (const trig of ['DAY_START', 'NIGHT_SUMMARY', 'OPEN_DMS', 'CLOSE_DMS', 'OPEN_GROUP_CHAT', 'CLOSE_GROUP_CHAT']) {
      expect(phasePushPayload(trig, 3, dayManifest)?.intent).toEqual({ kind: 'main' });
    }
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Change return type + update all branches**

In `apps/game-server/src/push-triggers.ts`:

```typescript
import type { DeepLinkIntent } from "@pecking-order/shared-types";

export function phasePushPayload(
  trigger: string,
  dayIndex: number,
  dayManifest?: DailyManifest | null,
): { payload: Record<string, string>; ttl: number; intent: DeepLinkIntent } | null {
  const gameType = dayManifest?.gameType || 'UNKNOWN';
  const voteType = dayManifest?.voteType || 'UNKNOWN';
  const promptType = (dayManifest as any)?.promptType || 'UNKNOWN';
  const gameLabel = GAME_LABELS[gameType] || 'Game';
  const voteLabel = VOTE_LABELS[voteType] || 'Voting';

  switch (trigger) {
    case 'DAY_START':
      return { payload: { title: `Day ${dayIndex}`, body: `A new day dawns at Pecking Order. Today's vote: ${voteLabel}` }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'VOTING':
      return { payload: { title: voteLabel, body: `Day ${dayIndex} voting is open — cast your vote now` }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_active', cartridgeId: `voting-${dayIndex}-${voteType}`, cartridgeKind: 'voting' } };
    case 'NIGHT_SUMMARY':
      return { payload: { title: "Night has fallen", body: `Day ${dayIndex} results are in...` }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'DAILY_GAME':
      return { payload: { title: `${gameLabel} Time`, body: `Today's game is ${gameLabel} — jump in and play` }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_active', cartridgeId: `game-${dayIndex}-${gameType}`, cartridgeKind: 'game' } };
    case 'ACTIVITY':
      return { payload: { title: "Activity Time", body: `A new activity is live — earn some silver` }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_active', cartridgeId: `prompt-${dayIndex}-${promptType}`, cartridgeKind: 'prompt' } };
    case 'OPEN_DMS':
      return { payload: { title: "DMs Open", body: "Send private messages, form alliances, make deals" }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'CLOSE_DMS':
      return { payload: { title: "DMs Closed", body: "Private messages are closed for the day" }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'OPEN_GROUP_CHAT':
      return { payload: { title: "Group Chat Open", body: "The floor is open — make your case" }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'CLOSE_GROUP_CHAT':
      return { payload: { title: "Group Chat Closed", body: "The group chat has closed for the day" }, ttl: EVENT_TTL, intent: { kind: 'main' } };
    case 'END_GAME':
      return { payload: { title: `${gameLabel} Complete`, body: "Results are in — check how you did" }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_result', cartridgeId: `game-${dayIndex}-${gameType}` } };
    case 'END_ACTIVITY':
      return { payload: { title: "Activity Complete", body: "Results are in — see who earned silver" }, ttl: EVENT_TTL,
               intent: { kind: 'cartridge_result', cartridgeId: `prompt-${dayIndex}-${promptType}` } };
    default:
      return null;
  }
}
```

Update all callers of `phasePushPayload` to pass `intent` through to `pushBroadcast`/`pushToPlayer`. Grep: `phasePushPayload(` → each call site must be inspected. Typical site uses `{payload, ttl}` destructuring; extend to `{payload, ttl, intent}` and pass `intent` to the broadcast.

- [ ] **Step 4: Run — PASS**

Run: `cd apps/game-server && npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/game-server/src/push-triggers.ts apps/game-server/src/**/*.ts apps/game-server/src/__tests__/push-intent-phase.test.ts
git commit -m "feat(server): attach DeepLinkIntent to all phase-driven push notifications"
```

---

### Task 11: Client service worker — intent parsing + routing

**Files:**
- Modify: `apps/client/src/sw.ts`
- Test: `apps/client/src/__tests__/sw-intent.test.ts`

**Important:** This file runs in the Service Worker global, not the DOM. Tests mock SW globals.

- [ ] **Step 1: Write failing test**

```typescript
// apps/client/src/__tests__/sw-intent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test the pure intent-parsing helper, not the full SW lifecycle.
// Extract the helper from sw.ts: parseIntentFromData(data: any): DeepLinkIntent | null
import { parseIntentFromData, buildIntentUrl } from '../sw-intent-helpers';

describe('parseIntentFromData', () => {
  it('parses a valid stringified intent', () => {
    expect(parseIntentFromData({ intent: JSON.stringify({ kind: 'main' }) })).toEqual({ kind: 'main' });
  });
  it('returns null for missing intent field', () => {
    expect(parseIntentFromData({ url: 'https://x' })).toBeNull();
  });
  it('returns null for malformed JSON', () => {
    expect(parseIntentFromData({ intent: '{not-json' })).toBeNull();
  });
  it('returns null for non-object parse result', () => {
    expect(parseIntentFromData({ intent: '"string"' })).toBeNull();
  });
  it('returns null for missing kind field', () => {
    expect(parseIntentFromData({ intent: '{"channelId":"x"}' })).toBeNull();
  });
});

describe('buildIntentUrl', () => {
  it('appends ?intent=<base64> to URL without query', () => {
    const url = buildIntentUrl('https://x/game/ABC', { kind: 'main' });
    expect(url).toMatch(/^https:\/\/x\/game\/ABC\?intent=/);
    const intentParam = new URL(url).searchParams.get('intent');
    const decoded = JSON.parse(atob(intentParam!));
    expect(decoded).toEqual({ kind: 'main' });
  });
  it('appends &intent= to URL with existing query', () => {
    const url = buildIntentUrl('https://x/game/ABC?foo=1', { kind: 'main' });
    expect(url).toContain('&intent=');
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd apps/client && npx vitest run src/__tests__/sw-intent.test.ts`
Expected: FAIL — helper file doesn't exist.

- [ ] **Step 3: Extract SW intent helpers**

Create `apps/client/src/sw-intent-helpers.ts`:

```typescript
import type { DeepLinkIntent } from '@pecking-order/shared-types';

const VALID_KINDS = new Set([
  'main', 'dm', 'dm_invite', 'cartridge_active', 'cartridge_result',
  'elimination_reveal', 'winner_reveal',
]);

export function parseIntentFromData(data: any): DeepLinkIntent | null {
  if (!data || typeof data.intent !== 'string') return null;
  try {
    const parsed = JSON.parse(data.intent);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.kind !== 'string') return null;
    if (!VALID_KINDS.has(parsed.kind)) return null;
    return parsed as DeepLinkIntent;
  } catch {
    return null;
  }
}

export function buildIntentUrl(baseUrl: string, intent: DeepLinkIntent): string {
  const b64 = btoa(JSON.stringify(intent));
  return baseUrl.includes('?') ? `${baseUrl}&intent=${b64}` : `${baseUrl}?intent=${b64}`;
}
```

Wire these into `apps/client/src/sw.ts`. Update the push handler to parse and stash intent on `self.registration` keyed by notification tag; update the `notificationclick` handler to focus + postMessage or openWindow with fallback URL.

Edit `apps/client/src/sw.ts` — replace the push handler's try block and the notificationclick handler:

```typescript
import { parseIntentFromData, buildIntentUrl } from './sw-intent-helpers';

// In push event handler:
  try {
    const data = event.data.json();
    const title = data.title || 'Pecking Order';
    const intent = parseIntentFromData(data);
    const tag = crypto.randomUUID();
    const options: NotificationOptions = {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      requireInteraction: true,
      tag,
      data: { url: data.url || self.location.origin, intent },
    };
    // (token caching block unchanged)
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) { /* unchanged */ }

// Replace notificationclick handler:
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url as string) || self.location.origin;
  const intent = event.notification.data?.intent as DeepLinkIntent | null;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      // Prefer focusing an existing same-origin window and posting the intent
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          if ('navigate' in client) {
            await (client as WindowClient).navigate(targetUrl);
          }
          const focused = await (client as WindowClient).focus();
          if (intent) focused.postMessage({ type: 'DEEP_LINK_INTENT', intent });
          return;
        }
      }
      // Cold start: carry intent in URL
      const openUrl = intent ? buildIntentUrl(targetUrl, intent) : targetUrl;
      return self.clients.openWindow(openUrl);
    }).catch((err) => console.error('[SW] Notification click navigation failed:', err)),
  );
});
```

Add `import type { DeepLinkIntent } from '@pecking-order/shared-types';` at top of `sw.ts`.

- [ ] **Step 4: Run — PASS**

Run: `cd apps/client && npx vitest run src/__tests__/sw-intent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/sw.ts apps/client/src/sw-intent-helpers.ts apps/client/src/__tests__/sw-intent.test.ts
git commit -m "feat(client-sw): parse DeepLinkIntent from push data and route on notificationclick

Push handler stashes intent on notification.data. Click handler focuses an
existing client and postMessages the intent, or opens a window with the
intent encoded as a ?intent= base64 query param for cold-start clients."
```

---

### Task 12: Client — `useDeepLinkIntent` hook with retry policy

**Files:**
- Create: `apps/client/src/hooks/useDeepLinkIntent.ts`
- Test: `apps/client/src/hooks/__tests__/useDeepLinkIntent.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/client/src/hooks/__tests__/useDeepLinkIntent.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '../../store/useGameStore';
import { useDeepLinkIntent } from '../useDeepLinkIntent';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1',
    pendingIntent: null, pendingIntentAttempts: 0, pendingIntentFirstReceivedAt: null,
    channels: { 'DM-p1-p3': { type: 'DM', memberIds: ['p1','p3'] } as any },
  });
  vi.useFakeTimers();
  vi.setSystemTime(new Date(1000));
});

describe('useDeepLinkIntent', () => {
  it('reads ?intent= from URL on mount, clears it, sets pendingIntent', () => {
    const intent = { kind: 'dm', channelId: 'DM-p1-p3' };
    const b64 = btoa(JSON.stringify(intent));
    history.replaceState(null, '', `/game/ABC?intent=${b64}`);

    const resolve = vi.fn();
    renderHook(() => useDeepLinkIntent(resolve));

    expect(window.location.search).toBe('');
    expect(resolve).toHaveBeenCalledWith(intent);
  });

  it('subscribes to DEEP_LINK_INTENT postMessage and calls resolve', () => {
    const resolve = vi.fn();
    renderHook(() => useDeepLinkIntent(resolve));

    act(() => {
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', { data: { type: 'DEEP_LINK_INTENT', intent: { kind: 'main' } } }),
      );
    });
    expect(resolve).toHaveBeenCalledWith({ kind: 'main' });
  });

  it('retains unresolvable intent and retries up to 3 times', () => {
    const resolve = vi.fn().mockReturnValue(false); // false = unresolvable
    const { rerender } = renderHook(() => useDeepLinkIntent(resolve));
    act(() => useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'missing' }));

    rerender();
    expect(useGameStore.getState().pendingIntentAttempts).toBeGreaterThanOrEqual(1);

    // simulate SYNCs happening
    for (let i = 0; i < 5; i++) rerender();
    expect(useGameStore.getState().pendingIntentAttempts).toBeLessThanOrEqual(3);
  });

  it('drops intent after 10s regardless of attempts', () => {
    const resolve = vi.fn().mockReturnValue(false);
    renderHook(() => useDeepLinkIntent(resolve));
    act(() => useGameStore.getState().setPendingIntent({ kind: 'dm', channelId: 'missing' }));
    vi.advanceTimersByTime(11_000);
    // Next rerender triggers cleanup
    act(() => { /* trigger re-eval */ });
    expect(useGameStore.getState().pendingIntent).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd apps/client && npx vitest run src/hooks/__tests__/useDeepLinkIntent.test.ts`
Expected: FAIL — hook missing.

- [ ] **Step 3: Implement hook**

```typescript
// apps/client/src/hooks/useDeepLinkIntent.ts
import { useEffect } from 'react';
import type { DeepLinkIntent } from '@pecking-order/shared-types';
import { useGameStore } from '../store/useGameStore';

const MAX_ATTEMPTS = 3;
const MAX_AGE_MS = 10_000;

/**
 * resolve(intent, origin) returns true if handled, false if the target isn't ready yet.
 * Returning false retains the intent for retry on subsequent store updates.
 * origin is always 'push' when driven by this hook (SW postMessage or ?intent= URL).
 * Manual taps in the UI bypass this hook and call the same resolver directly with origin='manual'.
 */
export function useDeepLinkIntent(resolve: (intent: DeepLinkIntent, origin: 'push') => boolean): void {
  const pendingIntent = useGameStore(s => s.pendingIntent);
  const attempts = useGameStore(s => s.pendingIntentAttempts);
  const firstReceivedAt = useGameStore(s => s.pendingIntentFirstReceivedAt);
  const setPendingIntent = useGameStore(s => s.setPendingIntent);
  const incrementIntentAttempts = useGameStore(s => s.incrementIntentAttempts);

  // Mount: read ?intent= from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const b64 = params.get('intent');
    if (b64) {
      try {
        const intent = JSON.parse(atob(b64)) as DeepLinkIntent;
        // Clear the query param from history
        params.delete('intent');
        const newSearch = params.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
        const handled = resolve(intent, 'push');
        if (!handled) setPendingIntent(intent);
      } catch {
        // Malformed ?intent= — ignore silently
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to postMessage from SW
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'DEEP_LINK_INTENT' && event.data.intent) {
        const intent = event.data.intent as DeepLinkIntent;
        const handled = resolve(intent, 'push');
        if (!handled) setPendingIntent(intent);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [resolve, setPendingIntent]);

  // Retry loop: re-evaluate pendingIntent on every render, bounded by MAX_ATTEMPTS / MAX_AGE_MS
  useEffect(() => {
    if (!pendingIntent || !firstReceivedAt) return;
    if (Date.now() - firstReceivedAt > MAX_AGE_MS) {
      setPendingIntent(null);
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      setPendingIntent(null);
      return;
    }
    incrementIntentAttempts();
    const handled = resolve(pendingIntent, 'push');
    if (handled) setPendingIntent(null);
  }, [pendingIntent, attempts, firstReceivedAt, resolve, setPendingIntent, incrementIntentAttempts]);
}
```

- [ ] **Step 4: Run — PASS**

Run: `cd apps/client && npx vitest run src/hooks/__tests__/useDeepLinkIntent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/hooks/useDeepLinkIntent.ts apps/client/src/hooks/__tests__/useDeepLinkIntent.test.ts
git commit -m "feat(client): useDeepLinkIntent hook with URL + postMessage sources and retry policy"
```

---

## Phase 3 — Per-surface Rendering

### Task 13: `ChatDivider` component + IntersectionObserver

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/ChatDivider.tsx`
- Modify: `apps/client/src/shells/pulse/components/chat/ChatView.tsx`
- Test: `apps/client/src/shells/pulse/components/chat/__tests__/ChatDivider.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// apps/client/src/shells/pulse/components/chat/__tests__/ChatDivider.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatDivider } from '../ChatDivider';

class MockIO {
  static instances: MockIO[] = [];
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) { this.callback = cb; MockIO.instances.push(this); }
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn();
  triggerExit() {
    this.callback([{ isIntersecting: false, boundingClientRect: { top: -10 } } as any], this as any);
  }
}

beforeEach(() => {
  MockIO.instances = [];
  (global as any).IntersectionObserver = MockIO;
});

describe('ChatDivider', () => {
  it('renders a "New" label', () => {
    const onCleared = vi.fn();
    render(<ChatDivider onCleared={onCleared} />);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('fires onCleared when IntersectionObserver reports top-exit', () => {
    const onCleared = vi.fn();
    render(<ChatDivider onCleared={onCleared} />);
    expect(MockIO.instances.length).toBe(1);
    MockIO.instances[0].triggerExit();
    expect(onCleared).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement ChatDivider**

```tsx
// apps/client/src/shells/pulse/components/chat/ChatDivider.tsx
import { useEffect, useRef } from 'react';

interface Props {
  onCleared: () => void;
}

export function ChatDivider({ onCleared }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting && e.boundingClientRect.top < 0) {
            onCleared();
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [onCleared]);

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        color: 'var(--pulse-accent)',
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'var(--pulse-accent)', opacity: 0.6 }} />
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>New</div>
      <div style={{ flex: 1, height: 1, background: 'var(--pulse-accent)', opacity: 0.6 }} />
    </div>
  );
}
```

Wire into `ChatView.tsx`: in the MAIN channel view, compute the index of the first message with `ts > lastReadTimestamp['MAIN']` and insert `<ChatDivider onCleared={() => markChannelRead('MAIN')} />` before it. Only render the divider if there IS at least one unread MAIN message.

- [ ] **Step 4: Run — PASS**

Run: `cd apps/client && npx vitest run src/shells/pulse/components/chat/__tests__/ChatDivider.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/ChatDivider.tsx apps/client/src/shells/pulse/components/chat/ChatView.tsx apps/client/src/shells/pulse/components/chat/__tests__/ChatDivider.test.tsx
git commit -m "feat(pulse): ChatDivider with IntersectionObserver clears MAIN unread on top-exit"
```

---

### Task 14: Pulse pill unread dot + intent-dispatch on tap

**Files:**
- Modify: `apps/client/src/shells/pulse/components/PulseBar.tsx` and `Pill.tsx`
- Test: `apps/client/src/shells/pulse/components/__tests__/PulseBarUnread.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/client/src/shells/pulse/components/__tests__/PulseBarUnread.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '../../../../store/useGameStore';
import { PulseBar } from '../PulseBar';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1',
    activeVotingCartridge: { cartridgeId: 'voting-3-MAJORITY', updatedAt: 5000, mechanism: 'MAJORITY', votes: {} } as any,
    activeGameCartridge: null, activePromptCartridge: null, activeDilemma: null,
    completedCartridges: [],
    lastSeenCartridge: {},
    manifest: null, dayIndex: 3,
  });
});

describe('PulseBar — unread dot', () => {
  it('shows a dot on a pill with no lastSeen entry', () => {
    render(<PulseBar />);
    expect(screen.getByTestId('pill-unread-voting-3-MAJORITY')).toBeInTheDocument();
  });

  it('clears the dot when the pill is tapped (intent dispatched with manual origin)', () => {
    const onIntent = vi.fn();
    render(<PulseBar onIntentDispatch={onIntent} />);
    fireEvent.click(screen.getByRole('button', { name: /Vote/i }));
    expect(onIntent).toHaveBeenCalledWith(
      { kind: 'cartridge_active', cartridgeId: 'voting-3-MAJORITY', cartridgeKind: 'voting' },
      'manual',
    );
    // lastSeenCartridge updated after intent dispatch
    expect(useGameStore.getState().lastSeenCartridge['voting-3-MAJORITY']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Add unread dot + onIntentDispatch prop to `PulseBar`/`Pill`**

In `Pill.tsx`, accept `unread: boolean` prop and render a coral 8px dot at top-right when true (use `data-testid={\`pill-unread-${cartridgeId}\`}`).

In `PulseBar.tsx`:

```tsx
import { selectCartridgeUnread } from '../../../store/useGameStore';
import type { DeepLinkIntent } from '@pecking-order/shared-types';

interface Props {
  onIntentDispatch?: (intent: DeepLinkIntent, origin: 'push' | 'manual') => void;
}

export function PulseBar({ onIntentDispatch }: Props) {
  const pills = usePillStates();
  const store = useGameStore();
  const markCartridgeSeen = useGameStore(s => s.markCartridgeSeen);

  const onPillTap = (pill: PillState) => {
    const cartridgeId = resolvePillCartridgeId(pill, store);
    if (!cartridgeId) return;
    const intent: DeepLinkIntent = pill.lifecycle === 'completed'
      ? { kind: 'cartridge_result', cartridgeId }
      : { kind: 'cartridge_active', cartridgeId, cartridgeKind: pill.kind };
    // Always dispatch through the shell's intent resolver with origin='manual'.
    // Resolver handles markCartridgeSeen + any side effects.
    onIntentDispatch?.(intent, 'manual');
  };

// Helper — place above PulseBar in the same file
function resolvePillCartridgeId(pill: PillState, store: GameStore): string | null {
  if (pill.id === 'voting') return store.activeVotingCartridge?.cartridgeId ?? null;
  if (pill.id === 'game') return store.activeGameCartridge?.cartridgeId ?? null;
  if (pill.id === 'prompt') return store.activePromptCartridge?.cartridgeId ?? null;
  if (pill.id === 'dilemma') return store.activeDilemma?.cartridgeId ?? null;
  if (pill.id.startsWith('completed-')) {
    return store.completedCartridges.find(c => c.kind === pill.kind)?.key ?? null;
  }
  return null;
}

  return (
    <div /* existing bar container */>
      {pills.map(p => {
        const cartridgeId = resolvePillCartridgeId(p, store);
        const unread = cartridgeId ? selectCartridgeUnread(store, cartridgeId) : false;
        return (
          <Pill
            key={p.id}
            state={p}
            cartridgeId={cartridgeId ?? undefined}  // rendered into data-pill-cartridge-id attr
            unread={unread}
            onClick={() => onPillTap(p)}
          />
        );
      })}
    </div>
  );
}
```

Extract the `cartridgeId` resolution to a local helper to avoid duplication.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/components/PulseBar.tsx apps/client/src/shells/pulse/components/Pill.tsx apps/client/src/shells/pulse/components/__tests__/PulseBarUnread.test.tsx
git commit -m "feat(pulse): unread dot on pulse pills; tap dispatches cartridge intent and marks seen"
```

---

### Task 15: `CastChip` silver pip + mark-silver-seen on DM open

**Files:**
- Modify: `apps/client/src/shells/pulse/components/caststrip/CastChip.tsx`
- Test: `apps/client/src/shells/pulse/components/caststrip/__tests__/CastChipSilver.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/client/src/shells/pulse/components/caststrip/__tests__/CastChipSilver.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useGameStore } from '../../../../../store/useGameStore';
import { CastChip } from '../CastChip';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1',
    roster: { p1: { personaName: 'You' }, p3: { personaName: 'Cat', status: 'ALIVE', silver: 20 } } as any,
    tickerMessages: [{ category: 'SILVER', timestamp: 5000, payload: { senderId: 'p3', recipientId: 'p1', amount: 5 } }] as any,
    lastSeenSilverFrom: {},
    pendingDmInvites: [],
    channels: {},
    chatLog: [],
  });
});

describe('CastChip — silver pip', () => {
  it('shows a gold pip when selectSilverUnread returns true for this persona', () => {
    render(<CastChip personaId="p3" onOpen={() => {}} />);
    expect(screen.getByTestId('chip-silver-pip-p3')).toBeInTheDocument();
  });

  it('clears silver pip when chip is tapped (opens DM)', () => {
    const onOpen = vi.fn();
    render(<CastChip personaId="p3" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith('p3');
    expect(useGameStore.getState().lastSeenSilverFrom['p3']).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Add pip + mark-seen hook**

In `CastChip.tsx`, import `selectSilverUnread` from `../../../../store/useGameStore`. Render a 10×10 gold circle at top-left when true, `data-testid={\`chip-silver-pip-${personaId}\`}`. In the tap handler (already opens DM), call `useGameStore.getState().markSilverSeen(personaId)` BEFORE `onOpen`.

Coexistence rule: coral unread-count badge (existing) is top-right; silver pip is top-left. They do not conflict.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/components/caststrip/CastChip.tsx apps/client/src/shells/pulse/components/caststrip/__tests__/CastChipSilver.test.tsx
git commit -m "feat(pulse): silver pip on cast chips; cleared on DM open"
```

---

### Task 16: `PanelButton` aggregate unread pip

**Files:**
- Modify: `apps/client/src/shells/pulse/components/header/PanelButton.tsx`
- Test: `apps/client/src/shells/pulse/components/header/__tests__/PanelButtonAggregate.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/client/src/shells/pulse/components/header/__tests__/PanelButtonAggregate.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useGameStore } from '../../../../../store/useGameStore';
import { PanelButton } from '../PanelButton';

describe('PanelButton — aggregate pip', () => {
  it('renders the aggregate unread count', () => {
    useGameStore.setState({
      gameId: 'g1', playerId: 'p1',
      pendingDmInvites: [{ senderId: 'p2', channelId: 'DM-p2-p1' }] as any,
      activeVotingCartridge: { cartridgeId: 'voting-1-MAJORITY', updatedAt: 1 } as any,
      activeGameCartridge: null, activePromptCartridge: null, activeDilemma: null,
      completedCartridges: [], lastSeenCartridge: {},
      tickerMessages: [], lastSeenSilverFrom: {},
      channels: {}, chatLog: [], lastReadTimestamp: {},
      roster: {}, revealsSeen: { elimination: {}, winner: false },
    });
    render(<PanelButton onClick={() => {}} />);
    expect(screen.getByTestId('panel-unread-pip').textContent).toBe('2');
  });

  it('collapses to 9+ for large totals', () => {
    useGameStore.setState({
      gameId: 'g1', playerId: 'p1',
      pendingDmInvites: Array.from({ length: 15 }, (_, i) => ({ senderId: `p${i}`, channelId: `DM-${i}` })) as any,
      activeVotingCartridge: null, activeGameCartridge: null, activePromptCartridge: null, activeDilemma: null,
      completedCartridges: [], lastSeenCartridge: {},
      tickerMessages: [], lastSeenSilverFrom: {},
      channels: {}, chatLog: [], lastReadTimestamp: {},
      roster: {}, revealsSeen: { elimination: {}, winner: false },
    });
    render(<PanelButton onClick={() => {}} />);
    expect(screen.getByTestId('panel-unread-pip').textContent).toBe('9+');
  });

  it('hides pip when count is 0', () => {
    useGameStore.setState({
      gameId: 'g1', playerId: 'p1',
      pendingDmInvites: [], activeVotingCartridge: null, activeGameCartridge: null,
      activePromptCartridge: null, activeDilemma: null,
      completedCartridges: [], lastSeenCartridge: {},
      tickerMessages: [], lastSeenSilverFrom: {},
      channels: {}, chatLog: [], lastReadTimestamp: {},
      roster: {}, revealsSeen: { elimination: {}, winner: false },
    });
    render(<PanelButton onClick={() => {}} />);
    expect(screen.queryByTestId('panel-unread-pip')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Wire selector into `PanelButton`**

In `apps/client/src/shells/pulse/components/header/PanelButton.tsx`, import `selectAggregatePulseUnread` from `../../../../store/useGameStore`. Use `const count = useGameStore(selectAggregatePulseUnread);` — this selector returns a number (primitive), so it's safe without `memoSelector`. Render a pip with the count; collapse to `9+` when `> 9`; hide entirely when `0`.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/components/header/PanelButton.tsx apps/client/src/shells/pulse/components/header/__tests__/PanelButtonAggregate.test.tsx
git commit -m "feat(pulse): panel button pip shows aggregate unread across all Phase 4 surfaces"
```

---

### Task 17: `useRevealQueue` + migrate `EliminationReveal` and `WinnerReveal` to store-backed reveals

**Files:**
- Create: `apps/client/src/shells/pulse/hooks/useRevealQueue.ts`
- Modify: `apps/client/src/shells/pulse/components/reveals/EliminationReveal.tsx`
- Modify: `apps/client/src/shells/pulse/components/reveals/WinnerReveal.tsx`
- Test: `apps/client/src/shells/pulse/hooks/__tests__/useRevealQueue.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/client/src/shells/pulse/hooks/__tests__/useRevealQueue.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../useRevealQueue';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1',
    roster: {
      p1: { personaName: 'You', status: 'ALIVE' },
      p2: { personaName: 'Bob', status: 'ELIMINATED', eliminatedOnDay: 3 },
    } as any,
    winner: null,
    dayIndex: 3,
    revealsSeen: { elimination: {}, winner: false },
  });
});

describe('useRevealQueue', () => {
  it('returns the next queued reveal', () => {
    const { result } = renderHook(() => useRevealQueue());
    expect(result.current.current).toEqual({ kind: 'elimination', dayIndex: 3 });
  });

  it('dismiss() marks as seen and advances to next', () => {
    const { result } = renderHook(() => useRevealQueue());
    act(() => result.current.dismiss());
    expect(useGameStore.getState().revealsSeen.elimination[3]).toBe(true);
    expect(result.current.current).toBeNull();
  });

  it('forcePlay({kind,dayIndex}) plays regardless of revealsSeen', () => {
    useGameStore.setState({ revealsSeen: { elimination: { 3: true }, winner: false } });
    const { result } = renderHook(() => useRevealQueue());
    expect(result.current.current).toBeNull();
    act(() => result.current.forcePlay({ kind: 'elimination', dayIndex: 3 }));
    expect(result.current.current).toEqual({ kind: 'elimination', dayIndex: 3 });
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement hook**

```typescript
// apps/client/src/shells/pulse/hooks/useRevealQueue.ts
import { useState, useCallback } from 'react';
import { useGameStore, selectRevealsToReplay } from '../../../store/useGameStore';

type Reveal = { kind: 'elimination' | 'winner'; dayIndex?: number };

export function useRevealQueue() {
  // selectRevealsToReplay is memoSelector-wrapped — subscribing directly is safe
  // and avoids a whole-store subscription (which would re-render on every change).
  const queue = useGameStore(selectRevealsToReplay);
  const markRevealSeen = useGameStore(s => s.markRevealSeen);
  const [forced, setForced] = useState<Reveal | null>(null);

  const current = forced ?? queue[0] ?? null;

  const dismiss = useCallback(() => {
    if (!current) return;
    markRevealSeen(current.kind, current.dayIndex);
    setForced(null);
  }, [current, markRevealSeen]);

  const forcePlay = useCallback((reveal: Reveal) => {
    setForced(reveal);
  }, []);

  return { current, dismiss, forcePlay };
}
```

Migrate `EliminationReveal.tsx` to use this:

```tsx
// EliminationReveal.tsx (rewrite)
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../../hooks/useRevealQueue';
import { PULSE_SPRING } from '../../springs';
import { getPlayerColor } from '../../colors';

export function EliminationReveal() {
  const roster = useGameStore(s => s.roster);
  const { current, dismiss } = useRevealQueue();

  if (!current || current.kind !== 'elimination') return null;

  // Find the player eliminated on this dayIndex
  const eliminatedId = Object.entries(roster)
    .find(([, p]: any) => p.status === 'ELIMINATED' && p.eliminatedOnDay === current.dayIndex)?.[0];
  if (!eliminatedId) return null;
  const player = (roster as any)[eliminatedId];
  const playerIndex = Object.keys(roster).indexOf(eliminatedId);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={dismiss}
        style={{ /* existing styles from previous impl */ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,14,0.92)', cursor: 'pointer', boxShadow: 'inset 0 0 120px rgba(255,40,40,0.15)' }}
      >
        {/* preserved motion/image/text markup from current component */}
      </motion.div>
    </AnimatePresence>
  );
}
```

**Remove** the old `SEEN_KEY` / `localStorage.setItem('pulse_elim_seen', ...)` logic — `markRevealSeen` now owns persistence under the `po-revealsSeen-*` scoped key.

Do the equivalent migration for `WinnerReveal.tsx` (creates file if missing, or refactors existing).

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/hooks/useRevealQueue.ts apps/client/src/shells/pulse/components/reveals/EliminationReveal.tsx apps/client/src/shells/pulse/components/reveals/WinnerReveal.tsx apps/client/src/shells/pulse/hooks/__tests__/useRevealQueue.test.ts
git commit -m "feat(pulse): useRevealQueue drives elimination and winner reveals from store state"
```

---

### Task 18: `PulseShell` integration — wire deep-link intent and reveals

**Files:**
- Modify: `apps/client/src/shells/pulse/PulseShell.tsx`
- Test: `apps/client/src/shells/pulse/__tests__/PulseShellIntent.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/client/src/shells/pulse/__tests__/PulseShellIntent.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useGameStore } from '../../../store/useGameStore';
import { PulseShell } from '../PulseShell';

beforeEach(() => {
  useGameStore.setState({
    gameId: 'g1', playerId: 'p1',
    roster: { p1: { personaName: 'You' }, p3: { personaName: 'Cat', status: 'ALIVE' } } as any,
    channels: { 'DM-p1-p3': { type: 'DM', memberIds: ['p1','p3'] } as any },
    chatLog: [], tickerMessages: [], completedCartridges: [],
    activeVotingCartridge: null, activeGameCartridge: null, activePromptCartridge: null, activeDilemma: null,
    lastSeenCartridge: {}, lastSeenSilverFrom: {}, lastReadTimestamp: {},
    revealsSeen: { elimination: {}, winner: false },
    pendingDmInvites: [], winner: null, dayIndex: 1,
    pendingIntent: null, pendingIntentAttempts: 0, pendingIntentFirstReceivedAt: null,
  });
});

describe('PulseShell — intent routing', () => {
  it('opens the DM sheet when a dm intent arrives via postMessage', () => {
    const { container } = render(<PulseShell playerId="p1" engine={{} as any} token="t" />);
    act(() => {
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', { data: { type: 'DEEP_LINK_INTENT', intent: { kind: 'dm', channelId: 'DM-p1-p3' } } }),
      );
    });
    // Assert DM sheet for p3 is visible — adjust selector to match existing DmSheet markup
    expect(container.querySelector('[data-testid="dm-sheet-DM-p1-p3"]')).toBeInTheDocument();
  });

  it('force-plays elimination reveal on elimination_reveal intent even if seen', () => {
    useGameStore.setState({
      revealsSeen: { elimination: { 3: true }, winner: false },
      roster: {
        p1: { personaName: 'You' },
        p2: { personaName: 'Bob', status: 'ELIMINATED', eliminatedOnDay: 3 },
      } as any,
    });
    const { container } = render(<PulseShell playerId="p1" engine={{} as any} token="t" />);
    act(() => {
      navigator.serviceWorker.dispatchEvent(
        new MessageEvent('message', { data: { type: 'DEEP_LINK_INTENT', intent: { kind: 'elimination_reveal', dayIndex: 3 } } }),
      );
    });
    expect(container.querySelector('[data-testid="elimination-reveal"]')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Wire in `PulseShell.tsx`**

```tsx
// PulseShell.tsx (additions)
import { useCallback, useState, useEffect } from 'react';
import { useDeepLinkIntent } from '../../hooks/useDeepLinkIntent';
import { useRevealQueue } from './hooks/useRevealQueue';
import type { DeepLinkIntent } from '@pecking-order/shared-types';

export function PulseShell({ playerId, engine, token }: ShellProps) {
  const store = useGameStore();
  const [dmOpen, setDmOpen] = useState<string | null>(null);  // channelId
  const [composeTarget, setComposeTarget] = useState<string | null>(null);
  const { forcePlay } = useRevealQueue();

  const resolveIntent = useCallback((intent: DeepLinkIntent, origin: 'push' | 'manual' = 'push'): boolean => {
    switch (intent.kind) {
      case 'main':
        return true;
      case 'dm': {
        if (!store.channels[intent.channelId]) return false;
        setDmOpen(intent.channelId);
        return true;
      }
      case 'dm_invite': {
        const invite = store.pendingDmInvites.find(i => i.senderId === intent.senderId);
        if (!invite) return false;
        setDmOpen(invite.channelId);
        return true;
      }
      case 'cartridge_active':
      case 'cartridge_result': {
        store.markCartridgeSeen(intent.cartridgeId);
        if (origin === 'manual') {
          // User already tapped the pill — no need to scroll/flash/toast.
          // When the cartridge overlay ships, open it unconditionally.
          return true;
        }
        // Push-driven: scroll pill into view, flash, toast so the user finds it.
        const pillEl = document.querySelector(`[data-pill-cartridge-id="${intent.cartridgeId}"]`);
        if (!pillEl) return false;
        pillEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pillEl.classList.add('pulse-highlight-flash');
        setTimeout(() => pillEl.classList.remove('pulse-highlight-flash'), 1200);
        toast('Tap to view ' + intent.cartridgeId);
        return true;
      }
      case 'elimination_reveal':
        forcePlay({ kind: 'elimination', dayIndex: intent.dayIndex });
        return true;
      case 'winner_reveal':
        forcePlay({ kind: 'winner' });
        return true;
    }
  }, [store, forcePlay]);

  // Adapter for useDeepLinkIntent (push origin only)
  useDeepLinkIntent(useCallback((intent: DeepLinkIntent) => resolveIntent(intent, 'push'), [resolveIntent]));

  // (rest of shell markup unchanged, with DmSheet receiving dmOpen)
}
```

Pass the resolver to `PulseBar` so manual pill taps flow through the same pipeline:

```tsx
<PulseBar onIntentDispatch={resolveIntent} />
```

Add CSS class `.pulse-highlight-flash` to the shell's stylesheet: 1.2s coral-glow animation.

Ensure `DmSheet` / `SocialPanel` markup contains `data-testid="dm-sheet-<channelId>"` on the opened sheet root and `EliminationReveal` contains `data-testid="elimination-reveal"` — add these test IDs as part of this task. Also, `Pill.tsx` renders `data-pill-cartridge-id={cartridgeId}` as an HTML attribute so `document.querySelector('[data-pill-cartridge-id="..."]')` works in `resolveIntent`.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/PulseShell.tsx apps/client/src/shells/pulse/components/dm-sheet/DmSheet.tsx apps/client/src/shells/pulse/components/reveals/EliminationReveal.tsx apps/client/src/shells/pulse/__tests__/PulseShellIntent.test.tsx
git commit -m "feat(pulse): PulseShell routes DeepLinkIntent to DM sheet, cartridge pill, and reveals"
```

---

## Phase 4 — Manual Verification

### Task 19: Manual verification scenarios

**No code. Walk the build in two browser profiles and confirm each scenario.**

- [ ] **Scenario A: DM deep link.**
  - Profile 1 sends DM to Profile 2; Profile 2 is backgrounded.
  - Profile 2 receives push, taps it → DM sheet opens directly to the channel.
  - Close and re-open app via home-screen icon: DM shows coral unread badge on cast chip; no intent landed.

- [ ] **Scenario B: Cartridge return after activity.**
  - Profile 1 and 2 are in game. Vote opens; Profile 2 is away.
  - After vote completes, Profile 2 returns: pulse pill shows unread dot. Tap → scroll/flash/toast interim behavior; dot clears.

- [ ] **Scenario C: Multi-device elimination reveal.**
  - Profile 2 on phone (browser/PWA) and laptop (browser) simultaneously.
  - Elimination fires; both devices play reveal.
  - Dismiss on phone. Reload laptop tab → reveal does NOT replay on laptop (localStorage already marked on first view).
  - Dismiss on laptop. Force tap the push again on phone → reveal replays (force-play honors push click).

- [ ] **Scenario D: Ticker backfill.**
  - Inject (or simulate) ~30 ticker events with timestamps spread across 40 minutes while Profile 2 is offline.
  - Profile 2 reconnects: silver pips appear on cast chips for senders within the retention window; narrator lines are in the feed.

- [ ] **Scenario E: Slow-network intent retry.**
  - In Chrome DevTools, throttle to "Slow 3G" before tapping the push.
  - Tap DM push. Verify the DM sheet opens once SYNC completes (within the 10-second / 3-attempt bound).

- [ ] **Scenario F: iOS PWA cold-start.**
  - Install PWA on iOS. Force-kill the app (swipe from app switcher). Send a DM push.
  - Tap the push notification from the lock screen.
  - Verify the app opens cold and the DM sheet renders (via `?intent=` fallback).

- [ ] **Scenario G: Aggregate pip.**
  - Generate: 2 DMs, 1 pending invite, 1 new cartridge, 1 silver transfer → verify `☰` pip shows `5`.
  - Resolve each surface in turn; verify pip decrements.
  - Generate 15 DM unreads → verify pip collapses to `9+`.

- [ ] **Commit the verification log**

Record outcomes in `docs/reports/phase4-verification-<date>.md` with pass/fail per scenario, commit:

```bash
git add docs/reports/phase4-verification-*.md
git commit -m "docs: Pulse Phase 4 manual verification results"
```

---

## Self-Review Checklist

After all tasks complete, verify:

- [ ] `CartridgeType` removed from intent types; only `CartridgeKind` ('voting'|'game'|'prompt'|'dilemma') used
- [ ] `cartridgeId` populated on every active cartridge in SYNC — grep `cartridgeId` in sync tests
- [ ] No residual `pulse_elim_seen` localStorage key references — grep
- [ ] Service worker `notificationclick` handler posts `DEEP_LINK_INTENT` to existing clients
- [ ] `?intent=` query param is cleared from history after consumption in `useDeepLinkIntent`
- [ ] All four `mark*` actions persist to `po-*-${gameId}-${playerId}` localStorage keys
- [ ] `selectAggregatePulseUnread` sums DM + invite + cartridge + silver correctly
- [ ] Priority for `selectCastChipUnreadKind` is invite > dm > silver
- [ ] `selectRevealsToReplay` is wrapped with `memoSelector` (fresh-array selector — guardrail compliance)
- [ ] No `apps/client/src/store/selectors/phase4.ts` file exists — selectors are colocated in `useGameStore.ts`
- [ ] Reveals replay force-play honored on push intent (elimination and winner)
- [ ] Phase 4 server preconditions (§0.1–§0.3) all landed in Phase 0 tasks
- [ ] Spec §6 Testing coverage: every bullet has at least one corresponding test task

If any line is un-checkable, return to that task before declaring the plan complete.
