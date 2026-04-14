# Pulse DM Flow Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **User preference on record: no subagents for implementation on this branch — drive code changes directly in the main session.**

**Goal:** Ship the two DM flows Phase 1.5 deferred — add-member to an existing DM/group, and 1:1 → group DM promotion — on `feature/pulse-shell-phase1`, after Plan A (DM polish). One session; ~1 day.

**Architecture:** Server promotes `channel.type` from `DM` → `GROUP_DM` on `ADD_MEMBER` when membership exceeds 2, strips the `NUDGE` capability in the same assign. Client reuses the Phase 1.5 picking-mode flow with an "add-mode" variant triggered from the DM sheet header. New selectors gate visibility and compute the group title. `DM_INVITE_SENT` fact gains a `kind: 'initial' | 'add_member'` field so the narrator can render the right line for each case.

**Tech Stack:** Same as Plan A — React 19 + TypeScript, Zustand, Framer Motion, `sonner`, `@solar-icons/react`. Vitest on both sides.

**Authoritative spec:** `docs/superpowers/specs/2026-04-13-pulse-dm-flow-extensions-design.md`

**Prerequisite plan (must land first):** `docs/superpowers/plans/2026-04-13-pulse-dm-polish.md` — introduces `NUDGE` capability which this plan strips on promotion.

**User workflow constraints:** same as Plan A (ask before merge/push, run `npm run build` per commit, verify dev-server cwd, scoped commit messages with `Co-Authored-By` trailer, stop at each Task for user check-in).

**Out of scope:** rename group DM, leave group, remove member, transfer ownership, DM read receipts, motion polish.

**Known pre-migration shape:** Phase 1.5 actually shipped `pickingMode: { active: boolean, selected: string[] }` — not the boolean mentioned in the spec's §4. Migration in Task 3 respects the real shape.

---

## File Structure

### Modify (server)
- `apps/game-server/src/machines/actions/l3-social.ts` — `addMemberToChannel` (type promotion + NUDGE strip), `recordAddMemberFact` (set `kind`), initial DM invite fact emitters (set `kind: 'initial'`)
- `apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts` — new describe block for type promotion

### Modify (client)
- `apps/client/src/store/useGameStore.ts` — `pickingMode` shape migration, new selectors, new actions
- `apps/client/src/hooks/useGameEngine.ts` — `addMembersToChannel` method
- `apps/client/src/shells/pulse/PulseShell.tsx` — consume migrated `pickingMode`
- `apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx` — consume migrated `pickingMode`
- `apps/client/src/shells/pulse/components/caststrip/CastChip.tsx` — consume migrated `pickingMode`
- `apps/client/src/shells/pulse/components/caststrip/StartPickedCta.tsx` — branch on `pickingMode.kind`
- `apps/client/src/shells/pulse/components/caststrip/PickingBanner.tsx` — add-mode variant (title + locked chips)
- `apps/client/src/shells/pulse/components/dm-sheet/DmSheet.tsx` — add button in header
- `apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx` — add button in header
- `apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx` — add button + computed title + pending member state
- Narrator line renderer — disambiguate `DM_INVITE_SENT` by `kind`. Phase 1.5 put narrator logic inline in `ChatView` (per memory); locate the reader and extend.

### Test (new or extend)
- `apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts` — extend with "Type promotion on ADD_MEMBER" describe block
- `apps/client/src/store/__tests__/pickingMode.test.ts` (new) — migration selectors + actions
- `apps/client/src/store/__tests__/groupDmTitle.test.ts` (new) — `selectGroupDmTitle`

---

## Task Ordering

1. Fact payload extension — `DM_INVITE_SENT.kind` (server)
2. `addMemberToChannel` type promotion + NUDGE strip + server tests
3. `pickingMode` discriminated union migration (client, atomic)
4. New client selectors (`selectCanAddMemberTo`, `selectAvailableAddTargets`, `selectGroupDmTitle`)
5. `addMembersToChannel` engine method
6. Add button in DM sheet header
7. `PickingBanner` add-mode variant + `StartPickedCta` label swap
8. `DmGroupHero` computed title + pending member rendering
9. Narrator line `kind` disambiguation
10. Rejection toast for `UNAUTHORIZED` ADD_MEMBER
11. Final build + manual verification

---

