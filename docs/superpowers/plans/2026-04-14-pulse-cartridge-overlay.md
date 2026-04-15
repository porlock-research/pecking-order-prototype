# Pulse Cartridge Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Per user preference (`memory/feedback_no_subagent_implementation.md`), implement inline in the main session — do NOT dispatch subagents for implementation.

**Goal:** Build the full-screen cartridge overlay that makes Pulse pills tappable. Every pill opens a content surface: upcoming → info splash, active → playable cartridge, completed → result card. Unblocks Phase 4 Tasks 8–19.

**Architecture:** Store holds shell-agnostic `focusedCartridge` intent; PulseShell mounts a `CartridgeOverlay` that routes by lifecycle. Manual opens animate scale-from-pill-origin; push opens fade in. Reveals z-80 still win; overlay at z-60. Cartridge content owns all touches — no swipe-to-dismiss.

**Tech Stack:** React 19, Zustand (store slice + memoSelector), framer-motion (AnimatePresence + spring), TypeScript, `@pecking-order/shared-types` (new CARTRIDGE_INFO map). Tests via vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-04-14-pulse-cartridge-overlay-design.md`

---

## Pre-flight

Assumes the following state (verified on branch `feature/pulse-phase4-catchup`):

- `packages/shared-types/src/push.ts` exports `CartridgeKind = 'voting' | 'game' | 'prompt' | 'dilemma'` and `DeepLinkIntent` (already landed in Phase 4 Task 1).
- `apps/client/src/shells/pulse/hooks/usePillStates.ts` declares `'starting'` in the `PillLifecycle` union but never assigns it (gap we close in Task 3).
- `apps/client/src/shells/pulse/springs.ts` exports `PULSE_SPRING.{bouncy, snappy, gentle, page, pop}` (Task 5 adds `exit`).
- `apps/client/src/store/useGameStore.ts` has the `memoSelector` helper (line ~67) and Plan A/Plan B/Phase 4 fields already in place.
- `useDeepLinkIntent` hook does **NOT** yet exist (Phase 4 Tasks 8–19 are paused). This plan does not depend on it.

**Local dev:** Running from the repo root (`npm run dev`). Test game `XHK33P` has an active VOTE pill. Admin endpoint: `POST http://localhost:8787/parties/game-server/<gameId>/admin` with `Authorization: Bearer dev-secret-change-me`.

**Milestones (natural break points):**
1. After Task 4 — hooks + store landed, no UI yet. Verify tests.
2. After Task 8 — pills tap and ignite. Overlay not yet rendered.
3. After Task 13 — overlay opens and routes by lifecycle. Manual smoke test in browser.
4. After Task 16 — Playwright e2e + polish. Ready to resume Phase 4.

---

## Task 1: Add `CARTRIDGE_INFO` content map

**Files:**
- Create: `packages/shared-types/src/cartridge-info.ts`
- Modify: `packages/shared-types/src/index.ts`

Content-authoring task. Define the shape and v1 tone, then fill all enum values. The four enums to cover:

- **VoteType (9):** EXECUTIONER, MAJORITY, BUBBLE, SECOND_TO_LAST, PODIUM_SACRIFICE, SHIELD, TRUST_PAIRS, DUELS, FINALS
- **GameType (25, excluding NONE):** TRIVIA, REALTIME_TRIVIA, GAP_RUN, GRID_PUSH, SEQUENCE, REACTION_TIME, COLOR_MATCH, STACKER, QUICK_MATH, SIMON_SAYS, AIM_TRAINER, BET_BET_BET, BLIND_AUCTION, KINGS_RANSOM, THE_SPLIT, TOUCH_SCREEN, SHOCKWAVE, ORBIT, BEAT_DROP, INFLATE, SNAKE, FLAPPY, COLOR_SORT, BLINK, RECALL
- **PromptType (6):** PLAYER_PICK, PREDICTION, WOULD_YOU_RATHER, HOT_TAKE, CONFESSION, GUESS_WHO
- **DilemmaType (3):** SILVER_GAMBIT, SPOTLIGHT, GIFT_OR_GRIEF

Total: 43 entries. Keys use the enum string values directly.

- [ ] **Step 1: Create the file with interface + exemplar entries**

Write `packages/shared-types/src/cartridge-info.ts`:

```typescript
import type { CartridgeKind } from './push';

export interface CartridgeInfoEntry {
  kind: CartridgeKind;
  displayName: string;
  tagline: string;        // one-line hook, ≤60 chars
  description: string;    // 2-3 sentences
  mechanics: string[];    // 3-5 bullet steps, each ≤80 chars
}

/**
 * Authored v1 copy for every cartridge type. Keyed by the enum string
 * (VoteType | GameType | PromptType | DilemmaType).
 *
 * Shell-agnostic presentation data — any shell can render these splashes.
 * Missing keys fall back to a terse splash (displayName from typeKey only).
 *
 * Tone guide: reality-TV confidence, active voice, no filler. Mechanics
 * bullets are imperative ("Pick one player", not "A player is picked").
 */
export const CARTRIDGE_INFO: Record<string, CartridgeInfoEntry> = {
  // --- Voting (9) ---
  EXECUTIONER: {
    kind: 'voting',
    displayName: 'Executioner Vote',
    tagline: 'One vote. One execution. No mercy.',
    description:
      'Everyone votes. The player with the most votes is eliminated on the spot. Tie-breakers go to the executioner — one player chosen at random.',
    mechanics: [
      'Every alive player casts one vote',
      'Highest vote count is eliminated',
      'Ties resolved by the random executioner',
      'Votes stay secret until the reveal',
    ],
  },
  // ... (8 more voting entries)

  // --- Games (25) — exemplar ---
  TRIVIA: {
    kind: 'game',
    displayName: 'Trivia Blitz',
    tagline: 'Fastest right answer wins.',
    description:
      'Rapid-fire questions pulled from the cast\'s pre-game interviews. Speed matters as much as accuracy. Silver to the top three.',
    mechanics: [
      'Five rounds, one question each',
      'Pick from four answers',
      'Fastest correct answer scores most',
      'Top 3 split the silver pot',
    ],
  },
  // ... (24 more game entries)

  // --- Prompts (6) — exemplar ---
  WOULD_YOU_RATHER: {
    kind: 'prompt',
    displayName: 'Would You Rather',
    tagline: 'Pick your poison.',
    description:
      'An impossible choice. Your answer is public. Disagreements start fights — which is the point.',
    mechanics: [
      'Read the two options',
      'Pick one (you cannot abstain)',
      'Answers revealed to everyone',
      'Discuss in chat — silver for the loudest takes',
    ],
  },
  // ... (5 more prompt entries)

  // --- Dilemmas (3) — exemplar ---
  SILVER_GAMBIT: {
    kind: 'dilemma',
    displayName: 'Silver Gambit',
    tagline: 'Keep it all or split it all.',
    description:
      'You and one other player are offered a pot of silver. Both cooperate and split it evenly. One defects and takes it all. Both defect and nobody wins.',
    mechanics: [
      'Two players paired in secret',
      'Each chooses: SPLIT or STEAL',
      'SPLIT + SPLIT → even share',
      'STEAL + SPLIT → stealer takes all',
      'STEAL + STEAL → nobody wins',
    ],
  },
  // ... (2 more dilemma entries)
};
```

- [ ] **Step 2: Fill remaining 39 entries**

Author the remaining entries following the tone shown above. Use the existing `GAME_TYPE_INFO` map in `packages/shared-types/src/game-type-info.ts` as a seed for game descriptions — it already has one-liners for each game; expand them into the full v1 shape.

Constraint: every enum value above MUST have an entry. No gaps. No TBD taglines. The fallback path exists for future enum additions, not for laziness.

- [ ] **Step 3: Re-export from shared-types index**

Modify `packages/shared-types/src/index.ts`. Find the existing `GAME_TYPE_INFO` export (around line 13) and add next to it:

```typescript
export { CARTRIDGE_INFO } from './cartridge-info';
export type { CartridgeInfoEntry } from './cartridge-info';
```

- [ ] **Step 4: Build shared-types**

