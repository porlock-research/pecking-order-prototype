# DM Invite Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a configurable DM invitation system with daily slot limits, unified channel model, and blurred/locked conversation UI.

**Architecture:** Config-driven `requireDmInvite` flag gates L3 between direct DMs and invite flow. Unified PRIVATE channel type replaces DM/GROUP_DM. Client renders blurred invite cards with accept/decline overlay. Contextual chat actions pattern for invite-to-conversation and send-silver.

**Tech Stack:** TypeScript, XState v5.26.0, Zod, React 19, Zustand, Tailwind CSS, Framer Motion, Vitest

**Design doc:** `docs/plans/2026-03-10-dm-invite-flow-design.md`

---

## Task 1: Shared Types — Config Fields + PendingInvite Refactor

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/events.ts`

**Context:** The shared-types package is the contract between server and client. We need to add the config flag, refactor PendingInvite to per-recipient model, add the PRIVATE channel type, and add new fact types. Existing events (INVITE_DM, ACCEPT_DM, DECLINE_DM) already exist in events.ts — no changes needed there.

**Step 1: Add config fields to PeckingOrderSocialRules**

In `packages/shared-types/src/index.ts`, find `PeckingOrderSocialRules` (around line 220). Add two new fields:

```typescript
// Add to PeckingOrderSocialRules / PeckingOrderSocialRulesSchema
requireDmInvite: z.boolean().default(false),
dmSlotsPerPlayer: z.number().min(1).max(20).default(5),
```

**Step 2: Add PRIVATE to ChannelTypeSchema**

Find `ChannelTypeSchema` (around line 430). Add `'PRIVATE'`:

```typescript
const ChannelTypeSchema = z.enum(['MAIN', 'DM', 'GROUP_DM', 'GAME_DM', 'PRIVATE']);
```

**Step 3: Refactor PendingInvite to per-recipient model**

Find `PendingInvite` interface (around line 469). Replace with:

```typescript
export interface PendingInvite {
  id: string;
  channelId: string;
  senderId: string;
  recipientId: string;         // singular — one record per recipient
  status: 'pending' | 'accepted' | 'declined';
  timestamp: number;
}
```

This replaces the old shape that had `recipientIds[]`, `acceptedBy[]`, `declinedBy[]`, `type`.

**Step 4: Add new fact types**

Find the fact type constants or journal event types. Add:

```typescript
// In the appropriate location (FactType enum or similar)
DM_INVITE_SENT = 'DM_INVITE_SENT',
DM_INVITE_ACCEPTED = 'DM_INVITE_ACCEPTED',
DM_INVITE_DECLINED = 'DM_INVITE_DECLINED',
```

**Step 5: Add `requireDmInvite` and `dmSlotsPerPlayer` to DailyManifest**

Find `DailyManifest` (around line 108). Add optional fields:

```typescript
requireDmInvite?: boolean;
dmSlotsPerPlayer?: number;
```

**Step 6: Build and verify types compile**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: Compilation errors in downstream consumers (l3-social.ts, l3-session.ts, useGameStore.ts) because PendingInvite shape changed. This is expected — we fix those in later tasks.

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: Type errors (expected at this stage).

**Step 7: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add DM invite config, PRIVATE channel type, refactor PendingInvite"
```

---

## Task 2: L3 Context + buildL3Context

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts` (lines 16-94)

**Context:** L3's `DailyContext` needs new fields for the invite config and slot tracking. `buildL3Context` reads from the manifest to initialize context for each day.

**Step 1: Update DailyContext interface**

Find `DailyContext` (around line 16). Replace `acceptedConversationsByPlayer` and `maxConversationsPerDay` with:

```typescript
// Replace existing fields:
pendingInvites: PendingInvite[];          // keep, now per-recipient model
slotsUsedByPlayer: Record<string, number>; // replaces acceptedConversationsByPlayer
requireDmInvite: boolean;                  // new
dmSlotsPerPlayer: number;                  // replaces maxConversationsPerDay
```

**Step 2: Update DailyEvent union types**

Find the event type definitions (around lines 58-60). Update to match new model:

```typescript
| { type: typeof Events.Social.INVITE_DM; senderId: string; recipientIds: string[]; channelId?: string }
| { type: typeof Events.Social.ACCEPT_DM; senderId: string; channelId: string }
| { type: typeof Events.Social.DECLINE_DM; senderId: string; channelId: string }
```

Note: `ACCEPT_DM` and `DECLINE_DM` now use `channelId` instead of `inviteId` (cleaner — recipient knows the channel, not the invite ID).

**Step 3: Update buildL3Context**

Find `buildL3Context` (around line 65). Update initialization:

```typescript
pendingInvites: [],
slotsUsedByPlayer: {},
requireDmInvite: manifest.requireDmInvite ?? false,
dmSlotsPerPlayer: manifest.dmSlotsPerPlayer ?? 5,
```

Read from the day's manifest, with backward-compatible defaults.

**Step 4: Verify types compile**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: Still errors in l3-social.ts (actions reference old fields). Fix in next task.

**Step 5: Commit**

```bash
git add apps/game-server/src/machines/l3-session.ts
git commit -m "feat(l3): update DailyContext with invite config and slot tracking"
```

---

## Task 3: L3 Social Actions — Invite/Accept/Decline Refactor

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts`