## Task 1: `DM_INVITE_SENT` fact gets `kind` field

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts` — `recordAddMemberFact` + initial DM invite emitters

- [ ] **Step 1.1: Identify all emitters of `DM_INVITE_SENT`**

Run: `rg "FactTypes.DM_INVITE_SENT" apps/game-server/src`

Expected emitters:
- `recordAddMemberFact` (line ~431) — add-member case.
- Initial DM invite emitter(s) — likely in `createDmChannel` path or a sibling action like `recordDmInviteFact`. Read the file to confirm the set.

- [ ] **Step 1.2: Update `recordAddMemberFact` to set `kind: 'add_member'`**

Edit `l3-social.ts`, `recordAddMemberFact` (~line 431):

```ts
recordAddMemberFact: sendParent(({ event }: any) => {
  if (event.type !== Events.Social.ADD_MEMBER) return { type: Events.Fact.RECORD, fact: { type: FactTypes.DM_INVITE_SENT, actorId: '', timestamp: 0 } };
  return {
    type: Events.Fact.RECORD,
    fact: {
      type: FactTypes.DM_INVITE_SENT,
      actorId: event.senderId,
      payload: {
        channelId: event.channelId,
        memberIds: event.memberIds,
        kind: 'add_member',  // NEW
      },
      timestamp: Date.now(),
    },
  };
}),
```

- [ ] **Step 1.3: Update initial DM invite emitters to set `kind: 'initial'`**

For every other `DM_INVITE_SENT` emit site identified in Step 1.1, add `kind: 'initial'` to `payload`. Common sites: `recordDmInviteFact` action or inline fact emits in `createDmChannel` / `createGroupDmChannel` handlers.

- [ ] **Step 1.4: Extend `push-triggers.ts` reader if it branches on kind**

Read `apps/game-server/src/push-triggers.ts:201`. If the existing push trigger logic needs to differentiate (e.g., different notification text for add-member vs initial), branch on `fact.payload.kind`. If it's fine as-is, leave it — only make the reader change if the product call is clear. Default: leave push text generic.

- [ ] **Step 1.5: Build**

Run: `cd apps/game-server && npm run build`
Expected: clean. `FactSchema.payload` is `z.any()` (index.ts:399) so no schema change required.

- [ ] **Step 1.6: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-social.ts apps/game-server/src/push-triggers.ts
git commit -m "$(cat <<'EOF'
feat(game-server): DM_INVITE_SENT carries kind: 'initial' | 'add_member'

Lets the client narrator render distinct lines for initial invites vs
add-member events without pattern-matching on channel state. Fact
payload schema is z.any(), no validation change needed.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `addMemberToChannel` type promotion + NUDGE strip + tests

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts` — `addMemberToChannel` (line ~404)
- Modify: `apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts` — add describe block

- [ ] **Step 2.1: Write the failing tests**

Edit `apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts`. Add a new describe block at the end:

```ts
describe('Type promotion on ADD_MEMBER', () => {
  const makeContext = (invitationMode = false) => {
    // Reuse the existing test harness pattern — mirror other ADD_MEMBER tests in this file.
    // Produce an actor with a 2-member DM channel (p1, p2) already created by p1.
    // requireDmInvite flag set per `invitationMode`.
    // Return the actor so the test can send events and inspect context.
  };

  it('promotes DM → GROUP_DM when adding a 3rd member (non-invite mode)', () => {
    const actor = makeContext(false);
    // Identify the dm channelId from the actor's context
    const channelId = /* lookup */;
    actor.send({
      type: Events.Social.ADD_MEMBER,
      senderId: 'p1',
      channelId,
      memberIds: ['p3'],
    } as any);
    const channel = actor.getSnapshot().context.channels[channelId];
    expect(channel.type).toBe('GROUP_DM');
    expect(channel.memberIds).toEqual(expect.arrayContaining(['p1', 'p2', 'p3']));
  });

  it('strips NUDGE capability on promotion', () => {
    const actor = makeContext(false);
    const channelId = /* lookup */;
    actor.send({
      type: Events.Social.ADD_MEMBER,
      senderId: 'p1',
      channelId,
      memberIds: ['p3'],
    } as any);
    const channel = actor.getSnapshot().context.channels[channelId];
    expect(channel.capabilities).not.toContain('NUDGE');
    expect(channel.capabilities).toContain('INVITE_MEMBER');
    expect(channel.capabilities).toContain('SILVER_TRANSFER');
  });

  it('GROUP_DM + ADD_MEMBER keeps type GROUP_DM', () => {
    // Create a GROUP_DM with p1, p2, p3. Then add p4. Expect type still 'GROUP_DM'.
  });

  it('invite mode: promotion fires when pendingMemberIds push total > 2', () => {
    const actor = makeContext(true);
    const channelId = /* lookup */;
    actor.send({
      type: Events.Social.ADD_MEMBER,
      senderId: 'p1',
      channelId,
      memberIds: ['p3'],
    } as any);
    const channel = actor.getSnapshot().context.channels[channelId];
    // memberIds stays [p1, p2]; pendingMemberIds gains p3 — total 3 → promotion.
    expect(channel.type).toBe('GROUP_DM');
  });

  it('stable channel id on promotion', () => {
    const actor = makeContext(false);
    const channelId = /* lookup */;
    actor.send({
      type: Events.Social.ADD_MEMBER,
      senderId: 'p1',
      channelId,
      memberIds: ['p3'],
    } as any);
    const channels = actor.getSnapshot().context.channels;
    expect(channels[channelId]).toBeDefined();
    // id never gets rewritten — message history stays attached.
  });
});
```

Fill in the `makeContext` helper by mirroring the setup used in other ADD_MEMBER tests in the file (lines 639+). Use existing patterns rather than inventing a new test harness.