Run: `cd packages/shared-types && npm run build`
Expected: clean build, no TS errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/src/cartridge-info.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): CARTRIDGE_INFO map for cartridge overlay splashes"
```

---

## Task 2: Extend `useCountdown` to return urgency

**Files:**
- Modify: `apps/client/src/hooks/useCountdown.ts`
- Test: `apps/client/src/hooks/__tests__/useCountdown.test.ts` (create if missing)

Current signature returns `string | null`. Spec §2 needs `{ label, urgent }` so the overlay header can switch to red coloring at <60s remaining without parsing the label.

Backwards-compatibility: grep for existing callers first — they all consume the string. Changing the return type is a breaking change, so:

- [ ] **Step 1: Find existing callers**

Run: Grep for `useCountdown(` in `apps/client/src/` — content mode — and note every call site. If any shell code outside Pulse depends on the string return, we preserve backward compat by adding a sibling hook instead of changing `useCountdown`.

Decision rule: if there are ≤2 callers, modify the signature and update them. If >2 callers or any Vivid/Classic consumers, add `useCountdownWithUrgency` as a sibling and leave `useCountdown` alone.

- [ ] **Step 2 (path A — ≤2 callers): Modify the signature**

Update `apps/client/src/hooks/useCountdown.ts`:

```typescript
export interface CountdownResult {
  label: string | null;  // formatted "HH:MM:SS" or "MM:SS", null when not counting
  urgent: boolean;       // true when remaining < 60s
}

export function useCountdown(target: 'group' | 'dm'): CountdownResult {
  // ... existing derivations unchanged ...

  if (isOpen || !targetTimestamp) return { label: null, urgent: false };

  const diff = Math.max(0, targetTimestamp - now);
  if (diff <= 0) return { label: null, urgent: false };

  // ... existing formatting block ...
  const urgent = diff < 60_000;
  return { label, urgent };
}
```

Update all call sites found in Step 1 from `const cd = useCountdown('dm')` to `const { label: cd } = useCountdown('dm')`.

- [ ] **Step 2 (path B — >2 callers): Add sibling hook**

Add below the existing `useCountdown`:

```typescript
export interface CountdownResult {
  label: string | null;
  urgent: boolean;
}

export function useCountdownWithUrgency(targetTimestamp: number | null): CountdownResult {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetTimestamp) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (!targetTimestamp) return { label: null, urgent: false };
  const diff = Math.max(0, targetTimestamp - now);
  if (diff <= 0) return { label: null, urgent: false };

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const label = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
  return { label, urgent: diff < 60_000 };
}
```

The overlay header consumes `useCountdownWithUrgency` directly with its own `targetTimestamp` (derived from the cartridge's deadline field). `useCountdown` (the one tied to group/dm openings) stays as-is.

- [ ] **Step 3: Write a unit test**

Create or append to `apps/client/src/hooks/__tests__/useCountdown.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountdownWithUrgency } from '../useCountdown';

describe('useCountdownWithUrgency', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns null label when target is null', () => {
    const { result } = renderHook(() => useCountdownWithUrgency(null));
    expect(result.current.label).toBeNull();
    expect(result.current.urgent).toBe(false);
  });

  it('returns non-urgent at >60s remaining', () => {
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    const target = new Date('2026-04-14T12:02:00Z').getTime();
    const { result } = renderHook(() => useCountdownWithUrgency(target));
    expect(result.current.urgent).toBe(false);
    expect(result.current.label).toBe('02:00');
  });

  it('returns urgent at <60s remaining', () => {
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    const target = new Date('2026-04-14T12:00:30Z').getTime();
    const { result } = renderHook(() => useCountdownWithUrgency(target));
    expect(result.current.urgent).toBe(true);
    expect(result.current.label).toBe('00:30');
  });

  it('becomes urgent as time passes', () => {
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
    const target = new Date('2026-04-14T12:01:05Z').getTime();
    const { result, rerender } = renderHook(() => useCountdownWithUrgency(target));
    expect(result.current.urgent).toBe(false);
    act(() => {
      vi.advanceTimersByTime(10_000);  // 10s later → 55s remaining
    });
    rerender();
    expect(result.current.urgent).toBe(true);
  });
});
```

- [ ] **Step 4: Run test and build**

```bash
cd apps/client && npx vitest run src/hooks/__tests__/useCountdown.test.ts && npm run build
```
Expected: 4 tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/hooks/useCountdown.ts apps/client/src/hooks/__tests__/useCountdown.test.ts
git commit -m "feat(client): useCountdownWithUrgency — { label, urgent } for overlay header"
```

---

## Task 3: Detect ADR-128 'starting' lifecycle gap

**Files:**
- Modify: `apps/client/src/shells/pulse/hooks/usePillStates.ts`
- Test: `apps/client/src/shells/pulse/hooks/__tests__/usePillStates.test.ts` (create)

`PillLifecycle` already includes `'starting'` and `Pill.tsx` styles it identically to `'just-started'`. But no producer assigns it. The spec's splash treatment ("Starting now…" microcopy during SYNC gap) depends on this. Fix: when a manifest timeline entry has fired (`eventTime <= now`) but the corresponding active cartridge slot is still null, mark the pill `'starting'`.

- [ ] **Step 1: Read the current `usePillStates` body**

Verify the shape. Current logic (around line 111-134 of `usePillStates.ts`) iterates `day.timeline`, filters to `eventTime > now`, and only emits `'upcoming'` pills for future events. Past-but-unfulfilled events are silently dropped.

- [ ] **Step 2: Modify the timeline iteration**

Replace the inner timeline loop (the `for (const ev of day.timeline as any[])` block) with:

```typescript
for (const ev of day.timeline as any[]) {
  const kind = ACTION_TO_KIND[ev.action];
  if (!kind) continue;

  let eventTime: number | null = null;
  if (ev.time?.includes('T')) {
    eventTime = new Date(ev.time).getTime();
  }
  if (eventTime === null) continue;

  // If an active pill of this kind already exists in `pills`, skip.
  const alreadyActiveOfKind = pills.some(
    p => p.kind === kind && p.lifecycle !== 'completed' && p.lifecycle !== 'upcoming',
  );
  if (alreadyActiveOfKind) continue;

  if (eventTime > now) {
    // Upcoming
    pills.push({
      id: `upcoming-${ev.action}-${ev.time}`,
      kind,
      label: ACTION_LABELS[ev.action] || kind,
      lifecycle: 'upcoming',
      timeRemaining: Math.floor((eventTime - now) / 1000),
    });
  } else {
    // Past-due event with no active slot populated yet — ADR-128 SYNC gap.
    // Emit a 'starting' pill so the overlay can render the info splash with
    // "Starting now…" microcopy; it auto-swaps to the playable view when
    // the active slot arrives on the next SYNC.
    pills.push({
      id: `starting-${ev.action}-${ev.time}`,
      kind,
      label: ACTION_LABELS[ev.action] || kind,
      lifecycle: 'starting',
    });
  }
}
```

- [ ] **Step 3: Write unit tests**

Create `apps/client/src/shells/pulse/hooks/__tests__/usePillStates.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePillStates } from '../usePillStates';
import { useGameStore } from '../../../../store/useGameStore';

function setStore(partial: Partial<ReturnType<typeof useGameStore.getState>>) {
  useGameStore.setState(partial as any);
}

describe('usePillStates — ADR-128 gap detection', () => {
  beforeEach(() => {
    useGameStore.setState({
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemma: null,
      completedCartridges: [],
      manifest: null,
      dayIndex: 1,
    } as any);
    vi.setSystemTime(new Date('2026-04-14T12:00:00Z'));
  });

  it('emits starting pill when timeline event has fired but slot is empty', () => {
    setStore({
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [
            { action: 'OPEN_VOTING', time: '2026-04-14T11:59:00Z' },  // 1 min ago
          ],
        }],
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current).toHaveLength(1);
    expect(result.current[0].lifecycle).toBe('starting');
    expect(result.current[0].kind).toBe('voting');
  });

  it('emits upcoming pill when timeline event is still in the future', () => {
    setStore({
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [
            { action: 'OPEN_VOTING', time: '2026-04-14T12:05:00Z' },  // 5 min away
          ],
        }],
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    expect(result.current[0].lifecycle).toBe('upcoming');
  });

  it('suppresses starting when the active slot is populated', () => {
    setStore({
      activeVotingCartridge: { phase: 'VOTING', voteType: 'EXECUTIONER', eligibleVoters: [], votes: {} } as any,
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [
            { action: 'OPEN_VOTING', time: '2026-04-14T11:59:00Z' },
          ],
        }],
      } as any,
    });
    const { result } = renderHook(() => usePillStates());
    // One pill from the active slot, none from the past-due timeline event
    expect(result.current.filter(p => p.kind === 'voting')).toHaveLength(1);
    expect(result.current[0].lifecycle).not.toBe('starting');
  });
});
```