**Context:** The existing invite actions use the old PendingInvite model (recipientIds[], acceptedBy[], declinedBy[]). We refactor to per-recipient records, add slot tracking, add FACT.RECORD calls, and support invite-to-existing-channel. The config guard routes between direct and invite flows.

**Step 1: Update createPendingInvite action**

Find `createPendingInvite` (around line 245). Refactor to:

```typescript
// When no channelId provided: create new channel + invites
// When channelId provided: invite to existing channel (no slot cost for sender)
export const createPendingInvite = assign<DailyContext, InviteDmEvent>(({ context, event }) => {
  const { senderId, recipientIds, channelId: existingChannelId } = event;
  const isNewConversation = !existingChannelId;

  // Create channel if new conversation
  let channelId = existingChannelId;
  let channels = { ...context.channels };
  if (isNewConversation) {
    channelId = crypto.randomUUID();
    channels[channelId] = {
      id: channelId,
      type: 'PRIVATE',
      memberIds: [senderId],
      createdBy: senderId,
      createdAt: Date.now(),
    };
  }

  // Fan out: one PendingInvite per recipient
  const newInvites: PendingInvite[] = recipientIds.map(recipientId => ({
    id: crypto.randomUUID(),
    channelId: channelId!,
    senderId,
    recipientId,
    status: 'pending' as const,
    timestamp: Date.now(),
  }));

  // Slot cost: only for new conversations
  const slotsUsed = { ...context.slotsUsedByPlayer };
  if (isNewConversation) {
    slotsUsed[senderId] = (slotsUsed[senderId] ?? 0) + 1;
  }

  return {
    channels,
    pendingInvites: [...context.pendingInvites, ...newInvites],
    slotsUsedByPlayer: slotsUsed,
  };
});
```

**Step 2: Update acceptDmInvite action**

Find `acceptDmInvite` (around line 268). Refactor to:

```typescript
export const acceptDmInvite = assign<DailyContext, AcceptDmEvent>(({ context, event }) => {
  const { senderId: acceptorId, channelId } = event;

  // Find the invite for this recipient + channel
  const updatedInvites = context.pendingInvites.map(inv =>
    inv.channelId === channelId && inv.recipientId === acceptorId && inv.status === 'pending'
      ? { ...inv, status: 'accepted' as const }
      : inv
  );

  // Add acceptor to channel members
  const channels = { ...context.channels };
  const channel = channels[channelId];
  if (channel && !channel.memberIds.includes(acceptorId)) {
    channels[channelId] = {
      ...channel,
      memberIds: [...channel.memberIds, acceptorId],
    };
  }

  // Consume a slot for the acceptor
  const slotsUsed = { ...context.slotsUsedByPlayer };
  slotsUsed[acceptorId] = (slotsUsed[acceptorId] ?? 0) + 1;

  return {
    channels,
    pendingInvites: updatedInvites,
    slotsUsedByPlayer: slotsUsed,
  };
});
```

**Step 3: Update declineDmInvite action**

Find `declineDmInvite` (around line 313). Refactor to:

```typescript
export const declineDmInvite = assign<DailyContext, DeclineDmEvent>(({ context, event }) => {
  const { senderId: declinerId, channelId } = event;

  const updatedInvites = context.pendingInvites.map(inv =>
    inv.channelId === channelId && inv.recipientId === declinerId && inv.status === 'pending'
      ? { ...inv, status: 'declined' as const }
      : inv
  );

  return { pendingInvites: updatedInvites };
  // No slot consumed for declining
});
```