- [ ] **Step 2.2: Run — expect all five to fail**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-dm-invitations.test.ts -t "Type promotion"`
Expected: 5 failures — `channel.type` is still `'DM'` post-`ADD_MEMBER`.

- [ ] **Step 2.3: Extend `addMemberToChannel` with promotion logic**

Edit `l3-social.ts`, replace `addMemberToChannel` (~line 404):

```ts
addMemberToChannel: assign(({ context, event }: any) => {
  if (event.type !== Events.Social.ADD_MEMBER) return {};
  const { senderId, channelId, memberIds: newMemberIds, message } = event;
  const channels = { ...context.channels };
  const channel = channels[channelId];
  if (!channel) return {};

  const isInviteMode = context.requireDmInvite;
  const updatedMemberIds = isInviteMode
    ? channel.memberIds
    : [...channel.memberIds, ...newMemberIds];
  const updatedPendingIds = isInviteMode
    ? [...(channel.pendingMemberIds ?? []), ...newMemberIds]
    : channel.pendingMemberIds;

  const totalMembers = updatedMemberIds.length + (updatedPendingIds?.length ?? 0);
  const shouldPromote = channel.type === 'DM' && totalMembers > 2;

  const promotedCaps = shouldPromote
    ? (channel.capabilities ?? []).filter((c: ChannelCapability) => c !== 'NUDGE')
    : channel.capabilities;

  channels[channelId] = {
    ...channel,
    memberIds: updatedMemberIds,
    pendingMemberIds: updatedPendingIds,
    capabilities: promotedCaps,
    ...(shouldPromote ? { type: 'GROUP_DM' as const } : {}),
  };

  let chatLog = context.chatLog;
  if (message) {
    const msg = buildChatMessage(senderId, message, channelId);
    chatLog = appendToChatLog(chatLog, msg);
  }

  return { channels, chatLog };
}),
```

Import `ChannelCapability` at the top of the file if not already imported.

- [ ] **Step 2.4: Run — all five tests pass**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-dm-invitations.test.ts -t "Type promotion"`
Expected: 5 passed.

- [ ] **Step 2.5: Run the full server test suite**

Run: `cd apps/game-server && npm run test`
Expected: no regressions. Existing ADD_MEMBER tests (lines 639+) should still pass — promotion only kicks in at `totalMembers > 2`.

- [ ] **Step 2.6: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-social.ts apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts
git commit -m "feat(game-server): promote DM → GROUP_DM on ADD_MEMBER, strip NUDGE cap

Adding a 3rd member to a type='DM' channel flips type to 'GROUP_DM' in
the same assign. NUDGE capability is stripped (group DMs don't surface
the /nudge chip). Channel id is stable — no ID churn, no message
migration. Covers both invite-mode and non-invite-mode promotion.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `pickingMode` discriminated union migration

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts:80,537,658-663`
- Modify: `apps/client/src/shells/pulse/PulseShell.tsx:43` (and wherever else it reads `pickingMode`)
- Modify: `apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx`
- Modify: `apps/client/src/shells/pulse/components/caststrip/CastChip.tsx`
- Modify: `apps/client/src/shells/pulse/components/caststrip/StartPickedCta.tsx`
- Create: `apps/client/src/store/__tests__/pickingMode.test.ts`

- [ ] **Step 3.1: Pre-change grep audit**

Run: `rg "pickingMode" apps/client/src`

Known sites (from spec):
- `useGameStore.ts` — definition + `startPicking`, `cancelPicking`, `togglePick` actions
- `PulseShell.tsx` — reads `.active`
- `CastStrip.tsx` — reads `.active`, `.selected`
- `CastChip.tsx` — receives `pickingMode: boolean` prop
- `StartPickedCta.tsx` — reads `.active`, `.selected`

If grep reveals additional sites, pause and list them before proceeding.

- [ ] **Step 3.2: Write the failing test**

Create `apps/client/src/store/__tests__/pickingMode.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('pickingMode', () => {
  beforeEach(() => {
    useGameStore.getState().cancelPicking();
  });

  it('startPicking with no args starts new-dm mode', () => {
    useGameStore.getState().startPicking();
    const pm = useGameStore.getState().pickingMode;
    expect(pm).not.toBeNull();
    expect(pm?.kind).toBe('new-dm');
    expect(pm?.selected).toEqual([]);
  });

  it('startAddMember mode carries channelId', () => {
    useGameStore.getState().startAddMember('dm_abc');
    const pm = useGameStore.getState().pickingMode;
    expect(pm?.kind).toBe('add-member');
    expect((pm as any)?.channelId).toBe('dm_abc');
    expect(pm?.selected).toEqual([]);
  });

  it('togglePick accumulates selected ids', () => {
    useGameStore.getState().startPicking();
    useGameStore.getState().togglePick('p2');
    useGameStore.getState().togglePick('p3');
    expect(useGameStore.getState().pickingMode?.selected).toEqual(['p2', 'p3']);
  });

  it('cancelPicking returns to null', () => {
    useGameStore.getState().startPicking();
    useGameStore.getState().cancelPicking();
    expect(useGameStore.getState().pickingMode).toBeNull();
  });
});
```

- [ ] **Step 3.3: Run — expect failure**

Run: `cd apps/client && npx vitest run src/store/__tests__/pickingMode.test.ts`
Expected: FAIL — `startAddMember` doesn't exist; shape is wrong.

- [ ] **Step 3.4: Migrate the store definition + actions**

Edit `useGameStore.ts`. Replace lines 80 (interface) + 537 (initial value) + 658-663 (actions):

Interface (line ~80):

```ts
pickingMode:
  | null
  | { kind: 'new-dm'; selected: string[] }
  | { kind: 'add-member'; channelId: string; selected: string[] };

