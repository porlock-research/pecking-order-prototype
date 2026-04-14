# Pulse DM Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **User preference on record: no subagents for implementation on this branch — drive code changes directly in the main session.**

**Goal:** Ship Pulse DM polish — capability-aware hint chips, out-of-slots feedback, mention tap → openDM, image variant fallback, DM sheet status ring + typing indicator — on `feature/pulse-shell-phase1`. One session; ~1 day implementation.

**Architecture:** Capabilities become the unified contract for channel-scoped UI + auth (with NUDGE as a deliberate player-scoped exception per spec Architecture note). Server adds `NUDGE` + `WHISPER` to the capability union and sets them on MAIN/DM. Client HintChips becomes capability-driven; navigational chips stay channel-type-gated. Other polish items are localized edits to specific Pulse components.

**Tech Stack:** React 19 + TypeScript, Zustand, Framer Motion, `sonner` toasts, `@solar-icons/react`. Vitest for unit tests in both server and client. No Tailwind in the Pulse shell — inline styles keyed off `--pulse-*` CSS variables.

**Authoritative spec:** `docs/superpowers/specs/2026-04-13-pulse-dm-polish-design.md`

**Sibling plan (lands after this):** `docs/superpowers/plans/2026-04-13-pulse-dm-flow-extensions.md` (to be written)

**User workflow constraints (same as Phase 1.5):**
- Ask before merging or pushing. Never push/merge without explicit approval.
- Run `npm run build` in affected apps before committing; fix all type errors.
- Verify dev-server working directory before manual test: `lsof -i :5173 :8787 | grep LISTEN` → `lsof -p <pid> | grep cwd`. Must match this branch's worktree.
- Commit style: imperative, scoped `feat(pulse): …` / `refactor(pulse): …` / `chore(pulse): …`, include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`.
- Stop at the end of each numbered Task for user check-in before proceeding.

**Out of scope (deferred):** Add-member-to-DM, 1:1 → group promotion (sibling plan). Push/toast dedup. Narrator threshold validation. Motion polish. Group rename/leave/remove/transfer.

---

## File Structure

### Modify (server)
- `packages/shared-types/src/index.ts` — extend `ChannelCapability` union
- `apps/game-server/src/machines/l3-session.ts:~112` — MAIN channel caps
- `apps/game-server/src/machines/actions/l3-social.ts` — DM caps (2 branches), `isWhisperAllowed` guard
- `apps/game-server/src/demo/demo-seed.ts`, `apps/game-server/src/demo/demo-machine.ts` — update demo channel caps to match

### Modify (client)
- `apps/client/src/shells/pulse/components/input/HintChips.tsx` — capability-aware visibility
- `apps/client/src/shells/pulse/components/dm-sheet/DmInput.tsx` — wire HintChips in
- `apps/client/src/shells/pulse/components/caststrip/CastChip.tsx` — slot-guard shake + toast
- `apps/client/src/shells/pulse/components/input/MentionRenderer.tsx` — tap handler
- `apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx` — use PersonaImage, wrap in DmStatusRing
- `apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx` — use PersonaImage
- `apps/client/src/shells/pulse/components/dm-sheet/DmSheet.tsx` — mount TypingIndicator with channelId
- `apps/client/src/shells/pulse/components/chat/TypingIndicator.tsx` — parameterize channelId
- `apps/client/src/shells/pulse/components/chat/ChatView.tsx` — pass `channelId="MAIN"` to generalized TypingIndicator
- `apps/client/src/store/useGameStore.ts` — add `selectChipSlotStatus` selector

### Create (client)
- `apps/client/src/shells/pulse/components/common/PersonaImage.tsx`
- `apps/client/src/shells/pulse/components/dm-sheet/DmStatusRing.tsx`

### Test (server + client)
- `apps/game-server/src/machines/__tests__/l3-channel-capabilities.test.ts` (new)
- `apps/client/src/shells/pulse/components/input/__tests__/HintChips.test.tsx` (new)
- `apps/client/src/store/__tests__/chipSlotStatus.test.ts` (new) — extend existing test file if present

---

## Task Ordering

1. Capability union + channel caps (server) — foundation
2. Harden `isWhisperAllowed` + server tests
3. `HintChips` capability-aware (client unit-tested)
4. `DmInput` wires in HintChips
5. Out-of-slots shake + toast on `CastChip` (client unit-tested selector)
6. `MentionRenderer` tap → openDM
7. `PersonaImage` with variant fallback + cache
8. `TypingIndicator` generalization
9. `DmStatusRing` + DM sheet header integration
10. `/silver` picker from MAIN — verify never emits `channel: 'MAIN'`
11. Final build + manual verification pass

---

## Task 1: Capability union + channel caps

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `apps/game-server/src/machines/l3-session.ts:~112`
- Modify: `apps/game-server/src/machines/actions/l3-social.ts` (lines ~50, ~59 — both `createDmChannel` branches)
- Modify: `apps/game-server/src/demo/demo-seed.ts:~141,~154`, `apps/game-server/src/demo/demo-machine.ts:~77,~81,~111,~115`

- [ ] **Step 1.1: Extend the capability union**

Edit `packages/shared-types/src/index.ts` around line 510:

```ts
export type ChannelCapability =
  | 'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES' | 'GAME_ACTIONS'
  | 'NUDGE'     // MAIN + 1:1 DM — UI affordance flag (NUDGE event is player-scoped)
  | 'WHISPER';  // MAIN only — whisper is MAIN-anonymous