**Step 4: Update canInviteDm guard**

Find `canInviteDm` (around line 380). Update to use new fields:

```typescript
export const canInviteDm: Guard<DailyContext, InviteDmEvent> = ({ context, event }) => {
  const { senderId, recipientIds, channelId: existingChannelId } = event;
  if (!context.dmsOpen) return false;

  const roster = context.roster;
  if (!roster[senderId]?.isAlive) return false;
  if (recipientIds.some(id => id === senderId)) return false;
  if (recipientIds.some(id => !roster[id]?.isAlive)) return false;

  // Slot check only for new conversations
  if (!existingChannelId) {
    const used = context.slotsUsedByPlayer[senderId] ?? 0;
    if (used >= context.dmSlotsPerPlayer) return false;
  }

  // If inviting to existing channel, sender must be a member
  if (existingChannelId) {
    const channel = context.channels[existingChannelId];
    if (!channel || !channel.memberIds.includes(senderId)) return false;
  }

  // No duplicate invites
  for (const rid of recipientIds) {
    const existing = context.pendingInvites.find(
      inv => inv.channelId === (existingChannelId ?? '') && inv.recipientId === rid && inv.status === 'pending'
    );
    if (existing) return false;

    // For existing channels, check if already a member
    if (existingChannelId) {
      const channel = context.channels[existingChannelId];
      if (channel?.memberIds.includes(rid)) return false;
    }
  }

  return true;
};
```

**Step 5: Update canAcceptDm guard**

Find `canAcceptDm` (around line 419). Update:

```typescript
export const canAcceptDm: Guard<DailyContext, AcceptDmEvent> = ({ context, event }) => {
  const { senderId: acceptorId, channelId } = event;

  const invite = context.pendingInvites.find(
    inv => inv.channelId === channelId && inv.recipientId === acceptorId && inv.status === 'pending'
  );
  if (!invite) return false;

  const used = context.slotsUsedByPlayer[acceptorId] ?? 0;
  if (used >= context.dmSlotsPerPlayer) return false;

  return true;
};
```

**Step 6: Add FACT.RECORD calls**

The invite, accept, and decline actions need to send facts to the parent. Since `sendParent()` inside `assign()` is a no-op in XState v5, these need to be split into separate actions or use `enqueueActions`. Find how existing facts are emitted (likely `enqueueActions` with `enqueue.sendTo`) and follow the same pattern. Add:

- `recordInviteSentFact` — emits `DM_INVITE_SENT` per recipient
- `recordInviteAcceptedFact` — emits `DM_INVITE_ACCEPTED`
- `recordInviteDeclinedFact` — emits `DM_INVITE_DECLINED`

**Step 7: Add config-driven routing guard**

Add a guard that checks `requireDmInvite`:

```typescript
export const isInviteModeEnabled: Guard<DailyContext> = ({ context }) =>
  context.requireDmInvite === true;
```

This will be used in l3-session.ts to route SOCIAL.SEND_MSG — when invite mode is on and a player tries to message a channel they're not a member of, reject with `INVITE_REQUIRED`.

**Step 8: Verify types compile**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: Should compile (or close to it — tests will have errors due to changed model).

**Step 9: Commit**

```bash
git add apps/game-server/src/machines/actions/l3-social.ts
git commit -m "feat(l3): refactor invite actions to per-recipient model with slot tracking"
```

---