startPicking: () => void;
startAddMember: (channelId: string) => void;
cancelPicking: () => void;
togglePick: (playerId: string) => void;
```

Initial value (line ~537):

```ts
pickingMode: null,
```

Actions (replace lines ~658-663):

```ts
startPicking: () => set({ pickingMode: { kind: 'new-dm', selected: [] } }),
startAddMember: (channelId) =>
  set({ pickingMode: { kind: 'add-member', channelId, selected: [] } }),
cancelPicking: () => set({ pickingMode: null }),
togglePick: (playerId) =>
  set(state => {
    if (!state.pickingMode) return {};
    const sel = state.pickingMode.selected;
    const next = sel.includes(playerId) ? sel.filter(id => id !== playerId) : [...sel, playerId];
    return {
      pickingMode: { ...state.pickingMode, selected: next } as typeof state.pickingMode,
    };
  }),
```

- [ ] **Step 3.5: Update `PulseShell.tsx`**

Replace `s.pickingMode.active` with `s.pickingMode !== null`:

```tsx
const pickingActive = useGameStore(s => s.pickingMode !== null);
```

- [ ] **Step 3.6: Update `CastStrip.tsx`**

Replace the two `pickingMode.active` reads and `pickingMode.selected.includes(...)` reads:

```tsx
const pickingMode = useGameStore(s => s.pickingMode);

// ...
if (pickingMode) { /* old: pickingMode.active */ }

// ...
const picked = pickingMode?.selected.includes(entry.id) ?? false;
const pickable = !!pickingMode && entry.kind === 'player';
```

For the `<CastChip pickingMode={pickingMode.active}` prop — keep the boolean prop interface for `CastChip` since it's just a visibility flag. Pass `!!pickingMode` instead:

```tsx
<CastChip pickingMode={!!pickingMode} ... />
```

- [ ] **Step 3.7: Update `StartPickedCta.tsx`**

Edit to handle both kinds. The label + action changes based on `kind`:

```tsx
export function StartPickedCta() {
  const pickingMode = useGameStore(s => s.pickingMode);
  const roster = useGameStore(s => s.roster);
  const engine = useGameEngine();

  if (!pickingMode || pickingMode.selected.length === 0) return null;

  if (pickingMode.kind === 'new-dm') {
    const label = pickingMode.selected.length === 1
      ? `Start chat with ${roster[pickingMode.selected[0]]?.personaName ?? ''}`
      : `Start group with ${pickingMode.selected.length}`;

    const onTap = () => {
      if (pickingMode.selected.length === 1) {
        const partnerId = pickingMode.selected[0];
        // ... existing new-DM path
      } else {
        engine.createGroupDm(pickingMode.selected);
      }
      useGameStore.getState().cancelPicking();
    };

    return <button onClick={onTap}>{label}</button>;
  }

  // add-member
  const label = `Add ${pickingMode.selected.length}`;
  const onTap = () => {
    engine.addMembersToChannel(pickingMode.channelId, pickingMode.selected);
    useGameStore.getState().cancelPicking();
  };
  return <button onClick={onTap}>{label}</button>;
}
```

Preserve the existing visual styles — only the label + onTap diverge per kind. `engine.addMembersToChannel` is added in Task 5; leave it as a type error for now (or stub it) and come back in Task 5.

Actually, write a minimal stub in Task 3.7 so the build stays green. In `useGameEngine.ts`, add:

```ts
const addMembersToChannel = (channelId: string, memberIds: string[], message?: string) => {
  // Real implementation in Task 5 — stubbed here so StartPickedCta type-checks.
};
// expose in the return statement
```

- [ ] **Step 3.8: Run the test — passes**

Run: `cd apps/client && npx vitest run src/store/__tests__/pickingMode.test.ts`
Expected: 4 passed.

- [ ] **Step 3.9: Build**

Run: `cd apps/client && npm run build`
Expected: clean. If any missed pickingMode site errors, fix in the same commit.

- [ ] **Step 3.10: Commit**

```bash
git add apps/client/src/store/useGameStore.ts apps/client/src/hooks/useGameEngine.ts apps/client/src/shells/pulse/PulseShell.tsx apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx apps/client/src/shells/pulse/components/caststrip/StartPickedCta.tsx apps/client/src/store/__tests__/pickingMode.test.ts
git commit -m "refactor(pulse): pickingMode discriminated union + startAddMember action