```

- [ ] **Step 1.2: Update MAIN channel creation**

Edit `apps/game-server/src/machines/l3-session.ts` around line 115 (inside `createInitialContext` or equivalent):

```ts
channels: {
  'MAIN': {
    id: 'MAIN', type: 'MAIN' as const,
    memberIds: Object.keys(input.roster || {}),
    createdBy: 'SYSTEM', createdAt: Date.now(),
    capabilities: ['CHAT', 'REACTIONS', 'SILVER_TRANSFER', 'NUDGE', 'WHISPER'] as const,
  },
},
```

- [ ] **Step 1.3: Update DM channel creation (both invite and non-invite branches)**

Edit `apps/game-server/src/machines/actions/l3-social.ts`. Inside `createDmChannel`, BOTH branches (invite-mode ~line 50 and non-invite-mode ~line 59):

```ts
capabilities: ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE'],
```

`createGroupDmChannel` (~line 351) stays `['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER']` — unchanged.

- [ ] **Step 1.4: Update demo seeds + demo machine**

Grep for the literal `['CHAT', 'SILVER_TRANSFER'` in `apps/game-server/src/demo/` — it appears in `demo-seed.ts:154`, `demo-machine.ts:81`, `demo-machine.ts:115`.

For the DM-type entries (demo-seed:154, demo-machine:81), change to `['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE']`.
For the GROUP_DM entry (demo-machine:115), leave as `['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER']`.

Also check for `capabilities:` on the demo MAIN channel (`demo-seed.ts:141` area). If MAIN has explicit caps in demo, update to `['CHAT', 'REACTIONS', 'SILVER_TRANSFER', 'NUDGE', 'WHISPER']`.

- [ ] **Step 1.5: Type-check the monorepo**

Run: `cd apps/game-server && npm run build`
Expected: clean. Exhaustive-switch errors on `ChannelCapability` would show here.

Run: `cd apps/client && npm run build`
Expected: clean.

If either fails with "NUDGE is not assignable to type ChannelCapability", the types package wasn't re-picked — run `npm run build` from repo root first.

- [ ] **Step 1.6: Commit**

```bash
git add packages/shared-types/src/index.ts apps/game-server/src/machines/l3-session.ts apps/game-server/src/machines/actions/l3-social.ts apps/game-server/src/demo/
git commit -m "$(cat <<'EOF'
feat(shared-types): add NUDGE + WHISPER channel capabilities

MAIN channel now carries ['CHAT','REACTIONS','SILVER_TRANSFER','NUDGE','WHISPER'].
DM channel gains 'NUDGE'. GROUP_DM unchanged (no nudge affordance in groups).
Demo seed + demo machine updated to match.

NUDGE is a UI affordance flag only — the NUDGE event is player-scoped and
isNudgeAllowed stays as-is. WHISPER hardening follows in the next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Harden `isWhisperAllowed` with MAIN-cap check + tests

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts` (`isWhisperAllowed` around line 595)
- Create: `apps/game-server/src/machines/__tests__/l3-channel-capabilities.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `apps/game-server/src/machines/__tests__/l3-channel-capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { dailySessionMachine } from '../l3-session';
import { Events } from '@pecking-order/shared-types';

const makeRoster = () => ({
  p1: { id: 'p1', personaName: 'Alice', status: 'ALIVE' as const },
  p2: { id: 'p2', personaName: 'Bob', status: 'ALIVE' as const },
});

describe('Channel capabilities', () => {
  it('MAIN channel is created with NUDGE and WHISPER capabilities', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 0, roster: makeRoster() },
    }).start();
    const caps = actor.getSnapshot().context.channels['MAIN'].capabilities;
    expect(caps).toContain('NUDGE');
    expect(caps).toContain('WHISPER');
    expect(caps).toContain('SILVER_TRANSFER');
  });

  it('DM channel is created with NUDGE capability', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 0, roster: makeRoster() },
    }).start();
    actor.send({
      type: Events.Social.CREATE_CHANNEL,
      senderId: 'p1',
      memberIds: ['p2'],
    } as any);
    const channels = actor.getSnapshot().context.channels;
    const dm = Object.values(channels).find((c: any) => c.type === 'DM') as any;
    expect(dm).toBeDefined();
    expect(dm.capabilities).toContain('NUDGE');
  });

  it('WHISPER is rejected when MAIN loses WHISPER capability', () => {
    const actor = createActor(dailySessionMachine, {
      input: { dayIndex: 0, roster: makeRoster() },
    }).start();
    // Direct context mutation via test harness — simulate cap removal.
    const snapshot = actor.getSnapshot();
    (snapshot.context.channels['MAIN'] as any).capabilities = ['CHAT', 'REACTIONS'];

    actor.send({
      type: Events.Social.WHISPER,
      senderId: 'p1',
      targetId: 'p2',
      text: 'hi',
    } as any);

    const chatLog = actor.getSnapshot().context.chatLog;
    const whispers = chatLog.filter((m: any) => m.whisperTarget);
    expect(whispers).toHaveLength(0);
  });
});
```

- [ ] **Step 2.2: Run the test — first two should pass (from Task 1), third should fail**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-channel-capabilities.test.ts`

Expected:
- "MAIN channel is created with NUDGE and WHISPER capabilities" — PASS
- "DM channel is created with NUDGE capability" — PASS
- "WHISPER is rejected when MAIN loses WHISPER capability" — FAIL (whisper currently processes regardless of cap)

- [ ] **Step 2.3: Harden `isWhisperAllowed`**

Edit `apps/game-server/src/machines/actions/l3-social.ts`, `isWhisperAllowed` (around line 595):

```ts
isWhisperAllowed: ({ context, event }: any) => {
  if (event.type !== Events.Social.WHISPER) return false;
  // Consistency check: whispers require MAIN to carry the WHISPER capability.
  // If MAIN loses the cap (test harness or future feature flag), whispers stop.
  if (!channelHasCapability(context.channels, 'MAIN', 'WHISPER')) return false;
  const { senderId, targetId, text } = event;
  if (senderId === targetId) return false;
  if (!text || text.length === 0) return false;
  // ...keep remaining existing checks (alive status etc.)
  return true;
},
```

Preserve any existing checks below the cap check; insert the cap check as the first gating condition after the event-type match.

- [ ] **Step 2.4: Run the test — all three pass**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-channel-capabilities.test.ts`
Expected: 3 passed.

- [ ] **Step 2.5: Run the full server test suite to catch regressions**

Run: `cd apps/game-server && npm run test`
Expected: no new failures. If existing tests fail because they created MAIN without the new caps, they'll fail at the new cap check. Update those tests to include `WHISPER` in MAIN's caps if they construct context manually. Do NOT relax the guard.

- [ ] **Step 2.6: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-social.ts apps/game-server/src/machines/__tests__/l3-channel-capabilities.test.ts
git commit -m "$(cat <<'EOF'
feat(game-server): harden isWhisperAllowed with MAIN cap check

Whispers now require MAIN to carry the WHISPER capability. Consistency
check, not a runtime feature — MAIN always has the cap in production.
Lets us drop the cap in tests / future feature flags without whispers
silently leaking through.

isNudgeAllowed left unchanged: NUDGE is player-scoped (no channelId on
the event). NUDGE capability on channels remains a UI affordance flag.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Capability-aware `HintChips`

**Files:**
- Modify: `apps/client/src/shells/pulse/components/input/HintChips.tsx`
- Create: `apps/client/src/shells/pulse/components/input/__tests__/HintChips.test.tsx`

- [ ] **Step 3.1: Write the failing test**

Create `apps/client/src/shells/pulse/components/input/__tests__/HintChips.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HintChips } from '../HintChips';

describe('HintChips visibility', () => {
  const noop = () => {};

  it('MAIN shows /silver /nudge /whisper /dm (no @mention)', () => {
    render(
      <HintChips
        onSelect={noop}
        channelType="MAIN"
        capabilities={['CHAT', 'REACTIONS', 'SILVER_TRANSFER', 'NUDGE', 'WHISPER']}
      />,
    );
    expect(screen.getByText('/silver')).toBeTruthy();
    expect(screen.getByText('/nudge')).toBeTruthy();
    expect(screen.getByText('/whisper')).toBeTruthy();
    expect(screen.getByText('/dm')).toBeTruthy();
    expect(screen.queryByText('@mention')).toBeNull();
  });

  it('1:1 DM shows /silver /nudge only', () => {
    render(
      <HintChips
        onSelect={noop}
        channelType="DM"
        capabilities={['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER', 'NUDGE']}
      />,
    );
    expect(screen.getByText('/silver')).toBeTruthy();
    expect(screen.getByText('/nudge')).toBeTruthy();
    expect(screen.queryByText('/whisper')).toBeNull();
    expect(screen.queryByText('/dm')).toBeNull();
    expect(screen.queryByText('@mention')).toBeNull();
  });

  it('GROUP_DM shows /silver and @mention', () => {
    render(
      <HintChips
        onSelect={noop}
        channelType="GROUP_DM"
        capabilities={['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER']}
      />,
    );
    expect(screen.getByText('/silver')).toBeTruthy();
    expect(screen.getByText('@mention')).toBeTruthy();
    expect(screen.queryByText('/nudge')).toBeNull();
  });

  it('GAME_DM with no caps renders nothing', () => {
    const { container } = render(
      <HintChips onSelect={noop} channelType="GAME_DM" capabilities={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
```

Note: if `@testing-library/react` isn't wired up in `apps/client`, check its `package.json` and `vitest.config.ts`. If absent, either (a) install it (`npm i -D @testing-library/react @testing-library/jest-dom jsdom` in `apps/client` and add `test: { environment: 'jsdom' }` to vitest config), or (b) fall back to snapshot-style assertions via direct JSX inspection. Prefer (a) — teams often need this anyway. Check first before installing.

- [ ] **Step 3.2: Run the test — should fail**

Run: `cd apps/client && npx vitest run src/shells/pulse/components/input/__tests__/HintChips.test.tsx`
Expected: 4 failures — all four render all 5 chips unconditionally today.

- [ ] **Step 3.3: Update `HintChips` with capability-aware visibility**

Edit `apps/client/src/shells/pulse/components/input/HintChips.tsx`:

```tsx
import { motion } from 'framer-motion';
import type { ChannelType, ChannelCapability } from '@pecking-order/shared-types';
import type { Command } from '../../hooks/useCommandBuilder';

type ChipVisibilityKind =
  | { kind: 'capability'; cap: ChannelCapability }
  | { kind: 'channelType'; allow: ChannelType[] };

const chips: Array<{
  label: string;
  command: Command;
  color: string;
  visibility: ChipVisibilityKind;
}> = [
  { label: '/silver',  command: 'silver',  color: 'var(--pulse-gold)',    visibility: { kind: 'capability',  cap: 'SILVER_TRANSFER' } },
  { label: '/nudge',   command: 'nudge',   color: 'var(--pulse-nudge)',   visibility: { kind: 'capability',  cap: 'NUDGE' } },
  { label: '/dm',      command: 'dm',      color: 'var(--pulse-accent)',  visibility: { kind: 'channelType', allow: ['MAIN'] } },
  { label: '/whisper', command: 'whisper', color: 'var(--pulse-whisper)', visibility: { kind: 'capability',  cap: 'WHISPER' } },
  { label: '@mention', command: 'mention', color: 'var(--pulse-text-2)',  visibility: { kind: 'channelType', allow: ['GROUP_DM'] } },
];

interface HintChipsProps {
  onSelect: (command: Command) => void;
  channelType: ChannelType;
  capabilities?: ChannelCapability[];
}

export function HintChips({ onSelect, channelType, capabilities = [] }: HintChipsProps) {
  const visible = chips.filter(c =>
    c.visibility.kind === 'capability'
      ? capabilities.includes(c.visibility.cap)
      : c.visibility.allow.includes(channelType),
  );

  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 12px 2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
      {visible.map(h => (
        <motion.button
          key={h.label}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(h.command)}
          style={{
            padding: '5px 11px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--po-font-body)',
            background: `${h.color}14`,
            border: `1px solid ${h.color}33`,
            color: h.color,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {h.label}
        </motion.button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3.4: Update `PulseShell` to pass new props at existing MAIN call site**

Grep: `rg 'HintChips' apps/client/src/shells/pulse`.

Expected existing call site: `PulseShell.tsx`, or `PulseInput.tsx`, passing only `onSelect`. Add the two new props:

```tsx
<HintChips
  onSelect={handleHintSelect}
  channelType="MAIN"
  capabilities={mainChannelCapabilities}  // read from useGameStore(s => s.channels['MAIN']?.capabilities)
/>
```

If the current site is already keyed off a generic `channelId`, pull both `channelType` and `capabilities` from that channel's store entry.

- [ ] **Step 3.5: Run the test — all four pass**

Run: `cd apps/client && npx vitest run src/shells/pulse/components/input/__tests__/HintChips.test.tsx`
Expected: 4 passed.

- [ ] **Step 3.6: Build check**

Run: `cd apps/client && npm run build`
Expected: clean.

- [ ] **Step 3.7: Commit**

```bash
git add apps/client/src/shells/pulse/components/input/HintChips.tsx apps/client/src/shells/pulse/components/input/__tests__/HintChips.test.tsx apps/client/src/shells/pulse/PulseShell.tsx
git commit -m "feat(pulse): capability-aware HintChips visibility

Capability chips (/silver /nudge /whisper) gate on channel.capabilities;
/dm and @mention gate on channelType. Unit-tested for MAIN / DM / GROUP_DM / GAME_DM.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire `HintChips` into `DmInput`

**Files:**
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmInput.tsx`

- [ ] **Step 4.1: Read `DmInput.tsx` to understand current structure**

Read `apps/client/src/shells/pulse/components/dm-sheet/DmInput.tsx` fully. Note current props (likely `channelId`, `onSend`).

- [ ] **Step 4.2: Add HintChips above the input**

Edit `DmInput.tsx`. Import HintChips and the command hook:

```tsx
import { HintChips } from '../input/HintChips';
import { useCommandBuilder } from '../../hooks/useCommandBuilder';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
```

Inside the component (before the existing `<input>` JSX), read channel data:

```tsx
const channel = useGameStore(s => s.channels[channelId]);
const { handleCommand } = useCommandBuilder(); // or whatever the existing hook returns
```

Wrap the input's container in a flex column and render HintChips above:

```tsx
return (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    {channel && (
      <HintChips
        onSelect={handleCommand}
        channelType={channel.type}
        capabilities={channel.capabilities}
      />
    )}
    {/* existing <input> JSX unchanged */}
  </div>
);
```

If `useCommandBuilder` requires context (partnerId for silver, targetId for nudge), pass them from the DmSheet context: look up `channelId` → resolve other member → pass as hook args.

- [ ] **Step 4.3: Build + visual check**

Run: `cd apps/client && npm run build`
Expected: clean.

Run: `npm run dev` (from repo root).
Verify dev server's cwd: `lsof -p $(lsof -i :5173 -t) | grep cwd` — must match this worktree.

Open a DM in a test game. Expected: chip row visible above input, showing `/silver` and `/nudge` only (1:1 DM).

Open a GROUP_DM. Expected: `/silver` and `@mention`.

- [ ] **Step 4.4: Commit**

```bash
git add apps/client/src/shells/pulse/components/dm-sheet/DmInput.tsx
git commit -m "feat(pulse): wire HintChips into DmInput

Chips render above the DM input, gated by channel capability + type.
1:1 DM shows /silver /nudge. Group DM shows /silver and @mention.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Out-of-slots shake + toast on `CastChip`

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts` — add `selectChipSlotStatus`
- Modify: `apps/client/src/shells/pulse/components/caststrip/CastChip.tsx`
- Create: `apps/client/src/store/__tests__/chipSlotStatus.test.ts` (or extend existing selector test file)

- [ ] **Step 5.1: Write the failing test for the selector**

Create `apps/client/src/store/__tests__/chipSlotStatus.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('selectChipSlotStatus', () => {
  beforeEach(() => {
    useGameStore.setState({
      roster: {
        p1: { id: 'p1', personaName: 'Me', status: 'ALIVE' },
        p2: { id: 'p2', personaName: 'Alice', status: 'ALIVE' },
        p3: { id: 'p3', personaName: 'Bob', status: 'ALIVE' },
      } as any,
      playerId: 'p1',
      channels: {} as any,
      slotsUsedByPlayer: { p1: 5 },
      dmSlotsPerPlayer: 5,
    } as any);
  });

  it("returns 'blocked' when remaining===0 and no existing DM with target", () => {
    const status = useGameStore.getState().selectChipSlotStatus?.('p2');
    expect(status).toBe('blocked');
  });

  it("returns 'ok' when an existing DM channel with target exists", () => {
    useGameStore.setState({
      channels: {
        'dm_p1_p2': { id: 'dm_p1_p2', type: 'DM', memberIds: ['p1', 'p2'] },
      } as any,
    });
    const status = useGameStore.getState().selectChipSlotStatus?.('p2');
    expect(status).toBe('ok');
  });

  it("returns 'ok' when slots remain", () => {
    useGameStore.setState({ slotsUsedByPlayer: { p1: 2 } as any });
    const status = useGameStore.getState().selectChipSlotStatus?.('p3');
    expect(status).toBe('ok');
  });
});
```

- [ ] **Step 5.2: Run — expect failure (selector doesn't exist yet)**

Run: `cd apps/client && npx vitest run src/store/__tests__/chipSlotStatus.test.ts`
Expected: FAIL — `selectChipSlotStatus is not a function`.

- [ ] **Step 5.3: Add the selector**

Edit `apps/client/src/store/useGameStore.ts`. In the store interface block, add:

```ts
selectChipSlotStatus: (chipPlayerId: string) => 'ok' | 'blocked';
```

In the store create function, after existing selectors, add:

```ts
selectChipSlotStatus: (chipPlayerId) => {
  const s = get();
  if (!s.playerId || chipPlayerId === s.playerId) return 'ok';
  const roster = s.roster;
  if (!roster[chipPlayerId] || roster[chipPlayerId].status !== 'ALIVE') return 'ok';
  // Existing DM with this person? Reopens, no slot consumption.
  const hasExistingDm = Object.values(s.channels).some((c: any) =>
    c.type === 'DM' && c.memberIds.includes(s.playerId) && c.memberIds.includes(chipPlayerId),
  );
  if (hasExistingDm) return 'ok';
  const used = s.slotsUsedByPlayer?.[s.playerId] ?? 0;
  const remaining = (s.dmSlotsPerPlayer ?? 5) - used;
  return remaining > 0 ? 'ok' : 'blocked';
},
```

- [ ] **Step 5.4: Run — tests pass**

Run: `cd apps/client && npx vitest run src/store/__tests__/chipSlotStatus.test.ts`
Expected: 3 passed.

- [ ] **Step 5.5: Add shake keyframes + toast logic to `CastChip`**

Edit `apps/client/src/shells/pulse/components/caststrip/CastChip.tsx`.

At the top of the file, import `toast` from sonner and the selector:

```tsx
import { toast } from 'sonner';
import { useState } from 'react';
// ...existing imports
```

Inside the component, read the slot status:

```tsx
const slotStatus = useGameStore(s => s.selectChipSlotStatus(player.id));
const [shaking, setShaking] = useState(false);
```

Wrap the existing `onClick` handler:

```tsx
const handleTap = () => {
  if (slotStatus === 'blocked') {
    setShaking(true);
    toast.error('Out of DM slots for today');
    setTimeout(() => setShaking(false), 350);
    return;
  }
  openDM(player.id);
};
```

Apply the shake animation via inline style or CSS class. Simplest: inline `animation` prop driven by the `shaking` state:

```tsx
<button
  onClick={handleTap}
  style={{
    // ...existing styles
    animation: shaking ? 'pulse-chip-shake 300ms ease-in-out' : undefined,
  }}
>
```

Add the keyframes once to the CastChip module (or a shared CSS file). Append a `<style>` tag next to the component or define in the nearest CSS file:

```css
@keyframes pulse-chip-shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
```

If Pulse already has a shared keyframes file (look for `keyframes.css` or similar), add it there. Otherwise inline via a single `<style>` tag in the CastChip file.

- [ ] **Step 5.6: Build + manual verify**

Run: `cd apps/client && npm run build`
Expected: clean.

Dev server test: exhaust slots in a test game (create 5 DMs), then tap a 6th chip. Expected: chip shakes, toast appears, no sheet opens.

- [ ] **Step 5.7: Commit**

```bash
git add apps/client/src/store/useGameStore.ts apps/client/src/shells/pulse/components/caststrip/CastChip.tsx apps/client/src/store/__tests__/chipSlotStatus.test.ts
git commit -m "feat(pulse): chip shake + toast when DM slots exhausted

New selectChipSlotStatus selector drives CastChip tap behavior: when
remaining === 0 and no existing DM with target, tap triggers shake
animation + sonner toast instead of opening the sheet.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `MentionRenderer` tap → `openDM`

**Files:**
- Modify: `apps/client/src/shells/pulse/components/input/MentionRenderer.tsx`

- [ ] **Step 6.1: Add tap handler**

Edit `MentionRenderer.tsx`. Import `usePulse`:

```tsx
import { usePulse } from '../../PulseShell';
```

Inside the component:

```tsx
const { openDM } = usePulse();
```

Replace the mention rendering branch:

```tsx
if (part.type === 'mention' && part.playerId) {
  const playerIndex = Object.keys(roster).indexOf(part.playerId);
  return (
    <button
      key={idx}
      onClick={() => openDM(part.playerId!)}
      style={{
        appearance: 'none',
        background: 'none',
        border: 'none',
        padding: 0,
        color: getPlayerColor(playerIndex),
        fontWeight: 700,
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      {part.value}
    </button>
  );
}
```

- [ ] **Step 6.2: Build**

Run: `cd apps/client && npm run build`
Expected: clean.

- [ ] **Step 6.3: Manual verify**

Dev server: send a message with `@Alice Johnson` (full persona name). Tap the rendered mention. Expected: DM sheet opens for Alice.

- [ ] **Step 6.4: Commit**

```bash
git add apps/client/src/shells/pulse/components/input/MentionRenderer.tsx
git commit -m "feat(pulse): tap @mention opens DM

MentionRenderer already resolves playerId at parse time; wrap the span
in a button that calls openDM(playerId) from PulseShell context.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `PersonaImage` component with variant fallback + cache

**Files:**
- Create: `apps/client/src/shells/pulse/components/common/PersonaImage.tsx`
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx`
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx`

- [ ] **Step 7.1: Read current `DmHero` variant resolution**

Read `apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx`. Note the existing `resolvePersonaVariant` function and how the image element is rendered. Note props used by the image (persona name, player color, sizing).

- [ ] **Step 7.2: Create `PersonaImage.tsx`**

Create `apps/client/src/shells/pulse/components/common/PersonaImage.tsx`:

```tsx
import { useState, useEffect } from 'react';

type Variant = 'headshot' | 'medium' | 'full';

interface PersonaImageProps {
  personaId: string;
  preferredVariant: Variant;
  fallbackChain?: Variant[];
  initials: string;
  playerColor: string;
  style?: React.CSSProperties;
  alt?: string;
}

// Module-level cache of known-good variants per persona. Cleared on page reload.
const knownGoodVariant = new Map<string, Variant>();

function variantUrl(personaId: string, variant: Variant): string {
  // Match existing URL scheme. DmHero currently builds paths like
  // `/personas/${personaId}/${variant}.png` — replicate here.
  return `/personas/${personaId}/${variant}.png`;
}

export function PersonaImage({
  personaId,
  preferredVariant,
  fallbackChain = ['headshot'],
  initials,
  playerColor,
  style,
  alt,
}: PersonaImageProps) {
  const [variantIndex, setVariantIndex] = useState(0);
  const chain: (Variant | 'initials')[] = [
    knownGoodVariant.get(personaId) ?? preferredVariant,
    ...fallbackChain.filter(v => v !== (knownGoodVariant.get(personaId) ?? preferredVariant)),
    'initials',
  ];
  const current = chain[variantIndex];

  useEffect(() => {
    setVariantIndex(0);
  }, [personaId]);

  if (current === 'initials') {
    return (
      <div
        style={{
          ...style,
          background: playerColor,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
        }}
        aria-label={alt}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={variantUrl(personaId, current)}
      alt={alt ?? ''}
      style={style}
      onLoad={() => knownGoodVariant.set(personaId, current)}
      onError={() => setVariantIndex(i => i + 1)}
    />
  );
}
```

Adjust `variantUrl` to match the actual URL scheme used by existing `resolvePersonaVariant` — check that function in DmHero before shipping.

- [ ] **Step 7.3: Swap `DmHero` to use `PersonaImage`**

Edit `DmHero.tsx`. Replace the direct `<img>` with:

```tsx
<PersonaImage
  personaId={partner.id}
  preferredVariant="medium"
  fallbackChain={['headshot']}
  initials={partner.personaName.split(' ').map(s => s[0]).join('').slice(0, 2)}
  playerColor={playerColor}
  style={{ /* existing image styles */ }}
  alt={partner.personaName}
/>
```

Remove the now-unused `resolvePersonaVariant` helper if it's only used here; keep it if other components still import it.

- [ ] **Step 7.4: Same for `DmGroupHero`**

Edit `DmGroupHero.tsx`. Replace each member's `<img>` with a `PersonaImage` (use `preferredVariant="headshot"` for the smaller group-member size).

- [ ] **Step 7.5: Build**

Run: `cd apps/client && npm run build`
Expected: clean.

- [ ] **Step 7.6: Manual verify**

Dev server: open a DM with a persona that has no `medium.png` but has `headshot.png`. Expected: brief flicker first load, then steady `headshot`. Re-open the DM — no flicker (cache hit). Open a DM with neither variant (simulate via URL hack) — falls through to initials tile.

- [ ] **Step 7.7: Commit**

```bash
git add apps/client/src/shells/pulse/components/common/PersonaImage.tsx apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx
git commit -m "feat(pulse): PersonaImage with variant fallback + cache

New shared component walks a variant fallback chain on image error and
terminates in a color + initials tile. Module-level Map caches the
known-good variant per persona to avoid re-flicker on second mount.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Generalize `TypingIndicator` to accept `channelId`

**Files:**
- Modify: `apps/client/src/shells/pulse/components/chat/TypingIndicator.tsx`
- Modify: `apps/client/src/shells/pulse/components/chat/ChatView.tsx` (pass `channelId="MAIN"`)

- [ ] **Step 8.1: Update `TypingIndicator` props**

Edit `TypingIndicator.tsx`:

```tsx
interface TypingIndicatorProps {
  channelId: string;
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const typingPlayers = useGameStore(s => s.typingPlayers);
  const roster = useGameStore(s => s.roster);
  const { playerId } = usePulse();

  const typing = Object.entries(typingPlayers)
    .filter(([pid, channel]) => pid !== playerId && channel === channelId)
    .map(([pid]) => pid);
  // ... rest unchanged
```

- [ ] **Step 8.2: Update the existing call site in `ChatView`**

Edit `ChatView.tsx`. Find `<TypingIndicator />` and change to:

```tsx
<TypingIndicator channelId="MAIN" />
```

- [ ] **Step 8.3: Build**

Run: `cd apps/client && npm run build`
Expected: clean. Any other `TypingIndicator` usage will error without the prop — grep to confirm only MAIN usage exists today.

Run: `rg 'TypingIndicator' apps/client/src`
Expected: only `ChatView.tsx` and the component file itself.

- [ ] **Step 8.4: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/TypingIndicator.tsx apps/client/src/shells/pulse/components/chat/ChatView.tsx
git commit -m "refactor(pulse): parameterize TypingIndicator by channelId

Drop the hardcoded 'MAIN' filter so TypingIndicator can mount inside
DmSheet against a specific DM channel. ChatView call site updated.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `DmStatusRing` + DM sheet header integration

**Files:**
- Create: `apps/client/src/shells/pulse/components/dm-sheet/DmStatusRing.tsx`
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx`
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmSheet.tsx`

- [ ] **Step 9.1: Create `DmStatusRing.tsx`**

```tsx
import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import type { ReactNode } from 'react';

type Status = 'online' | 'typing' | 'idle';

interface DmStatusRingProps {
  partnerId: string;
  channelId: string;
  color: string;
  children: ReactNode;  // the avatar to wrap
  size: number;         // avatar diameter in px
}

export function DmStatusRing({ partnerId, channelId, color, children, size }: DmStatusRingProps) {
  const isConnected = useGameStore(s => s.connectedPlayers?.has?.(partnerId) ?? false);
  const typingIn = useGameStore(s => s.typingPlayers?.[partnerId]);

  let status: Status = 'idle';
  if (typingIn === channelId) status = 'typing';
  else if (isConnected) status = 'online';

  const ringWidth = status === 'typing' ? 3 : 2;
  const opacity = status === 'idle' ? 0.3 : 1;

  return (
    <motion.div
      animate={status === 'typing' ? { scale: [1, 1.03, 1] } : { scale: 1 }}
      transition={status === 'typing' ? { duration: 1, repeat: Infinity } : {}}
      style={{
        width: size + ringWidth * 4,
        height: size + ringWidth * 4,
        borderRadius: '50%',
        border: `${ringWidth}px solid ${color}`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </motion.div>
  );
}
```

Verify `connectedPlayers` shape in the store — it may be `Set<string>` or `Record<string, true>` or an array. Adjust the membership check accordingly. Grep `connectedPlayers` in `useGameStore.ts` first.

- [ ] **Step 9.2: Wrap the partner avatar in `DmHero`**

Edit `DmHero.tsx`. Wrap the existing `PersonaImage` in `DmStatusRing` (1:1 only; do not apply to `DmGroupHero`):

```tsx
<DmStatusRing partnerId={partner.id} channelId={channelId} color={playerColor} size={80}>
  <PersonaImage /* ...props from Task 7 */ />
</DmStatusRing>
```

Adjust `size` to match the current avatar size.

- [ ] **Step 9.3: Mount `TypingIndicator` inside `DmSheet`**

Edit `DmSheet.tsx`. Import:

```tsx
import { TypingIndicator } from '../chat/TypingIndicator';
```

Above `<DmInput />`, render:

```tsx
<TypingIndicator channelId={channelId} />
```

Works for both 1:1 and group DMs — existing multi-typer formatting handles the "Alice, Bob typing" case.

- [ ] **Step 9.4: Build + manual verify**

Run: `cd apps/client && npm run build`
Expected: clean.

Dev server with two browser profiles: open the same DM. Profile A idle → ring at 30% opacity. Profile A types → ring pulses in Profile B. Close Profile A tab → ring drops to idle.

- [ ] **Step 9.5: Commit**

```bash
git add apps/client/src/shells/pulse/components/dm-sheet/DmStatusRing.tsx apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx apps/client/src/shells/pulse/components/dm-sheet/DmSheet.tsx
git commit -m "feat(pulse): DM sheet status ring + typing indicator

DmStatusRing wraps the 1:1 DM partner avatar with a three-state ring
(online / typing / idle). TypingIndicator (generalized in Task 8) mounts
inside DmSheet, keyed by channelId, so it surfaces DM-scoped typing.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `/silver` picker from MAIN never emits `channel: 'MAIN'`

**Files:**
- Modify: wherever the `/silver` picker routes its final `sendSilver` — likely `useCommandBuilder.ts` or `useGameEngine.ts`
- Create: `apps/client/src/shells/pulse/hooks/__tests__/silverRouting.test.ts` (or place appropriately)

- [ ] **Step 10.1: Read the current `/silver` flow**

Grep: `rg 'sendSilver|SEND_SILVER' apps/client/src`.
Identify the code path from MAIN chip tap → picker → event emit. Note the `channel` / `channelId` field in the emitted event.

- [ ] **Step 10.2: Write a guard test**

Create `apps/client/src/shells/pulse/hooks/__tests__/silverRouting.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
// Import the engine method or the command-builder function that emits SEND_SILVER

describe('/silver picker routing', () => {
  it('never emits SEND_SILVER with channel: MAIN', () => {
    const sendSpy = vi.fn();
    // Set up minimal state: MAIN channel context, pick a target player.
    // Invoke the /silver flow with a chosen recipient.
    // Assert sendSpy was called with channel !== 'MAIN' (should be the DM channel id between sender and target).
    // ...fill in based on the actual code path identified in Step 10.1
    expect(sendSpy.mock.calls.every(c => c[0].channel !== 'MAIN')).toBe(true);
  });
});
```

Fill in the test body based on the actual flow — the assertion shape is fixed, the plumbing depends on what `/silver` resolves to in code.

- [ ] **Step 10.3: Run test; fix routing if it fails**

Run: `cd apps/client && npx vitest run src/shells/pulse/hooks/__tests__/silverRouting.test.ts`

If FAIL: the picker is emitting `channel: 'MAIN'`. Fix by resolving the DM channel id before emit: look up or create the DM channel between sender and target, use its id as `channelId`.

If PASS: routing is already correct; keep the test as a regression guard.

- [ ] **Step 10.4: Build + commit**

```bash
cd apps/client && npm run build  # expect clean
```

```bash
git add apps/client/src/shells/pulse/hooks/__tests__/silverRouting.test.ts
# + any routing fix
git commit -m "test(pulse): guard /silver from MAIN never targets channel: 'MAIN'

With MAIN now carrying SILVER_TRANSFER cap, the server would authorize
silver-in-MAIN if the client ever emitted that shape. Regression test
asserts the picker always resolves to a DM channel id before emit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final build + manual verification pass

- [ ] **Step 11.1: Build both apps**

```bash
cd apps/game-server && npm run build
cd apps/client && npm run build
```
Expected: both clean.

- [ ] **Step 11.2: Run full test suites**

```bash
cd apps/game-server && npm run test
cd apps/client && npm run test
```
Expected: no regressions.

- [ ] **Step 11.3: Manual integration pass (single-player dev)**

Start dev server; verify cwd matches this worktree. Clear `po_pwa_*` / `po_token_*` cookies + localStorage. Open a fresh game.

Walk the golden path:
1. Open MAIN — see `/silver`, `/nudge`, `/whisper`, `/dm` chips.
2. Start a DM — see `/silver`, `/nudge` chips. Tap `/nudge` → toast confirms.
3. Tap `@Alice Johnson` in a chat message — DM sheet for Alice opens.
4. Exhaust slots, tap a new CastChip — shake + toast.
5. Open DM where persona has no `medium.png` — fallback to `headshot.png` without break.
6. Open DM in a second browser profile — status ring transitions from idle → online → typing as partner activity changes.

- [ ] **Step 11.4: Stop and report**

Summarize: what shipped, test counts, any deviations from plan, anything that surprised during implementation. Ask user whether to proceed to sibling plan (DM flow extensions) or pause for playtest.

---

## Self-Review

**Spec coverage check (against `2026-04-13-pulse-dm-polish-design.md`):**

- §Architecture (capabilities model, NUDGE exception) — Task 1 lands the caps; Task 2 lands WHISPER hardening; NUDGE intentionally not hardened.
- §1 Server changes — Tasks 1 + 2.
- §1 Client `HintChips` — Task 3.
- §1 `DmInput` integration — Task 4.
- §2 Out-of-slots shake + toast — Task 5.
- §3 `@mention` tap → `openDM` — Task 6.
- §4 `PersonaImage` w/ cache — Task 7.
- §5 Status ring + typing indicator — Tasks 8 + 9.
- §Risks §silver-in-MAIN test — Task 10.

**Type consistency:** `selectChipSlotStatus` signature matches across Task 5 definition and Task 11 usage. `PersonaImage` props match across Task 7 definition and Tasks 7/9 consumers. `DmStatusRing` consumes `connectedPlayers` — the shape in the store needs a grep-verify (noted inline in Step 9.1). `HintChips` props are stable across Tasks 3/4.

**Placeholder scan:** no TBDs; test body in Step 10.2 has a noted "fill in based on actual code path" — acceptable because the assertion shape is fixed and the plumbing is codebase-dependent.

**Deferred / intentional gaps:**
- Server tests for channel-cap creation rely on an L3 session machine that initializes from `input.roster`; if the test harness pattern differs (some tests bypass `createInitialContext`), Step 2.1 may need minor adjustment.
- `connectedPlayers` shape verification (Step 9.1) — explicitly flagged for grep before implementation.