## Task 4: L3 Session Wiring — Config-Driven Routing

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts` (lines 162-176)

**Context:** L3's state machine needs to route events based on `requireDmInvite`. When invite mode is off, existing CREATE_CHANNEL and SEND_MSG behavior is unchanged. When on, SEND_MSG to a non-member channel is rejected.

**Step 1: Update SOCIAL.INVITE_DM handler**

The handler already exists (around line 166). Update guard references and add fact recording:

```typescript
{
  [Events.Social.INVITE_DM]: {
    guard: 'canInviteDm',
    actions: ['createPendingInvite', 'recordInviteSentFacts'],
  },
}
```

**Step 2: Update SOCIAL.ACCEPT_DM handler**

```typescript
{
  [Events.Social.ACCEPT_DM]: {
    guard: 'canAcceptDm',
    actions: ['acceptDmInvite', 'recordInviteAcceptedFact'],
  },
}
```

Add rejection path: if guard fails because of slot limit, send rejection to client.

**Step 3: Update SOCIAL.DECLINE_DM handler**

```typescript
{
  [Events.Social.DECLINE_DM]: {
    actions: ['declineDmInvite', 'recordInviteDeclinedFact'],
  },
}
```

**Step 4: Add SEND_MSG membership guard for invite mode**

Add a guard to the SOCIAL.SEND_MSG handler that, when `requireDmInvite` is true, checks that the sender is a member of the target channel for PRIVATE channels. If not, reject with `INVITE_REQUIRED`.

**Step 5: Register new guards and actions in setup()**

In the machine's `setup({ guards, actions })`, register:
- `canInviteDm`, `canAcceptDm`, `isInviteModeEnabled`
- `createPendingInvite`, `acceptDmInvite`, `declineDmInvite`
- `recordInviteSentFacts`, `recordInviteAcceptedFact`, `recordInviteDeclinedFact`

**Step 6: Verify types compile**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: Compiles. Tests still need updating.

**Step 7: Commit**

```bash
git add apps/game-server/src/machines/l3-session.ts
git commit -m "feat(l3): wire config-driven DM invite routing in session machine"
```

---

## Task 5: L3 Tests — Invite Flow

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts`

**Context:** The existing test file covers the old PendingInvite model. Refactor all tests to use the new per-recipient model and add tests for:
- Config toggle (requireDmInvite on/off)
- Slot tracking (create = 1 slot, accept = 1 slot, decline = free, invite-to-existing = free)
- Unified channel (PRIVATE type, UUID IDs, mutable membership)
- Fact recording (DM_INVITE_SENT, ACCEPTED, DECLINED)
- Day reset (fresh slots, expired invites)
- Group invite fan-out (1 invite action → N PendingInvite records)
- Invite to existing conversation

**Step 1: Update test helpers**

Update the test's actor creation to include `requireDmInvite: true` and `dmSlotsPerPlayer: 5` in the context.

Create a helper variant with `requireDmInvite: false` to test backward compatibility.

**Step 2: Write tests for config toggle**

```typescript
describe('config toggle', () => {
  it('requireDmInvite=false allows direct SEND_MSG to create channels', ...);
  it('requireDmInvite=true rejects SEND_MSG to non-member channel', ...);
  it('requireDmInvite=true allows INVITE_DM flow', ...);
});
```

**Step 3: Write tests for slot tracking**

```typescript
describe('slot tracking', () => {
  it('creating a conversation consumes 1 sender slot', ...);
  it('accepting an invite consumes 1 recipient slot', ...);
  it('declining does not consume a slot', ...);
  it('inviting to existing channel does not consume sender slot', ...);
  it('rejects invite when sender at slot limit', ...);
  it('rejects accept when recipient at slot limit', ...);
  it('slot limit is configurable via dmSlotsPerPlayer', ...);
});
```

**Step 4: Write tests for unified channel model**

```typescript
describe('unified channel model', () => {
  it('creates PRIVATE channel with UUID on invite', ...);
  it('creator is sole member initially', ...);
  it('acceptor added to members with joinedAt', ...);
  it('multiple recipients create fan-out invites', ...);
  it('invite to existing channel adds new invites', ...);
  it('cannot invite someone already in channel', ...);
});
```

**Step 5: Write tests for fact recording**

```typescript
describe('fact recording', () => {
  it('records DM_INVITE_SENT fact per recipient', ...);
  it('records DM_INVITE_ACCEPTED fact on accept', ...);
  it('records DM_INVITE_DECLINED fact on decline', ...);
});
```

**Step 6: Run tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-dm-invitations.test.ts`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add apps/game-server/src/machines/__tests__/l3-dm-invitations.test.ts
git commit -m "test(l3): comprehensive DM invite flow tests with config toggle and slots"
```

---

## Task 6: normalizeManifest + Backward Compatibility

**Files:**
- Modify: `packages/shared-types/src/index.ts` (normalizeManifest function)
- Modify: `apps/game-server/src/machines/l2-orchestrator.ts` (if normalizeManifest is called there)

**Context:** Old snapshots and static manifests won't have the new fields. `normalizeManifest()` must fill defaults so existing games keep working.