{ active, selected } shape replaced by
null | { kind: 'new-dm', selected } | { kind: 'add-member', channelId, selected }.
StartPickedCta branches on kind for label + action. addMembersToChannel
stubbed in engine hook; real body in the next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: New client selectors

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts` — add selectors
- Create: `apps/client/src/store/__tests__/groupDmTitle.test.ts`

- [ ] **Step 4.1: Write failing tests for `selectGroupDmTitle`**

Create `apps/client/src/store/__tests__/groupDmTitle.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../useGameStore';

describe('selectGroupDmTitle', () => {
  beforeEach(() => {
    useGameStore.setState({
      playerId: 'p1',
      roster: {
        p1: { id: 'p1', personaName: 'Me Myself' },
        p2: { id: 'p2', personaName: 'Alice Jones' },
        p3: { id: 'p3', personaName: 'Bob Smith' },
        p4: { id: 'p4', personaName: 'Carol Diaz' },
        p5: { id: 'p5', personaName: 'Dan Evans' },
        p6: { id: 'p6', personaName: 'Eve Frost' },
      },
      channels: {
        c3: { id: 'c3', type: 'GROUP_DM', memberIds: ['p1', 'p2', 'p3'] },
        c4: { id: 'c4', type: 'GROUP_DM', memberIds: ['p1', 'p2', 'p3', 'p4'] },
        c6: { id: 'c6', type: 'GROUP_DM', memberIds: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] },
      },
    } as any);
  });

  it('3-member group: "Alice, Bob"', () => {
    expect(useGameStore.getState().selectGroupDmTitle?.('c3')).toBe('Alice, Bob');
  });

  it('4-member group: "Alice, Bob, Carol"', () => {
    expect(useGameStore.getState().selectGroupDmTitle?.('c4')).toBe('Alice, Bob, Carol');
  });

  it('6-member group: "Alice, Bob +3"', () => {
    expect(useGameStore.getState().selectGroupDmTitle?.('c6')).toBe('Alice, Bob +3');
  });
});
```

- [ ] **Step 4.2: Run — expect failure**

Run: `cd apps/client && npx vitest run src/store/__tests__/groupDmTitle.test.ts`
Expected: FAIL — selector undefined.

- [ ] **Step 4.3: Add the two selectors**

`selectAvailableAddTargets` from the spec is dropped — CastStrip derives the locked-set directly from channel membership (Task 7.3), so an intermediate selector adds no value.

Edit `useGameStore.ts`. Interface:

```ts
selectCanAddMemberTo: (channelId: string) => boolean;
selectGroupDmTitle: (channelId: string) => string;
```

Implementations:

```ts
selectCanAddMemberTo: (channelId) => {
  const s = get();
  const channel = s.channels?.[channelId];
  if (!channel) return false;
  if (channel.createdBy !== s.playerId) return false;
  return (channel.capabilities ?? []).includes('INVITE_MEMBER');
},

selectGroupDmTitle: (channelId) => {
  const s = get();
  const channel = s.channels?.[channelId];
  if (!channel) return '';
  const otherIds = (channel.memberIds || []).filter((id: string) => id !== s.playerId);
  const firstNames = otherIds.map((id: string) => s.roster[id]?.personaName?.split(' ')[0] ?? '');
  if (firstNames.length <= 3) return firstNames.join(', ');
  const shown = firstNames.slice(0, 2).join(', ');
  const overflow = firstNames.length - 2;
  return `${shown} +${overflow}`;
},
```

- [ ] **Step 4.4: Run the test — passes**

Run: `cd apps/client && npx vitest run src/store/__tests__/groupDmTitle.test.ts`
Expected: 3 passed.

- [ ] **Step 4.5: Build + commit**

```bash
cd apps/client && npm run build  # expect clean
git add apps/client/src/store/useGameStore.ts apps/client/src/store/__tests__/groupDmTitle.test.ts
git commit -m "feat(pulse): selectors for add-member gating + group DM title

selectCanAddMemberTo: true only for channel.createdBy with INVITE_MEMBER cap.
selectAvailableAddTargets: alive players not already in channel.
selectGroupDmTitle: computed 'Alice, Bob, Carol' / 'Alice, Bob +N'.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `addMembersToChannel` engine method

**Files:**
- Modify: `apps/client/src/hooks/useGameEngine.ts` — replace stub

- [ ] **Step 5.1: Implement the method**

Replace the stub from Task 3.7 with the real WS send. Mirror the existing engine methods (e.g., `createGroupDm` around line ~132+):

```ts
const addMembersToChannel = (channelId: string, memberIds: string[], message?: string) => {
  if (!socketRef.current) return;
  socketRef.current.send(JSON.stringify({
    type: Events.Social.ADD_MEMBER,
    channelId,
    memberIds,
    ...(message ? { message } : {}),
  }));
};
```

Expose it in the returned engine object (line ~214 area).

- [ ] **Step 5.2: Build**

Run: `cd apps/client && npm run build`
Expected: clean.

- [ ] **Step 5.3: Commit**