- [ ] **Step 4: Run tests and client build**

```bash
cd apps/client && npx vitest run src/shells/pulse/hooks/__tests__/usePillStates.test.ts && npm run build
```
Expected: 3 tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/hooks/usePillStates.ts apps/client/src/shells/pulse/hooks/__tests__/usePillStates.test.ts
git commit -m "feat(pulse): emit 'starting' pill during ADR-128 SYNC gap"
```

---

## Task 4: Add `focusedCartridge` store slice

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`
- Test: `apps/client/src/store/__tests__/focusedCartridge.test.ts` (create)

Shell-agnostic attention intent. Session-scoped (not persisted). No auto-coordination with `silverTarget` / `dmTarget` / `socialPanelOpen` — see spec §2.

- [ ] **Step 1: Add the state fields + action types**

In `useGameStore.ts`, find the `GameState` interface (around line 104). Add after the Phase 4 fields:

```typescript
  // Cartridge overlay — shell-agnostic attention intent (not persisted)
  focusedCartridge: {
    cartridgeId: string;
    cartridgeKind: CartridgeKind;
    origin: 'manual' | 'push';
  } | null;
```

In the actions section of the interface:

```typescript
  focusCartridge: (cartridgeId: string, cartridgeKind: CartridgeKind, origin: 'manual' | 'push') => void;
  unfocusCartridge: () => void;
```

- [ ] **Step 2: Import CartridgeKind**

At the top of `useGameStore.ts`, find the existing `shared-types` imports and add `CartridgeKind`:

```typescript
import type { CartridgeKind, DeepLinkIntent } from '@pecking-order/shared-types';
```

(`DeepLinkIntent` is already imported; add `CartridgeKind` alongside.)

- [ ] **Step 3: Add initial state + action implementations**

Find the `create<GameState>()((set, get) => ({` block (the default state). Add after `pendingIntentFirstReceivedAt: null,`:

```typescript
  focusedCartridge: null,
```

Find the actions section. Add next to other actions:

```typescript
  focusCartridge: (cartridgeId, cartridgeKind, origin) => {
    set({ focusedCartridge: { cartridgeId, cartridgeKind, origin } });
  },

  unfocusCartridge: () => {
    set({ focusedCartridge: null });
  },
```

- [ ] **Step 4: Write the unit test**

Create `apps/client/src/store/__tests__/focusedCartridge.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('focusedCartridge store slice', () => {
  beforeEach(() => {
    useGameStore.setState({ focusedCartridge: null });
  });

  it('defaults to null', () => {
    expect(useGameStore.getState().focusedCartridge).toBeNull();
  });

  it('focusCartridge sets the slice', () => {
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    expect(useGameStore.getState().focusedCartridge).toEqual({
      cartridgeId: 'voting-1-EXECUTIONER',
      cartridgeKind: 'voting',
      origin: 'manual',
    });
  });

  it('unfocusCartridge clears the slice', () => {
    useGameStore.getState().focusCartridge('game-1-TRIVIA', 'game', 'push');
    useGameStore.getState().unfocusCartridge();
    expect(useGameStore.getState().focusedCartridge).toBeNull();
  });

  it('focusing a different cartridge replaces the slice (no queue)', () => {
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    useGameStore.getState().focusCartridge('game-1-TRIVIA', 'game', 'push');
    expect(useGameStore.getState().focusedCartridge?.cartridgeId).toBe('game-1-TRIVIA');
    expect(useGameStore.getState().focusedCartridge?.origin).toBe('push');
  });

  it('does NOT auto-clear silverTarget / dmTarget (PulseShell-local state)', () => {
    // focusedCartridge is store state; silverTarget/dmTarget are PulseShell-local.
    // Per spec §2, no coordination between them in v1.
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    // Nothing to assert on PulseShell locals from here — this test documents intent.
    expect(useGameStore.getState().focusedCartridge).not.toBeNull();
  });
});
```

- [ ] **Step 5: Run test + build**

```bash
cd apps/client && npx vitest run src/store/__tests__/focusedCartridge.test.ts && npm run build
```
Expected: 5 tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/client/src/store/useGameStore.ts apps/client/src/store/__tests__/focusedCartridge.test.ts
git commit -m "feat(pulse): focusedCartridge store slice + focusCartridge/unfocusCartridge"
```

**🎯 Milestone 1 — hooks + store landed, no UI yet. Tests green.**

---

## Task 5: Add `PULSE_SPRING.exit` config

**Files:**
- Modify: `apps/client/src/shells/pulse/springs.ts`

- [ ] **Step 1: Add the exit spring**

Replace `springs.ts` contents:

```typescript
export const PULSE_SPRING = {
  bouncy: { stiffness: 400, damping: 25 },
  snappy: { stiffness: 500, damping: 30 },
  gentle: { stiffness: 150, damping: 20 },
  page: { stiffness: 300, damping: 28, mass: 0.8 },
  pop: { stiffness: 600, damping: 15 },
  /** Overlay exit — softer than snappy so dismissals feel calm, not aggressive. */
  exit: { stiffness: 260, damping: 30, mass: 0.9 },
} as const;

export const PULSE_TAP = {
  button: { scale: 0.95 },
  card: { scale: 0.97 },
  pill: { scale: 0.98 },
} as const;
```

- [ ] **Step 2: Build + commit**

```bash
cd apps/client && npm run build
git add apps/client/src/shells/pulse/springs.ts
git commit -m "feat(pulse): PULSE_SPRING.exit for overlay dismissal"
```

---

## Task 6: `usePillOrigin` — ref for entry animation

**Files:**
- Create: `apps/client/src/shells/pulse/components/cartridge-overlay/usePillOrigin.ts`

Pulse-local presentational storage for the origin rect. A module-level ref (not in Zustand) because coordinates are pure presentation and must not enter the shell-agnostic store.

- [ ] **Step 1: Create the hook**

Write `apps/client/src/shells/pulse/components/cartridge-overlay/usePillOrigin.ts`:

```typescript
/**
 * Pulse-local storage for the pill-origin rect used by the cartridge overlay's
 * scale-from-origin entry animation. Intentionally NOT in Zustand — coordinates
 * are pure presentation and the store is shell-agnostic.
 *
 * Usage:
 *   const { set, consume } = usePillOrigin();
 *   // In Pill.onClick: set(rect); then dispatch focusCartridge.
 *   // In CartridgeOverlay on mount: const rect = consume();
 *   // consume() returns the rect and clears it — one-shot per open.
 */
let storedRect: DOMRect | null = null;