**Step 1: Update normalizeManifest**

Find `normalizeManifest()` in shared-types. Add defaults:

```typescript
// For each day in manifest.days:
day.requireDmInvite = day.requireDmInvite ?? false;
day.dmSlotsPerPlayer = day.dmSlotsPerPlayer ?? 5;
```

Also handle the ruleset level for dynamic manifests:

```typescript
if (manifest.kind === 'DYNAMIC' && manifest.ruleset?.social) {
  manifest.ruleset.social.requireDmInvite = manifest.ruleset.social.requireDmInvite ?? false;
  manifest.ruleset.social.dmSlotsPerPlayer = manifest.ruleset.social.dmSlotsPerPlayer ?? 5;
}
```

**Step 2: Verify speed-run still works**

Run the speed-run command (`/speed-run`) to confirm existing CONFIGURABLE_CYCLE games work with `requireDmInvite: false` (default).

Run: Game server must be running on port 8787 first.

**Step 3: Commit**

```bash
git add packages/shared-types/ apps/game-server/
git commit -m "feat: normalize manifest defaults for DM invite config"
```

---

## Task 7: Client Store — Selectors + Sync

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`

**Context:** The store already has `pendingInvites` and selectors. We need to update for the new PendingInvite shape and add slot-related state.

**Step 1: Update PendingInvite references**

The type import will pick up the new shape from shared-types. Update `selectMyPendingInvites` and `selectMySentInvites`:

```typescript
// Received invites (I'm the recipient, status is pending)
export const selectMyPendingInvites = (state: GameState): PendingInvite[] =>
  state.pendingInvites.filter(inv => inv.recipientId === state.playerId && inv.status === 'pending');

// Sent invites (I'm the sender, status is pending)
export const selectMySentInvites = (state: GameState): PendingInvite[] =>
  state.pendingInvites.filter(inv => inv.senderId === state.playerId && inv.status === 'pending');
```

**Step 2: Add invite mode selector**

```typescript
export const selectRequireDmInvite = (state: GameState): boolean =>
  state.manifest?.days?.[state.dayIndex - 1]?.requireDmInvite ?? false;

export const selectDmSlots = (state: GameState): { used: number; total: number } => {
  const total = state.manifest?.days?.[state.dayIndex - 1]?.dmSlotsPerPlayer ?? 5;
  const used = state.dmStats?.slotsUsed ?? 0;
  return { used, total };
};
```

**Step 3: Update dmStats to include slotsUsed**

The SYNC payload should include the player's current slot usage. Update the sync handler to read this from the server payload:

```typescript
dmStats: {
  ...existing fields...,
  slotsUsed: data.context?.slotsUsedByPlayer?.[state.playerId] ?? 0,
}
```

**Step 4: Verify client builds**

Run: `cd apps/client && npx tsc --noEmit`
Expected: Compiles.

**Step 5: Commit**

```bash
git add apps/client/src/store/useGameStore.ts
git commit -m "feat(client): update store selectors for DM invite flow"
```

---

## Task 8: Client UI — Whispers Invite Cards

**Files:**
- Modify: `apps/client/src/shells/vivid/components/WhispersTab.tsx`

**Context:** The Whispers conversation list needs to show received invites as blurred entries, and sent invites with pending badges. All entries ordered by last event timestamp.

**Step 1: Import selectors**

Add imports for `selectMyPendingInvites`, `selectMySentInvites`, `selectRequireDmInvite`, `selectDmSlots`.

**Step 2: Build unified conversation list**

Merge three sources into one list sorted by timestamp:
1. Active conversations (existing) — user is a member
2. Sent invites (pending) — user is sender, show with "pending" badge
3. Received invites (pending) — user is recipient, show with blurred preview

```typescript
// Each list item has: channelId, type ('active' | 'sent-pending' | 'received-pending'), timestamp, participants
```

**Step 3: Render received invites with blur**

For `received-pending` entries, render the conversation card with:

```tsx
<div className="relative">
  <div className="blur-sm pointer-events-none">
    {/* Normal conversation entry: avatar, name, message preview */}
  </div>
  <div className="absolute inset-0 flex items-center justify-center">
    <span className="text-xs font-mono text-skin-dim">Tap to view invite</span>
  </div>