```bash
git add apps/client/src/hooks/useGameEngine.ts
git commit -m "feat(pulse): addMembersToChannel engine method

Emits Events.Social.ADD_MEMBER with channelId + memberIds. Optional
message attaches as the first in-channel message post-add.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Add button in DM sheet header

**Files:**
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx`
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx`

- [ ] **Step 6.1: Add button to `DmHero` (1:1 DM)**

Edit `DmHero.tsx`. Read the current header layout. Add a right-aligned button visible only when `selectCanAddMemberTo(channelId)` is true:

```tsx
import { UserPlus } from '@solar-icons/react';

const canAdd = useGameStore(s => s.selectCanAddMemberTo(channelId));
const startAddMember = useGameStore(s => s.startAddMember);

{canAdd && (
  <button
    onClick={() => startAddMember(channelId)}
    aria-label="Add members"
    style={{
      appearance: 'none',
      background: 'transparent',
      border: 'none',
      color: 'var(--pulse-text-2)',
      cursor: 'pointer',
      padding: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}
  >
    <UserPlus weight="Bold" size={18} />
    <span style={{ fontSize: 12, fontWeight: 600 }}>Add</span>
  </button>
)}
```

Position on the right side of the header; mirror existing right-aligned affordances in the file.

- [ ] **Step 6.2: Add the same button to `DmGroupHero`**

Identical snippet. Place on the right of the group avatars/title.

- [ ] **Step 6.3: Build + manual verify**

Run: `cd apps/client && npm run build`
Expected: clean.

Dev server: open a DM you created → "Add" button visible. Open a DM where you're the recipient (not creator) → no button. Tap the button → Cast Strip enters picking mode (works via `startAddMember`; UI for add-mode picking comes in Task 7).

- [ ] **Step 6.4: Commit**

```bash
git add apps/client/src/shells/pulse/components/dm-sheet/DmHero.tsx apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx
git commit -m "feat(pulse): Add button in DM sheet header

Creator-only button (gated by selectCanAddMemberTo) triggers
startAddMember(channelId). Cast Strip switches into add-mode picking
on tap. UI for add-mode picking lands in the next commit.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `PickingBanner` add-mode variant + locked chips

**Files:**
- Modify: `apps/client/src/shells/pulse/components/caststrip/PickingBanner.tsx`
- Modify: `apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx` — disable already-in-channel chips

- [ ] **Step 7.1: Read existing `PickingBanner.tsx`**

Understand current layout: title, maybe a cancel button. It's a banner rendered above the Cast Strip when `pickingMode` is active.

- [ ] **Step 7.2: Branch title by `pickingMode.kind`**

Edit `PickingBanner.tsx`:

```tsx
const pickingMode = useGameStore(s => s.pickingMode);
if (!pickingMode) return null;

const title = pickingMode.kind === 'add-member' ? 'Add to conversation' : 'Pick players';

return (
  <div style={{ /* existing banner styles */ }}>
    {title}
    {/* existing cancel button */}
  </div>
);
```

- [ ] **Step 7.3: Lock existing-member chips in add-mode**

Edit `CastStrip.tsx`. When `pickingMode.kind === 'add-member'`, chips whose `entry.id` is already in the target channel's memberIds or pendingMemberIds render as locked (disabled, can't be toggled):

```tsx
const pickingMode = useGameStore(s => s.pickingMode);
const lockedIds = (() => {
  if (pickingMode?.kind !== 'add-member') return new Set<string>();
  const ch = useGameStore.getState().channels[pickingMode.channelId];
  return new Set([...(ch?.memberIds ?? []), ...(ch?.pendingMemberIds ?? [])]);
})();

// Inside the map that renders chips:
const locked = lockedIds.has(entry.id);
const pickable = !!pickingMode && entry.kind === 'player' && !locked;
```

Pass `locked` down to `CastChip` as a new prop:

```tsx
<CastChip
  // ...existing
  locked={locked}
/>
```

- [ ] **Step 7.4: Update `CastChip` to render locked state**

Edit `CastChip.tsx`. Add `locked?: boolean` to the props interface. When `locked`, render at reduced opacity with a subtle "in" indicator, no tap handler:

```tsx
export function CastChip({ entry, onTap, pickingMode, picked, pickable, locked }: Props) {
  // ...
  const handleTap = () => {
    if (locked) return;
    // ...existing tap logic
  };

  return (
    <button
      disabled={locked}
      style={{
        // ...existing
        opacity: locked ? 0.5 : 1,
        cursor: locked ? 'default' : 'pointer',
      }}
      onClick={handleTap}
    >
      {/* ...existing chip content */}
      {locked && (
        <span style={{ fontSize: 9, color: 'var(--pulse-text-3)', marginTop: 2 }}>in</span>
      )}
    </button>
  );
}
```

- [ ] **Step 7.5: Build + manual verify**

Run: `cd apps/client && npm run build`
Expected: clean.