export function usePillOrigin() {
  return {
    set(rect: DOMRect | null) {
      storedRect = rect;
    },
    consume(): DOMRect | null {
      const r = storedRect;
      storedRect = null;
      return r;
    },
    peek(): DOMRect | null {
      return storedRect;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/cartridge-overlay/usePillOrigin.ts
git commit -m "feat(pulse): usePillOrigin — presentational ref for overlay entry animation"
```

---

## Task 7: Wire pill tap → `focusCartridge` with origin capture

**Files:**
- Modify: `apps/client/src/shells/pulse/components/PulseBar.tsx`
- Modify: `apps/client/src/shells/pulse/components/Pill.tsx`

The pill already accepts `onTap` as a prop but `PulseBar` never passes it. Thread it through, capture the rect, dispatch `focusCartridge`.

- [ ] **Step 1: Update `PulseBar.tsx`**

Replace `apps/client/src/shells/pulse/components/PulseBar.tsx`:

```typescript
import { useRef } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import { usePillStates, type PillState } from '../hooks/usePillStates';
import { usePillOrigin } from './cartridge-overlay/usePillOrigin';
import { Pill } from './Pill';

/**
 * PulseBar shows cartridge pills in chronological order.
 * When no cartridges are active, the bar renders nothing —
 * CastStrip owns presence now (Phase 1.5).
 */
export function PulseBar() {
  const pills = usePillStates();
  const focusCartridge = useGameStore(s => s.focusCartridge);
  const dayIndex = useGameStore(s => s.dayIndex);
  const { set: setPillOrigin } = usePillOrigin();
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (pills.length === 0) return null;

  const handleTap = (pill: PillState) => {
    const el = pillRefs.current[pill.id];
    if (el) setPillOrigin(el.getBoundingClientRect());
    const cartridgeId = pillToCartridgeId(pill, dayIndex);
    focusCartridge(cartridgeId, pill.kind, 'manual');
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        height: 48,
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        scrollbarWidth: 'none',
      }}
    >
      {pills.map(pill => (
        <Pill
          key={pill.id}
          pill={pill}
          onTap={() => handleTap(pill)}
          buttonRef={(el) => { pillRefs.current[pill.id] = el; }}
        />
      ))}
    </div>
  );
}

/**
 * Build the stable cartridgeId matching the server scheme from Phase 4 §0.1:
 *   `${kind}-${dayIndex}-${typeKey}`
 *
 * typeKey resolution order per kind:
 *   voting   → cartridge.mechanism | cartridge.voteType
 *   game     → cartridge.gameType
 *   prompt   → cartridge.promptType
 *   dilemma  → cartridge.dilemmaType
 *
 * For upcoming/starting pills (no live cartridge data), typeKey falls back
 * to 'UNKNOWN'. The overlay handles that case gracefully — it can still
 * render the info splash using displayName/fallback copy.
 */
function pillToCartridgeId(pill: PillState, dayIndex: number): string {
  const c = pill.cartridgeData as Record<string, unknown> | undefined;
  const typeKey =
    (c?.mechanism as string) ||
    (c?.voteType as string) ||
    (c?.gameType as string) ||
    (c?.promptType as string) ||
    (c?.dilemmaType as string) ||
    'UNKNOWN';
  return `${pill.kind}-${dayIndex}-${typeKey}`;
}
```

- [ ] **Step 2: Update `Pill.tsx` to accept `buttonRef`**

Modify the `PillProps` interface in `apps/client/src/shells/pulse/components/Pill.tsx`:

```typescript
interface PillProps {
  pill: PillState;
  mini?: boolean;
  onTap?: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}
```

And thread it into the motion.button:

```typescript
export function Pill({ pill, mini, onTap, buttonRef }: PillProps) {
  // ... existing body unchanged ...
  return (
    <motion.button
      ref={buttonRef}
      whileTap={PULSE_TAP.pill}
      // ... rest unchanged
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/client && npm run build
```
Expected: clean build.

- [ ] **Step 4: Manual smoke**

Run `npm run dev` from repo root. Open `http://localhost:5173/game/XHK33P?shell=pulse` with any of the three test magic links (ask user for fresh links if stale). Tap the active VOTE pill. Nothing visual happens yet (overlay not built), but in browser devtools console verify the store state changes:

```js
useGameStore.getState().focusedCartridge
// → { cartridgeId: 'voting-<N>-<MECHANISM>', cartridgeKind: 'voting', origin: 'manual' }
```

(Pop the store into global for inspection if needed: `window.__store = useGameStore;` in a temporary `console.log` inside the shell.)

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/components/PulseBar.tsx apps/client/src/shells/pulse/components/Pill.tsx
git commit -m "feat(pulse): pill tap dispatches focusCartridge + captures origin rect"
```

---

## Task 8: Pill ignition animation

**Files:**
- Modify: `apps/client/src/shells/pulse/components/Pill.tsx`
- Modify: `apps/client/src/shells/pulse/pulse-theme.css`

One-shot animation when a pill transitions `upcoming` → `just-started`. Framer-motion's `key` prop plus a brief `animate` sequence keyed on the lifecycle transition.

- [ ] **Step 1: Add an ignition CSS keyframe**

Append to `apps/client/src/shells/pulse/pulse-theme.css`:

```css
/* One-shot animation fired when a pill transitions from upcoming → just-started.
   Used by Pill.tsx via a className toggle keyed on the lifecycle string. */
@keyframes pulse-pill-ignition {
  0%   { transform: scale(1);    box-shadow: none; }
  45%  { transform: scale(1.06); box-shadow: 0 0 12px var(--pulse-accent-glow); }
  100% { transform: scale(1);    box-shadow: none; }
}
.pulse-pill-ignition {
  animation: pulse-pill-ignition 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

- [ ] **Step 2: Track lifecycle transitions in Pill.tsx**

At the top of the `Pill` component body (above the styles), add:

```typescript
  const prevLifecycle = useRef(pill.lifecycle);
  const [igniting, setIgniting] = useState(false);

  useEffect(() => {
    const prev = prevLifecycle.current;
    prevLifecycle.current = pill.lifecycle;
    // Ignite on: upcoming/starting → just-started.
    if ((prev === 'upcoming' || prev === 'starting') && pill.lifecycle === 'just-started') {
      setIgniting(true);
      const t = setTimeout(() => setIgniting(false), 450);
      return () => clearTimeout(t);
    }
  }, [pill.lifecycle]);
```

Import `useEffect`, `useRef`, `useState` from React at the top.

Then in the `className` of the `motion.button`, add the conditional class:

```typescript
      className={igniting ? 'pulse-pill-ignition' : undefined}
```

- [ ] **Step 3: Build**

```bash
cd apps/client && npm run build
```
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/components/Pill.tsx apps/client/src/shells/pulse/pulse-theme.css
git commit -m "feat(pulse): pill ignition animation on upcoming → just-started"
```

**🎯 Milestone 2 — pills tap and ignite. Overlay not yet rendered.**

---

## Task 9: `CartridgeOverlayHeader` component

**Files:**
- Create: `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeOverlayHeader.tsx`

Close button + cartridge label with kind-color dot + countdown timer (when a deadline is known).

- [ ] **Step 1: Create the component**

Write `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeOverlayHeader.tsx`:

```typescript
import { motion } from 'framer-motion';
import type { CartridgeKind } from '@pecking-order/shared-types';
import { PULSE_TAP } from '../../springs';
import { useCountdownWithUrgency } from '../../../../hooks/useCountdown';

const KIND_COLORS: Record<CartridgeKind, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

interface Props {
  kind: CartridgeKind;
  label: string;
  /** Deadline epoch ms for active cartridges with a timer; null otherwise. */
  deadline: number | null;
  onClose: () => void;
}

export function CartridgeOverlayHeader({ kind, label, deadline, onClose }: Props) {
  const { label: timerLabel, urgent } = useCountdownWithUrgency(deadline);
  const dotColor = KIND_COLORS[kind];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingLeft: 8,
        paddingRight: 16,
        height: 44,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
      }}
    >
      <motion.button
        onClick={onClose}
        whileTap={PULSE_TAP.button}
        aria-label="Close cartridge"
        style={{
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
          border: '1px solid var(--pulse-border)',
          borderRadius: 999,
          color: 'var(--pulse-text-1)',
          cursor: 'pointer',
        }}
      >
        <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--pulse-text-1)',
            fontFamily: 'var(--po-font-body)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
      </div>

      {timerLabel && (
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 14,
            fontWeight: 700,
            color: urgent ? 'var(--pulse-accent)' : dotColor,
            letterSpacing: 0.5,
            flexShrink: 0,
          }}
        >
          {timerLabel}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

```bash
cd apps/client && npm run build
```
Expected: clean build. If `useCountdownWithUrgency` was not added (Task 2 Path A), update the import and signature accordingly.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeOverlayHeader.tsx
git commit -m "feat(pulse): CartridgeOverlayHeader with kind-dot label and urgent timer"
```

---

## Task 10: `CartridgeInfoSplash` component

**Files:**
- Create: `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeInfoSplash.tsx`

Renders the upcoming / starting-state info view.

- [ ] **Step 1: Create the component**

Write `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeInfoSplash.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { CARTRIDGE_INFO, type CartridgeInfoEntry, type CartridgeKind } from '@pecking-order/shared-types';

interface Props {
  kind: CartridgeKind;
  typeKey: string;
  fallbackLabel: string;
  /** If set, countdown shows "starts in MM:SS". If null, shows "Starting now…". */
  scheduledAt: number | null;
  /** Whether the active slot is populated — swaps microcopy to "Starting now…". */
  isStarting: boolean;
}

const KIND_COLORS: Record<CartridgeKind, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

function useLiveCountdown(targetMs: number | null): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  if (!targetMs) return null;
  const diff = Math.max(0, targetMs - now);
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function CartridgeInfoSplash({ kind, typeKey, fallbackLabel, scheduledAt, isStarting }: Props) {
  const entry: CartridgeInfoEntry | undefined = CARTRIDGE_INFO[typeKey];
  const countdown = useLiveCountdown(isStarting ? null : scheduledAt);
  const dotColor = KIND_COLORS[kind];

  const displayName = entry?.displayName ?? fallbackLabel;
  const tagline = entry?.tagline;
  const description = entry?.description;
  const mechanics = entry?.mechanics ?? [];

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        color: 'var(--pulse-text-1)',
      }}
    >
      {/* Status chip: "Starts in 4:23" or "Starting now…" */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: `${dotColor}1A`,
          border: `1px solid ${dotColor}40`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: dotColor,
        }}
      >
        {isStarting ? 'Starting now…' : countdown ? `Starts in ${countdown}` : 'Scheduled'}
      </div>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 900,
          fontFamily: 'var(--po-font-display, var(--po-font-body))',
          textAlign: 'center',
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {displayName}
      </h1>

      {tagline && (
        <p
          style={{
            fontSize: 15,
            fontStyle: 'italic',
            color: 'var(--pulse-text-2)',
            textAlign: 'center',
            margin: 0,
            maxWidth: 340,
          }}
        >
          {tagline}
        </p>
      )}

      {description && (
        <p
          style={{
            fontSize: 14,
            color: 'var(--pulse-text-2)',
            textAlign: 'center',
            margin: 0,
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}

      {mechanics.length > 0 && (
        <div
          style={{
            marginTop: 8,
            width: '100%',
            maxWidth: 360,
            padding: 16,
            borderRadius: 14,
            background: 'var(--pulse-surface-2)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'var(--pulse-text-3)',
              marginBottom: 10,
            }}
          >
            How it works
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mechanics.map((m, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 13,
                  color: 'var(--pulse-text-1)',
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    flexShrink: 0,
                    borderRadius: '50%',
                    background: `${dotColor}22`,
                    color: dotColor,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!entry && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--pulse-text-3)',
            fontStyle: 'italic',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          Starts soon.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd apps/client && npm run build
git add apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeInfoSplash.tsx
git commit -m "feat(pulse): CartridgeInfoSplash for upcoming/starting cartridges"
```

---

## Task 11: `PlayableCartridgeMount` component

**Files:**
- Create: `apps/client/src/shells/pulse/components/cartridge-overlay/PlayableCartridgeMount.tsx`

Router to the shell-agnostic panels. Panels read active state from the store directly — this component just picks which panel to lazy-load based on `kind`.

- [ ] **Step 1: Create the component**

Write `apps/client/src/shells/pulse/components/cartridge-overlay/PlayableCartridgeMount.tsx`:

```typescript
import React, { Suspense } from 'react';
import type { CartridgeKind } from '@pecking-order/shared-types';
import type { GameEngine } from '../../../types';

const VotingPanel  = React.lazy(() => import('../../../../components/panels/VotingPanel'));
const GamePanel    = React.lazy(() => import('../../../../components/panels/GamePanel'));
const PromptPanel  = React.lazy(() => import('../../../../components/panels/PromptPanel'));
const DilemmaPanel = React.lazy(() => import('../../../../components/panels/DilemmaPanel'));

interface Props {
  kind: CartridgeKind;
  engine: GameEngine;
}

/**
 * Routes to the shell-agnostic cartridge panel for the given kind. Panels read
 * their own active state from the store; this component does not pass cartridge
 * data via props. Completed cartridges MUST NOT route through here — use
 * CartridgeResultCard instead (spec §3 "Routing constraint").
 */
export function PlayableCartridgeMount({ kind, engine }: Props) {
  return (
    <div style={{ flex: 1, overflow: 'auto' }} data-testid={`cartridge-panel-${kind}`}>
      <Suspense fallback={null}>
        {kind === 'voting'  && <VotingPanel engine={engine as any} />}
        {kind === 'game'    && <GamePanel engine={engine as any} />}
        {kind === 'prompt'  && <PromptPanel engine={engine as any} />}
        {kind === 'dilemma' && <DilemmaPanel engine={engine as any} />}
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Verify panel imports exist**

Confirm `apps/client/src/components/panels/{VotingPanel,GamePanel,PromptPanel,DilemmaPanel}.tsx` all exist:

```bash
ls apps/client/src/components/panels/
```

Expected: `DilemmaPanel.tsx  GamePanel.tsx  PerkPanel.tsx  PromptPanel.tsx  VotingPanel.tsx`

- [ ] **Step 3: Build + commit**

```bash
cd apps/client && npm run build
git add apps/client/src/shells/pulse/components/cartridge-overlay/PlayableCartridgeMount.tsx
git commit -m "feat(pulse): PlayableCartridgeMount routes active cartridges to shared panels"
```

---

## Task 12: `CartridgeResultCard` component (v1 — basic per-kind)

**Files:**
- Create: `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeResultCard.tsx`

Pulse-native result summary. v1 is basic — one card per kind with the most-obvious summary fields. The detailed per-kind result schema is a plan-level item (spec §11); for v1 we render a best-effort view with a clear "See more details in chat" footer so players aren't left empty-handed when the snapshot shape is unfamiliar.

- [ ] **Step 1: Create the component**

Write `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeResultCard.tsx`:

```typescript
import type { CartridgeKind } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';

interface Props {
  cartridgeId: string;
  kind: CartridgeKind;
}

const KIND_COLORS: Record<CartridgeKind, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

/**
 * Pulse-native result summary for a completed cartridge. v1 renders a basic
 * kind-themed card pulling the most-obvious summary fields from the
 * CompletedCartridge.snapshot (typed `any` today — see spec §11 plan item
 * "CompletedCartridgeSnapshot schema enumeration").
 *
 * Per spec §3 "Routing constraint": this component MUST be the only path
 * for completed cartridges. Do NOT fall through to PlayableCartridgeMount.
 */
export function CartridgeResultCard({ cartridgeId, kind }: Props) {
  const entry = useGameStore(s => s.completedCartridges.find(c => c.key === cartridgeId));
  const roster = useGameStore(s => s.roster);
  const dotColor = KIND_COLORS[kind];

  if (!entry) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>Result unavailable.</p>
      </div>
    );
  }

  const snap: any = entry.snapshot ?? {};

  // Best-effort field resolution — see plan-level item for typed schema work.
  const eliminated: string | undefined = snap.eliminatedPlayerId || snap.eliminated?.playerId;
  const winner: string | undefined = snap.winnerPlayerId || snap.winner?.playerId;
  const silverRewards: Record<string, number> = snap.silverRewards || {};
  const topScorers = Object.entries(silverRewards)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const title =
    kind === 'voting'  ? 'Vote Resolved'
    : kind === 'game'  ? 'Game Over'
    : kind === 'prompt'? 'Activity Resolved'
    : 'Dilemma Revealed';

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        color: 'var(--pulse-text-1)',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: `${dotColor}1A`,
          border: `1px solid ${dotColor}40`,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: dotColor,
        }}
      >
        Completed
      </div>

      <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, textAlign: 'center' }}>{title}</h1>

      {/* Voting: eliminated player */}
      {kind === 'voting' && eliminated && roster[eliminated] && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--pulse-text-3)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Eliminated
          </p>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--pulse-accent)', margin: '6px 0 0' }}>
            {roster[eliminated].personaName}
          </p>
        </div>
      )}

      {/* Game / Dilemma: winner */}
      {(kind === 'game' || kind === 'dilemma') && winner && roster[winner] && (
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--pulse-text-3)', margin: 0, textTransform: 'uppercase', letterSpacing: 1 }}>
            Winner
          </p>
          <p style={{ fontSize: 20, fontWeight: 800, color: dotColor, margin: '6px 0 0' }}>
            {roster[winner].personaName}
          </p>
        </div>
      )}

      {/* Top 3 silver rewards (common to game, dilemma, prompt) */}
      {topScorers.length > 0 && (
        <div
          style={{
            width: '100%',
            maxWidth: 360,
            padding: 16,
            borderRadius: 14,
            background: 'var(--pulse-surface-2)',
            border: '1px solid var(--pulse-border)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: 'var(--pulse-text-3)',
              marginBottom: 10,
            }}
          >
            Top rewards
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topScorers.map(([pid, amt], i) => (
              <li
                key={pid}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  color: 'var(--pulse-text-1)',
                }}
              >
                <span>{i + 1}. {roster[pid]?.personaName ?? pid}</span>
                <span style={{ color: 'var(--pulse-gold, #ffd700)', fontWeight: 700 }}>+{amt} silver</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--pulse-text-3)', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>
        Full details in chat.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

```bash
cd apps/client && npm run build
git add apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeResultCard.tsx
git commit -m "feat(pulse): CartridgeResultCard v1 — kind-themed result summary"
```

---

## Task 13: `CartridgeOverlay` — the router + sheet + scrim + motion

**Files:**
- Create: `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeOverlay.tsx`
- Test: `apps/client/src/shells/pulse/components/cartridge-overlay/__tests__/CartridgeOverlay.test.tsx` (create)

The heart of the feature. Subscribes to `focusedCartridge`, resolves the lifecycle, renders the right inner view, handles entry animation (manual: scale-from-origin; push: fade), handles dismissal.

- [ ] **Step 1: Create the router component**

Write `apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeOverlay.tsx`:

```typescript
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useGameStore } from '../../../../store/useGameStore';
import { usePillStates, type PillState } from '../../hooks/usePillStates';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { usePulse } from '../../PulseShell';
import { usePillOrigin } from './usePillOrigin';
import { CartridgeOverlayHeader } from './CartridgeOverlayHeader';
import { CartridgeInfoSplash } from './CartridgeInfoSplash';
import { PlayableCartridgeMount } from './PlayableCartridgeMount';
import { CartridgeResultCard } from './CartridgeResultCard';

/**
 * Full-screen cartridge presentation surface for Pulse. Subscribes to
 * `focusedCartridge` and routes to the right inner view by lifecycle:
 *   upcoming / starting → CartridgeInfoSplash
 *   active (any phase) → PlayableCartridgeMount
 *   completed          → CartridgeResultCard
 *   truly missing      → toast + unfocus (no overlay rendered)
 *
 * Spec §3 routing constraint: completed cartridges never go through the
 * panel layer. See CartridgeResultCard for why.
 */
export function CartridgeOverlay() {
  const focused = useGameStore(s => s.focusedCartridge);
  const unfocus = useGameStore(s => s.unfocusCartridge);
  const pills = usePillStates();
  const { engine } = usePulse();
  const { consume } = usePillOrigin();

  // Resolve the focused cartridge's current lifecycle from the pill list.
  // Matches by id-prefix: pill ids are {kind} / `upcoming-...` / `starting-...` /
  // `completed-{kind}-...`. The canonical match is by kind alone for active pills.
  const match = useMemo<PillState | undefined>(() => {
    if (!focused) return undefined;
    return pills.find(p => {
      // Active pill: its id equals the bare kind, or its cartridgeData typeKey matches.
      if (p.lifecycle !== 'completed' && p.lifecycle !== 'upcoming' && p.lifecycle !== 'starting') {
        return p.kind === focused.cartridgeKind;
      }
      // Completed pill: cartridgeId exists on completedCartridges; match by kind.
      if (p.lifecycle === 'completed') {
        return p.kind === focused.cartridgeKind && focused.cartridgeId.startsWith(`${focused.cartridgeKind}-`);
      }
      // upcoming / starting
      return p.kind === focused.cartridgeKind;
    });
  }, [focused, pills]);

  // Compute origin rect ONCE per mount. Consume clears the stored rect.
  const originRect = useMemo(() => (focused ? consume() : null), [focused?.cartridgeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!focused) return null;

  // Missing-entirely path: no pill resolves this cartridge. Toast + unfocus.
  if (!match) {
    // Defer to next tick so we don't setState during render.
    queueMicrotask(() => {
      toast.error('Activity unavailable');
      unfocus();
    });
    return null;
  }

  const { cartridgeKind: kind, origin } = focused;
  const isPush = origin === 'push';

  // Entry/exit variants
  const entryVariant = isPush
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.1 } }
    : {
        initial: { scale: 0.92, opacity: 0 },
        animate: { scale: 1, opacity: 1 },
        transition: PULSE_SPRING.snappy,
      };

  const transformOrigin = originRect && !isPush
    ? `${originRect.left + originRect.width / 2}px ${originRect.top + originRect.height / 2}px`
    : 'center';

  // Route inner content by lifecycle
  const lifecycle = match.lifecycle;
  const isUpcoming = lifecycle === 'upcoming' || lifecycle === 'starting';
  const isCompleted = lifecycle === 'completed';

  // Upcoming scheduling + typeKey for splash
  const schedEntry = upcomingScheduling(match);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={unfocus}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)',
          zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        initial={entryVariant.initial}
        animate={entryVariant.animate}
        exit={{ opacity: 0, scale: 0.96, transition: PULSE_SPRING.exit }}
        transition={entryVariant.transition}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          zIndex: PULSE_Z.drawer, overflow: 'hidden',
          transformOrigin,
        }}
      >
        <CartridgeOverlayHeader
          kind={kind}
          label={resolveLabel(match)}
          deadline={resolveDeadline(match)}
          onClose={unfocus}
        />

        {isUpcoming ? (
          <CartridgeInfoSplash
            kind={kind}
            typeKey={resolveTypeKey(match)}
            fallbackLabel={match.label}
            scheduledAt={schedEntry}
            isStarting={lifecycle === 'starting'}
          />
        ) : isCompleted ? (
          <CartridgeResultCard cartridgeId={focused.cartridgeId} kind={kind} />
        ) : (
          <PlayableCartridgeMount kind={kind} engine={engine} />
        )}
      </motion.div>
    </>
  );
}

// --- helpers ---

function resolveLabel(pill: PillState): string {
  return pill.label;
}

function resolveTypeKey(pill: PillState): string {
  const c = pill.cartridgeData as Record<string, unknown> | undefined;
  return (
    (c?.mechanism as string) ||
    (c?.voteType as string) ||
    (c?.gameType as string) ||
    (c?.promptType as string) ||
    (c?.dilemmaType as string) ||
    // For upcoming/starting pills, try to recover from the id suffix.
    pillIdToTypeKey(pill) ||
    'UNKNOWN'
  );
}

function pillIdToTypeKey(pill: PillState): string | null {
  // Upcoming ids: `upcoming-OPEN_VOTING-<time>` — no typeKey embedded.
  // Starting ids: same shape. Plan-level item: surface manifest-declared
  // voteType/gameType on the timeline entry so splashes can be specific.
  return null;
}

function resolveDeadline(pill: PillState): number | null {
  // Active cartridges expose deadlines via their snapshot. For v1 we read common
  // field names; plan-level "CompletedCartridgeSnapshot schema" work will tighten this.
  const c = pill.cartridgeData as Record<string, unknown> | undefined;
  if (!c) return null;
  if (typeof c.deadline === 'number') return c.deadline as number;
  if (typeof c.endsAt === 'number') return c.endsAt as number;
  if (typeof c.phaseEndsAt === 'number') return c.phaseEndsAt as number;
  return null;
}

function upcomingScheduling(pill: PillState): number | null {
  if (pill.lifecycle !== 'upcoming' || typeof pill.timeRemaining !== 'number') return null;
  return Date.now() + pill.timeRemaining * 1000;
}
```

- [ ] **Step 2: Write unit tests**

Create `apps/client/src/shells/pulse/components/cartridge-overlay/__tests__/CartridgeOverlay.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CartridgeOverlay } from '../CartridgeOverlay';
import { useGameStore } from '../../../../../store/useGameStore';
import { PulseContext } from '../../../PulseShell';

const mockEngine = {} as any;

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <PulseContext.Provider value={{
      engine: mockEngine,
      playerId: 'p1',
      openSendSilver: () => {},
      openNudge: () => {},
      openDM: () => {},
      openSocialPanel: () => {},
    }}>
      {children}
    </PulseContext.Provider>
  );
}