</div>
```

**Step 4: Render sent invites with pending badge**

For `sent-pending` entries, render the normal conversation card with a small "pending" label:

```tsx
<span className="text-[10px] font-mono text-skin-dim bg-skin-panel/60 px-2 py-0.5 rounded-full">
  pending
</span>
```

**Step 5: Add slot counter to header**

When invite mode is on, show remaining slots near the WHISPERS header:

```tsx
{requireDmInvite && (
  <span className="text-xs font-mono text-skin-dim">
    {slots.total - slots.used}/{slots.total}
  </span>
)}
```

**Step 6: Verify client builds and renders**

Run: `cd apps/client && npm run build`
Test manually with demo or local dev.

**Step 7: Commit**

```bash
git add apps/client/src/shells/vivid/components/WhispersTab.tsx
git commit -m "feat(vivid): blurred invite cards and slot counter in Whispers tab"
```

---

## Task 9: Client UI — Locked Conversation View

**Files:**
- Modify: `apps/client/src/shells/vivid/components/DMChat.tsx`
- Create: `apps/client/src/shells/vivid/components/InviteOverlay.tsx`

**Context:** When a recipient taps a received invite, the conversation opens in a locked state with messages blurred behind an accept/decline overlay.

**Step 1: Create InviteOverlay component**

```tsx
// InviteOverlay.tsx
interface InviteOverlayProps {
  invite: PendingInvite;
  channelMembers: string[];
  roster: Record<string, SocialPlayer>;
  slotsRemaining: number;
  slotsTotal: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function InviteOverlay({ invite, channelMembers, roster, slotsRemaining, slotsTotal, onAccept, onDecline }: InviteOverlayProps) {
  const sender = roster[invite.senderId];
  const isGroup = channelMembers.length > 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-skin-panel/80 backdrop-blur-sm"
    >
      {/* Sender avatar */}
      {/* "X wants to chat" or group member list */}
      {/* Slots remaining: "3 of 5 conversations remaining today" */}

      <div className="flex gap-3 mt-6">
        <button onClick={onDecline} className="...decline styles...">Decline</button>
        <button onClick={onAccept} className="...accept styles...">Accept</button>
      </div>
    </motion.div>
  );
}
```

**Step 2: Integrate into DMChat**

In `DMChat.tsx`, detect if the current conversation is a received pending invite (user is `recipientId`, status is `pending`). If so:

```tsx
const isLockedInvite = myPendingInvites.some(inv => inv.channelId === channelId);

return (
  <div className="relative h-full">
    {/* Messages rendered but blurred when locked */}
    <div className={isLockedInvite ? 'blur-md pointer-events-none' : ''}>
      {/* existing message list */}
    </div>

    <AnimatePresence>
      {isLockedInvite && (
        <InviteOverlay
          invite={invite}
          onAccept={() => engine.send({ type: Events.Social.ACCEPT_DM, channelId })}
          onDecline={() => engine.send({ type: Events.Social.DECLINE_DM, channelId })}
          {...otherProps}
        />
      )}
    </AnimatePresence>

    {/* Input disabled when locked */}
    {!isLockedInvite && <ChatInput ... />}
  </div>
);
```

**Step 3: Handle accept animation**

On accept, the overlay animates out (`exit={{ opacity: 0 }}`) and the blur drops, revealing messages. Use Framer Motion's `AnimatePresence` for smooth transition.

**Step 4: Handle decline navigation**

On decline, send the event and navigate back to the Whispers list. The declined invite will be removed from the pending list on next SYNC.

**Step 5: Verify UI**

Test with local dev: create a game with `requireDmInvite: true`, connect as two players, send an invite from one, verify the locked view on the other.

**Step 6: Commit**

```bash
git add apps/client/src/shells/vivid/components/DMChat.tsx apps/client/src/shells/vivid/components/InviteOverlay.tsx
git commit -m "feat(vivid): locked conversation view with accept/decline overlay"
```

---

## Task 10: Client UI — Contextual Chat Actions

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`
- Create: `apps/client/src/shells/vivid/components/ChatActions.tsx`

**Context:** The chat input gains a `+` button that opens an action tray. Actions are chat-native — they produce visible events in the conversation. For this feature: invite player and send silver.

**Step 1: Create ChatActions component**