Dev server: tap "Add" on a DM you created. PickingBanner says "Add to conversation". Current DM partner chip is locked (can't toggle). Pick another player. "Add 1" button appears at the bottom. Tap → ADD_MEMBER fires; channel gains the new member. If this promotes DM → GROUP_DM, the sheet reacts (next task).

- [ ] **Step 7.6: Commit**

```bash
git add apps/client/src/shells/pulse/components/caststrip/PickingBanner.tsx apps/client/src/shells/pulse/components/caststrip/CastStrip.tsx apps/client/src/shells/pulse/components/caststrip/CastChip.tsx
git commit -m "feat(pulse): PickingBanner add-mode variant + locked chips

Banner title flips to 'Add to conversation' in add-member mode. Cast
Strip disables chips for players already in the target channel with a
subtle 'in' indicator. Prevents picking duplicates.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `DmGroupHero` computed title + pending member rendering

**Files:**
- Modify: `apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx`

- [ ] **Step 8.1: Swap literal "Group DM" for computed title**

Edit `DmGroupHero.tsx`:

```tsx
const title = useGameStore(s => s.selectGroupDmTitle(channelId));

// Replace the static "Group DM" text with:
<h2>{title}</h2>
```

- [ ] **Step 8.2: Render pending members at reduced opacity**

Check if `DmGroupHero` currently reads `channel.pendingMemberIds`. If not, add it:

```tsx
const channel = useGameStore(s => s.channels[channelId]);
const memberIds = channel?.memberIds ?? [];
const pendingIds = channel?.pendingMemberIds ?? [];

{[...memberIds, ...pendingIds].map(id => {
  const isPending = pendingIds.includes(id);
  return (
    <div key={id} style={{ opacity: isPending ? 0.5 : 1 }}>
      <PersonaImage /* ...props */ />
      {isPending && <span style={{ fontSize: 10 }}>Pending</span>}
    </div>
  );
})}
```

- [ ] **Step 8.3: Build + manual verify**

Run: `cd apps/client && npm run build`
Expected: clean.

Dev server: open a group DM. Title shows "Alice, Bob" (not "Group DM"). In invite mode, an invited but unaccepted member appears at 50% opacity with "Pending" label.

- [ ] **Step 8.4: Commit**

```bash
git add apps/client/src/shells/pulse/components/dm-sheet/DmGroupHero.tsx
git commit -m "feat(pulse): DmGroupHero computed title + pending member state

Replaces literal 'Group DM' with selectGroupDmTitle output (first-name
comma-joined, +N overflow past 3). Pending members from invite mode
render at 50% opacity with 'Pending' label.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Narrator line `kind` disambiguation

**Files:**
- Modify: wherever Phase 1.5 placed the narrator line renderer. Per memory: inline in `ChatView.tsx`. Grep `rg "DM_INVITE_SENT" apps/client/src` to locate.

- [ ] **Step 9.1: Locate the narrator reader**

Run: `rg "DM_INVITE_SENT" apps/client/src`
Expected: a consumer in `ChatView.tsx` or a narrator helper file it calls.

- [ ] **Step 9.2: Branch on `fact.payload.kind`**

Edit the narrator reader:

```tsx
// In the facts → narrator-line mapping
if (fact.type === 'DM_INVITE_SENT') {
  const kind = fact.payload?.kind ?? 'initial';  // default for backward compat
  const targetNames = (fact.payload?.memberIds ?? [])
    .map((id: string) => roster[id]?.personaName?.split(' ')[0])
    .filter(Boolean)
    .join(', ');
  const actorName = roster[fact.actorId]?.personaName?.split(' ')[0] ?? '';

  const isMeActor = fact.actorId === playerId;
  const iAmInvited = (fact.payload?.memberIds ?? []).includes(playerId);

  if (kind === 'add_member') {
    if (isMeActor) return `You added ${targetNames} to this chat`;
    if (iAmInvited) return `${actorName} added you to this chat`;
    return `${actorName} added ${targetNames} to this chat`;
  }

  // kind === 'initial'
  if (isMeActor) return `You started a chat with ${targetNames}`;
  if (iAmInvited) return `${actorName} invited you to a chat`;
  return `${actorName} started a chat with ${targetNames}`;
}
```

- [ ] **Step 9.3: Build + manual verify**

Run: `cd apps/client && npm run build`
Expected: clean.

Dev server: create a DM, verify narrator line reads "You started a chat with Alice". Promote via Add → verify a new line "You added Bob to this chat" appears. From the other profile, verify the right second-person line renders.

- [ ] **Step 9.4: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/ChatView.tsx
git commit -m "feat(pulse): narrator disambiguates DM_INVITE_SENT by kind

Add-member facts render 'You added Bob to this chat' / 'Alice added
you to this chat'. Initial invites keep the existing 'started a chat'
phrasing. Defaults to 'initial' if kind is absent (backward compat).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Rejection toast for `UNAUTHORIZED` ADD_MEMBER

**Files:**
- Modify: wherever the `Events.Rejection.CHANNEL` handler lives in the client. Grep: `rg "Events.Rejection.CHANNEL|CHANNEL.*rejection" apps/client/src`

- [ ] **Step 10.1: Locate the rejection handler**

Find the client code that handles `Events.Rejection.CHANNEL` messages from the server. Phase 1.5 added a rejection pipeline; identify it.

- [ ] **Step 10.2: Map `UNAUTHORIZED` to the creator-only toast**

Extend the existing rejection → toast mapping:

```ts
import { toast } from 'sonner';

// inside the handler
if (reason === 'UNAUTHORIZED') {
  toast.error('Only the creator can add members');
}
```

Preserve existing reason mappings — only ADD the UNAUTHORIZED-specific case if absent.

- [ ] **Step 10.3: Manual verify**

Dev server with two profiles:
1. Profile A creates a 3-person GROUP_DM with B and C.
2. Profile B (not creator) opens the group, "Add" button not visible (blocked client-side by `selectCanAddMemberTo`).
3. Force the flow from DevTools: `useGameEngine().addMembersToChannel('<channelId>', ['p4'])` from Profile B's console.
4. Server rejects with `UNAUTHORIZED`; toast "Only the creator can add members" appears.

- [ ] **Step 10.4: Commit**

```bash
# file list depends on Step 10.1 findings
git commit -m "feat(pulse): toast 'Only the creator can add members' on UNAUTHORIZED

Maps Events.Rejection.CHANNEL reason='UNAUTHORIZED' to sonner error
toast. Client hides the Add button in this case, so the toast only
fires if a direct engine call races past the UI guard.

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
Expected: no regressions. Prior Phase 1.5 tests + Plan A tests + new tests all green.

- [ ] **Step 11.3: Manual integration pass**

Start dev server; verify cwd. Clear cookies + localStorage. Open a fresh multi-player game (at least 3 alive players).

Golden path:
1. Create a 1:1 DM with Alice. Narrator line: "You started a chat with Alice". Header shows "Alice". Ring/typing works (from Plan A).
2. Tap "Add" in header. Banner reads "Add to conversation". Alice's chip is locked. Pick Bob. "Add 1" button appears. Tap.
3. Sheet re-renders as group: title flips to "Alice, Bob". Narrator adds "You added Bob to this chat".
4. From Bob's profile: sees narrator "Alice added you to this chat" (or "initial" if first time he sees the channel — verify narrator behavior).
5. `/silver` chip visible in group (`SILVER_TRANSFER` cap). `/nudge` chip NOT visible (NUDGE stripped on promotion).
6. Add Carol to the group. Title becomes "Alice, Bob, Carol".
7. Add Dan. Title becomes "Alice, Bob +2".
8. From Carol's profile (not creator), no "Add" button.
9. Force ADD_MEMBER from Carol's console → rejection toast "Only the creator can add members".

- [ ] **Step 11.4: Stop and report**

Summarize: what shipped, test counts, any deviations from plan. Phase 2 is complete — Plan A + Plan B both landed. Ask user whether to trigger Task 9 playtest from Phase 1.5 now (consolidated playtest of all Phase 1.5 + Phase 2 work) or pause.

---

## Self-Review

**Spec coverage check (against `2026-04-13-pulse-dm-flow-extensions-design.md`):**

- §1 Server: `addMemberToChannel` promotion + NUDGE strip — Task 2.
- §1 Server: `DM_INVITE_SENT` kind — Task 1.
- §2 Client: Add button entry point — Task 6.
- §2 Client: PickingBanner add-mode, locked chips — Task 7.
- §2 Client: `addMembersToChannel` engine method — Task 5.
- §2 Client: `pickingMode` discriminated union — Task 3.
- §3 Client: computed group DM title — Task 8.
- §3 Client: pending-member rendering — Task 8.
- §3 Client: narrator disambiguation via `kind` — Task 9.
- §Selectors: `selectCanAddMemberTo`, `selectAvailableAddTargets`, `selectGroupDmTitle` — Task 4.
- §Risks: UNAUTHORIZED toast — Task 10.

**Type consistency:** `pickingMode` shape defined in Task 3 and consumed in Tasks 3 (StartPickedCta), 7 (PickingBanner, CastStrip). `addMembersToChannel` signature matches between Task 5 (engine) and Task 3.7 (StartPickedCta consumer). Selectors in Task 4 match consumer signatures in Tasks 6 (`selectCanAddMemberTo`), 7 (`selectAvailableAddTargets` — note: spec defines it but actual use case is implicit via CastStrip locked-set derivation; not directly consumed), 8 (`selectGroupDmTitle`).

Actually — `selectAvailableAddTargets` is defined in Task 4 but never consumed by any later task (CastStrip derives lockedIds directly from channel membership). Either (a) drop the selector as unused, or (b) refactor CastStrip to use it. **Fix:** drop it in Task 4.3 — keep the store lean.

**Placeholder scan:** Task 2.1 test has a `/* lookup */` placeholder for channelId resolution and a `makeContext` helper stub. Acceptable because the executor mirrors existing test patterns (explicitly noted). Task 10 file list deliberately omitted (grep-dependent) — acceptable with Step 10.1 grep step first.

**Deferred / intentional:**
- `selectAvailableAddTargets` dropped (see above — will remove from the plan inline).