describe('CartridgeOverlay', () => {
  beforeEach(() => {
    useGameStore.setState({
      focusedCartridge: null,
      activeVotingCartridge: null,
      activeGameCartridge: null,
      activePromptCartridge: null,
      activeDilemma: null,
      completedCartridges: [],
      manifest: null,
      dayIndex: 1,
      playerId: 'p1',
      roster: {
        p1: { personaName: 'You', status: 'ALIVE', silver: 0 } as any,
        p2: { personaName: 'Brenda', status: 'ALIVE', silver: 0 } as any,
      },
    } as any);
  });

  it('renders nothing when focusedCartridge is null', () => {
    const { container } = render(<Wrap><CartridgeOverlay /></Wrap>);
    expect(container.firstChild).toBeNull();
  });

  it('renders info splash for upcoming pill', () => {
    useGameStore.setState({
      manifest: {
        scheduling: 'PRE_SCHEDULED',
        days: [{
          timeline: [{ action: 'OPEN_VOTING', time: new Date(Date.now() + 300_000).toISOString() }],
        }],
      } as any,
    });
    useGameStore.getState().focusCartridge('voting-1-UNKNOWN', 'voting', 'manual');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    // Upcoming splash renders the fallback label when typeKey is UNKNOWN
    expect(screen.getByText(/Vote/i)).toBeInTheDocument();
    expect(screen.getByText(/Starts in/i)).toBeInTheDocument();
  });

  it('renders playable panel for active voting pill', () => {
    useGameStore.setState({
      activeVotingCartridge: {
        phase: 'VOTING', mechanism: 'EXECUTIONER', voteType: 'EXECUTIONER',
        eligibleVoters: ['p1', 'p2'], votes: {},
      } as any,
    });
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    expect(screen.getByTestId('cartridge-panel-voting')).toBeInTheDocument();
  });

  it('renders result card for completed cartridge', () => {
    useGameStore.setState({
      completedCartridges: [{
        kind: 'voting',
        key: 'voting-1-EXECUTIONER',
        completedAt: Date.now(),
        snapshot: { mechanism: 'EXECUTIONER', eliminatedPlayerId: 'p2' },
      }] as any,
    });
    useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'manual');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    expect(screen.getByText(/Vote Resolved/i)).toBeInTheDocument();
    expect(screen.getByText(/Brenda/)).toBeInTheDocument();
  });

  it('unfocuses and toasts on missing cartridge id', async () => {
    useGameStore.getState().focusCartridge('voting-999-GHOST', 'voting', 'push');
    render(<Wrap><CartridgeOverlay /></Wrap>);
    // queueMicrotask fires after render
    await act(() => Promise.resolve());
    expect(useGameStore.getState().focusedCartridge).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests + build**

```bash
cd apps/client && npx vitest run src/shells/pulse/components/cartridge-overlay/__tests__/CartridgeOverlay.test.tsx && npm run build
```
Expected: 5 tests pass. If the toast assertion fails because `sonner` is unavailable in jsdom, stub it with `vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))` at the top of the test file and assert the mock was called.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/components/cartridge-overlay/CartridgeOverlay.tsx apps/client/src/shells/pulse/components/cartridge-overlay/__tests__/CartridgeOverlay.test.tsx
git commit -m "feat(pulse): CartridgeOverlay router + entry/exit motion"
```

---

## Task 14: Mount the overlay in `PulseShell`

**Files:**
- Modify: `apps/client/src/shells/pulse/PulseShell.tsx`

- [ ] **Step 1: Import and mount**

Add the import near the other component imports (~line 28):

```typescript
import { CartridgeOverlay } from './components/cartridge-overlay/CartridgeOverlay';
```

In the JSX, after the `<AnimatePresence>` blocks for `DmSheet` and `SocialPanel` and before the reveals, add another `<AnimatePresence>` block:

```tsx
        <AnimatePresence>
          {useGameStore.getState().focusedCartridge && <CartridgeOverlay key="cartridge-overlay" />}
        </AnimatePresence>
```

That subscription is stale (reads once). Replace with a hook-based version:

```tsx
{/* At the top of PulseShell body, near other subscriptions */}
const focusedCartridge = useGameStore(s => s.focusedCartridge);

{/* And in the JSX: */}
        <AnimatePresence>
          {focusedCartridge && <CartridgeOverlay key="cartridge-overlay" />}
        </AnimatePresence>
```

- [ ] **Step 2: Verify typecheck + build**

```bash
cd apps/client && npm run build
```
Expected: clean build.

- [ ] **Step 3: Manual smoke test in browser**

Start dev server if not running (`npm run dev`). Open `http://localhost:5173/game/XHK33P?shell=pulse` with a magic link. Test each path:

1. Tap the active VOTE pill → overlay opens with the voting panel (scale-from-pill-origin animation). Tap vote → behaves normally. Tap header `‹` → overlay closes (fade out).
2. Open browser console: `useGameStore.getState().focusCartridge('voting-1-EXECUTIONER', 'voting', 'push')` → overlay opens with no scale animation (fade only).
3. `useGameStore.getState().focusCartridge('voting-999-GHOST', 'voting', 'push')` → toast appears + `focusedCartridge` cleared.
4. Tap scrim area (top 40px) → overlay closes.
5. If the test game has an upcoming pill, tap it → splash renders with countdown.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/PulseShell.tsx
git commit -m "feat(pulse): mount CartridgeOverlay in PulseShell"
```

**🎯 Milestone 3 — overlay opens and routes by lifecycle. Manual smoke passes.**

---

## Task 15: Verify reveal layering + phase transitions

**Files:**
- None (verification only; may modify test fixtures if needed)

Spec §7 claims reveals (z-80) layer above the overlay (z-60). Verify in-browser.

- [ ] **Step 1: Trigger elimination reveal with overlay open**

With a test game in a voting state:
1. Tap the voting pill to open the overlay.
2. In another terminal, fire an elimination via the admin endpoint:

```bash
curl -X POST http://localhost:8787/parties/game-server/<gameId>/admin \
  -H "Authorization: Bearer dev-secret-change-me" \
  -H "Content-Type: application/json" \
  -d '{"action": "ELIMINATE_PLAYER", "targetId": "p2"}'
```

Expected: `EliminationReveal` component renders above the overlay. Dismissing the reveal returns to the overlay (overlay's content untouched).

- [ ] **Step 2: Trigger phase transition**

With overlay open:

```bash
curl -X POST http://localhost:8787/parties/game-server/<gameId>/admin \
  -H "Authorization: Bearer dev-secret-change-me" \
  -H "Content-Type: application/json" \
  -d '{"action": "NEXT_STAGE"}'
```

Expected: `PhaseTransition` splash renders above the overlay. Dismissing returns to overlay. If the phase change completes the active cartridge, the overlay's content swaps in place to the result card (spec §3 swap-in-place from Q2).

- [ ] **Step 3: No commit unless a bug is fixed**

If layering is wrong, inspect `PULSE_Z` values in `zIndex.ts` and the z-index usage in reveal components. A common pitfall is a missing `position: fixed` allowing the overlay to escape its stacking context. Document the fix as a separate commit.

---

## Task 16: Playwright e2e smoke

**Files:**
- Create: `e2e/tests/pulse-cartridge-overlay.spec.ts`

End-to-end verification of the three core paths: pill tap opens overlay, scrim tap closes it, completed cartridge shows the result card.

- [ ] **Step 1: Create the spec**

Write `e2e/tests/pulse-cartridge-overlay.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { createTestGame, injectTimelineEvent } from '../fixtures/game-setup';

const CLIENT = 'http://localhost:5173';

test.describe('Pulse cartridge overlay', () => {
  test('tap active voting pill opens overlay with voting panel', async ({ page }) => {
    const { gameId, magicLinks } = await createTestGame({
      shell: 'pulse',
      playerCount: 4,
      voteType: 'EXECUTIONER',
    });

    // Open voting state
    await injectTimelineEvent(gameId, { action: 'OPEN_VOTING' });

    await page.goto(magicLinks[0]);
    await page.waitForSelector('[data-testid="pulse-bar"], .pulse-shell', { timeout: 10_000 });

    // The voting pill should be tappable
    const votingPill = page.locator('button').filter({ hasText: /Executioner|Vote/i }).first();
    await votingPill.click();

    // Overlay appears with the voting panel
    await expect(page.getByTestId('cartridge-panel-voting')).toBeVisible({ timeout: 5_000 });
  });

  test('scrim tap closes the overlay', async ({ page }) => {
    const { gameId, magicLinks } = await createTestGame({
      shell: 'pulse',
      playerCount: 4,
      voteType: 'EXECUTIONER',
    });
    await injectTimelineEvent(gameId, { action: 'OPEN_VOTING' });
    await page.goto(magicLinks[0]);
    await page.waitForSelector('.pulse-shell');

    const votingPill = page.locator('button').filter({ hasText: /Executioner|Vote/i }).first();
    await votingPill.click();
    await expect(page.getByTestId('cartridge-panel-voting')).toBeVisible();

    // Click in the top 40px scrim area
    await page.mouse.click(200, 20);
    await expect(page.getByTestId('cartridge-panel-voting')).not.toBeVisible({ timeout: 2_000 });
  });

  test('header close button closes the overlay', async ({ page }) => {
    const { gameId, magicLinks } = await createTestGame({
      shell: 'pulse',
      playerCount: 4,
      voteType: 'EXECUTIONER',
    });
    await injectTimelineEvent(gameId, { action: 'OPEN_VOTING' });
    await page.goto(magicLinks[0]);
    await page.waitForSelector('.pulse-shell');

    const votingPill = page.locator('button').filter({ hasText: /Executioner|Vote/i }).first();
    await votingPill.click();
    await expect(page.getByTestId('cartridge-panel-voting')).toBeVisible();

    await page.locator('button[aria-label="Close cartridge"]').click();
    await expect(page.getByTestId('cartridge-panel-voting')).not.toBeVisible({ timeout: 2_000 });
  });
});
```

Note: if `createTestGame` doesn't accept a `shell` parameter today, append `?shell=pulse` to the magic link manually. Confirm the fixture shape in `e2e/fixtures/game-setup.ts` before running.

- [ ] **Step 2: Run the spec**

From repo root, with dev servers already running:

```bash
npx playwright test e2e/tests/pulse-cartridge-overlay.spec.ts --headed
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/pulse-cartridge-overlay.spec.ts
git commit -m "test(e2e): cartridge overlay open/close paths"
```

**🎯 Milestone 4 — Playwright green. Ready to resume Phase 4 Tasks 8–19.**

---

## Post-Implementation

- Update `memory/project_pulse_shell.md`: move "Next priority — cartridge overlay" to a Done section; note Phase 4 Tasks 8–19 are unblocked.
- Verify the Pulse CLAUDE.md (`apps/client/src/shells/pulse/CLAUDE.md`) still accurately describes overlay behavior. If `PULSE_SPRING.exit` was a new export, touch up the motion line. No other changes expected — the CLAUDE.md was already updated to document cartridge overlay rules ahead of this plan.
- Update `docs/superpowers/specs/2026-04-14-pulse-phase4-catchup-design.md` §2 delivery #4: replace the interim "scroll pill + toast" branch with a one-liner saying the overlay now handles it via `focusCartridge`. Small edit; commit separately.
- **Do not push or merge.** Per project rules, wait for explicit user approval.

## Spec Coverage Check

Cross-referencing spec sections to tasks:

| Spec section | Task(s) |
|---|---|
| §1 Architecture — store slice | 4 |
| §1 Architecture — Pulse rendering | 13, 14 |
| §1 Architecture — origin rect (Pulse-local) | 6, 7 |
| §2 Overlay anatomy — header | 9 |
| §2 Overlay anatomy — scrim / dismissal | 13 |
| §2 Coordination with DM/Social | 4 (test documents the decision) |
| §3 Lifecycle-state matrix | 13 (router) + 10/11/12 (inner views) |
| §3 Routing constraint | 12 (result card never routes to panels) |
| §4 CARTRIDGE_INFO | 1 |
| §5 Motion — entry (manual + push) | 13 |
| §5 Motion — exit asymmetric | 5 (spring), 13 (wire-up) |
| §5 Motion — pill ignition | 8 |
| §5 Motion — reveal layering | 15 (verification) |
| §6 Dismissal paths | 13, 14 |
| §7 Reveals + phase transitions | 15 |
| §8 Phase 4 integration | Docs update in Post-Implementation; actual hook lands when Phase 4 resumes |
| §9 Files to Create/Modify | All tasks |
| §9a Testing — unit | 2, 3, 4, 13 |
| §9a Testing — Playwright | 16 |
| §10 Success criteria | Validated in Task 14 manual smoke + Task 15 + Task 16 |
| §11 Plan-Level items | Noted inline where they surface (CartridgeResultCard comment, resolveDeadline helper) |

Gaps: none. Every spec requirement has a corresponding task.

## Handoff — 2026-04-15 13:30

**Completed this session (Tasks 1–14 of the plan):**

- Task 1 — CARTRIDGE_INFO map with 43 v1 entries (`732ffb1`)
- Task 2 — `useCountdownWithUrgency` sibling hook (`bc26cf4`)
- Task 3 — `'starting'` lifecycle detection in `usePillStates` (`4bdd966`)
- Task 4 — `focusedCartridge` store slice + tests (`543e24a`)
- Tasks 5–8 — `PULSE_SPRING.exit`, `usePillOrigin` ref, pill tap wiring, pill ignition animation (`b2be72f`)
- Tasks 9–14 — overlay components + mount in PulseShell (`ece02ca`)
- Post-demo fix — pretty pill labels through `CARTRIDGE_INFO` for all four kinds and completed cartridges; Playwright spec committed (`3f8a9f7`)

All 17 client unit tests passing. Build clean.

**Known uncommitted working-tree edits that belong to the user, not the next agent:**

- Root `CLAUDE.md`, `apps/client/CLAUDE.md`, `apps/lobby/CLAUDE.md` — shell CLAUDE.md hierarchy restructure
- Untracked per-shell CLAUDE.md files under `apps/client/src/shells/{classic,pulse,vivid}/`
- `.claude/guardrails/finite-claude-md-placement.rule`
- `docs/machines/*.json`, `docs/reports/engagement-*.html` — regen/report artifacts

Leave those alone.

**Next step — pick in priority order:**

1.  **Task 15** (small): manual reveal layering verification. With the overlay open, fire an `ELIMINATE_PLAYER` via the admin endpoint; confirm the elimination reveal layers above the overlay (z-80 vs 60) and dismissing returns to overlay with state intact. ~2 min.
2.  **Task 16** (small): run the committed Playwright spec: `npx playwright test e2e/tests/pulse-cartridge-overlay.spec.ts --headed`. Tighten selectors if any flake.
3.  **Investigate "only 2 pills showing"** in the demo game. User reported during a PM demo that a 3-cartridge game (vote + TRIVIA + WOULD_YOU_RATHER) only showed 2 pills. Likely a spawn race in the admin-inject sequence (see `/tmp/po-create-demo.cjs`); confirm via WS SYNC (GET /state only shows L2).
4.  **Resume Phase 4 Tasks 8–19**: push + SW intent plumbing + per-surface UI + reveals. `useDeepLinkIntent` doesn't exist yet; when it lands it should call `focusCartridge(...)` for `cartridge_active` / `cartridge_result` intents (the overlay is ready).

**Branch:** `feature/pulse-phase4-catchup`. NOT pushed. NOT merged. Don't push or merge without explicit user approval.

**Local dev:** `npm run dev` from repo root (client :5173, game-server :8787, lobby :3000). Admin endpoint: `POST http://localhost:8787/parties/game-server/<gameId>/admin` with `Authorization: Bearer dev-secret-change-me`.