```tsx
// ChatActions.tsx
interface ChatActionsProps {
  channelId: string;
  onInvitePlayer: () => void;
  onSendSilver: () => void;
  onClose: () => void;
}

export function ChatActions({ onInvitePlayer, onSendSilver, onClose }: ChatActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex gap-2 p-2"
    >
      <button onClick={onInvitePlayer} className="...">
        <UserPlus size={16} /> Invite Player
      </button>
      <button onClick={onSendSilver} className="...">
        <Coins size={16} /> Send Silver
      </button>
    </motion.div>
  );
}
```

**Step 2: Add + button to ChatInput**

In `ChatInput.tsx`, add a `+` button to the left of the text input:

```tsx
<button onClick={() => setShowActions(!showActions)} className="...">
  <Plus size={18} />
</button>
```

When tapped, toggle the `ChatActions` tray above the input.

**Step 3: Wire invite player action**

Tapping "Invite Player" opens a player picker (reuse/adapt from NewDmPicker) scoped to alive players not already in the channel. On selection, send `SOCIAL.INVITE_DM` with `{ channelId, recipientIds: [selectedId] }`.

**Step 4: Wire send silver action**

Move existing send silver functionality into this pattern. On tap, show amount picker, then send `SOCIAL.SEND_SILVER` event. This produces a visible system message in the conversation.

**Step 5: Verify UI**

Test in local dev: open a DM, tap +, verify invite and silver actions work.

**Step 6: Commit**

```bash
git add apps/client/src/shells/vivid/components/ChatInput.tsx apps/client/src/shells/vivid/components/ChatActions.tsx
git commit -m "feat(vivid): contextual chat actions with invite player and send silver"
```

---

## Task 11: Client — New Conversation Flow (Replace NewDmPicker + NewGroupPicker)

**Files:**
- Create: `apps/client/src/shells/vivid/components/NewConversationPicker.tsx`
- Modify: `apps/client/src/shells/vivid/VividShell.tsx`

**Context:** With the unified channel model, we replace the separate DM and Group buttons/pickers with a single "New Conversation" flow. Player picks 1+ recipients, sends invite (when invite mode on) or creates channel directly (when off).

**Step 1: Create NewConversationPicker**

Unified picker that lets the player select 1 or more alive players:

```tsx
// NewConversationPicker.tsx
interface Props {
  roster: Record<string, SocialPlayer>;
  playerId: string;
  requireDmInvite: boolean;
  onStart: (recipientIds: string[]) => void;
  onBack: () => void;
}
```

- Shows alive players (excluding self) as selectable entries
- Multi-select with checkboxes
- Bottom bar shows "Start Conversation (N selected)" button
- When `requireDmInvite` is on, button says "Send Invite (N selected)"

**Step 2: Update VividShell to use unified picker**

Replace `showNewDm` + `showNewGroup` state with single `showNewConversation`. Replace both overlay renders with `NewConversationPicker`.

Wire `onStart`:
- If `requireDmInvite`: send `SOCIAL.INVITE_DM` with `{ recipientIds }`
- If not: send `SOCIAL.CREATE_CHANNEL` with `{ memberIds: [playerId, ...recipientIds] }`

**Step 3: Update WhispersTab header**

Replace separate "DM" and "Group" buttons with single "New" button (or `+` icon):

```tsx
<button onClick={() => setShowNewConversation(true)} className="...">
  <Plus size={16} /> New
</button>
```

**Step 4: Remove NewDmPicker and NewGroupPicker imports**

Clean up unused imports from VividShell. The classic shell components remain for the classic shell — we only change the vivid shell.

**Step 5: Fix overlay z-index issue (DEMO-002/003/004/005)**

While refactoring the overlay, add an opaque background to the overlay wrapper:

```tsx
<div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'var(--vivid-bg-deep)' }}>
  <NewConversationPicker ... />
</div>
```

This fixes all four demo audit overlay issues in one go.

**Step 6: Verify UI**

Test both modes: invite on (sends INVITE_DM) and invite off (sends CREATE_CHANNEL).

**Step 7: Commit**

```bash
git add apps/client/src/shells/vivid/
git commit -m "feat(vivid): unified conversation picker replacing DM + Group pickers"
```

---

## Task 12: Lobby — Game Config Toggle

**Files:**
- Modify: `apps/lobby/app/components/DynamicRulesetBuilder.tsx`
- Modify: any static game config form (if one exists)

**Context:** Add the `requireDmInvite` toggle and `dmSlotsPerPlayer` slider to the game creation UI. Available for all game modes.

**Step 1: Add to DynamicRulesetConfig interface**

```typescript
social: {
  ...existing fields...,
  requireDmInvite: boolean;
  dmSlotsPerPlayer: number;
}
```

**Step 2: Update createDefaultDynamicConfig**

```typescript
social: {
  ...existing defaults...,
  requireDmInvite: false,
  dmSlotsPerPlayer: 5,
}
```

**Step 3: Add UI controls**

In the social section of DynamicRulesetBuilder:

```tsx
{/* Toggle */}
<label className="flex items-center gap-2">
  <input type="checkbox" checked={config.social.requireDmInvite} onChange={...} />
  Require DM invitations
</label>

{/* Conditional slider */}
{config.social.requireDmInvite && (
  <div>
    <label>Conversations per player per day: {config.social.dmSlotsPerPlayer}</label>
    <input type="range" min={2} max={10} value={config.social.dmSlotsPerPlayer} onChange={...} />
  </div>
)}
```

**Step 4: Wire into manifest construction**

Ensure `createGame()` includes `requireDmInvite` and `dmSlotsPerPlayer` in the manifest's social rules and propagates to each day's manifest.

**Step 5: Verify lobby builds**

Run: `cd apps/lobby && npm run build`

**Step 6: Commit**

```bash
git add apps/lobby/
git commit -m "feat(lobby): DM invite mode toggle and slot count config"
```

---

## Task 13: SYNC Payload + Demo Server

**Files:**
- Modify: `apps/game-server/src/sync.ts` (or wherever SYNC payload is built)
- Modify: `apps/game-server/src/demo/` (demo seed data)

**Context:** The SYNC payload needs to include `requireDmInvite`, `pendingInvites` (already included), and the player's `slotsUsed`. Demo server needs to set `requireDmInvite: false` explicitly so the demo doesn't show invite UI.

**Step 1: Update SYNC payload builder**

Ensure `requireDmInvite` from the current day's manifest is included in the SYNC context. Ensure `slotsUsedByPlayer` for the connected player is included in `dmStats`.

**Step 2: Update demo seed data**

In the demo manifest, set `requireDmInvite: false` explicitly. Demo channels keep using DM/GROUP_DM types (no migration needed for demo).

**Step 3: Verify demo still works**

Run local dev, load `/demo`, confirm no visual regressions.

**Step 4: Commit**

```bash
git add apps/game-server/
git commit -m "feat: include DM invite config in SYNC payload + demo compatibility"
```

---

## Task 14: Integration Testing + Speed Run

**Files:**
- Modify: `e2e/fixtures/game-setup.ts` (if needed for invite mode tests)

**Step 1: Run full test suite**

Run: `cd apps/game-server && npx vitest run`
Expected: All tests pass.

**Step 2: Run speed-run with default config**

Run `/speed-run` to verify existing non-invite games work.
Expected: Full game lifecycle completes as before.

**Step 3: Run speed-run with invite mode**

Create a manual test variant with `requireDmInvite: true` in the manifest. Verify:
- DM flow requires INVITE_DM → ACCEPT_DM sequence
- Slot limits enforced
- Day reset clears slots and pending invites

**Step 4: Build all apps**

Run: `npm run build`
Expected: All apps build successfully.

**Step 5: Commit any fixes**

```bash
git commit -m "fix: integration test fixes for DM invite flow"
```

---

## Summary: Task Dependency Graph

```
Task 1 (shared-types) ──┐
                         ├── Task 2 (L3 context) ──┐
                         │                          ├── Task 3 (L3 actions) ── Task 4 (L3 wiring) ── Task 5 (L3 tests)
                         │                          │
                         ├── Task 6 (normalize)     │
                         │                          │
                         ├── Task 7 (client store) ─┤
                         │                          │
                         │                          ├── Task 8 (invite cards) ── Task 9 (locked view) ── Task 10 (chat actions) ── Task 11 (picker)
                         │                          │
                         ├── Task 12 (lobby) ───────┘
                         │
                         └── Task 13 (SYNC + demo) ── Task 14 (integration)
```

Tasks 1-6 are server-side. Tasks 7-11 are client-side. Task 12 is lobby. Tasks 13-14 are integration. Server and client tracks can be worked in parallel after Task 1.
