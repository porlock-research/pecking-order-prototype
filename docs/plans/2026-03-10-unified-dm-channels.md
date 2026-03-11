# Unified DM Channel Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify invite-mode and non-invite DM channels into a single model where all channels use UUID IDs, the first message creates the channel, and invite state lives on the channel object itself (no separate PendingInvite model).

**Architecture:** Both DM flows (invite and non-invite) create channels identically. SEND_MSG with `recipientIds` (no `channelId`) triggers channel creation. In invite mode, recipients go into `pendingMemberIds` and see a blurred first-message preview; in non-invite mode, all members are active immediately. Accept/decline operate on the channel's `pendingMemberIds`. A new ADD_MEMBER event handles inviting players to existing conversations.

**Tech Stack:** TypeScript, XState v5.26.0, Zod, React 19, Zustand v5, Vitest

---

### Important context

- **Russian Doll architecture**: L1 (DO shell) → L2 (orchestrator) → L3 (daily session). Social events flow L1 → L2 → L3 via wildcard `SOCIAL.*` forwarding.
- **XState v5 pitfalls**: `sendParent()` in `assign()` is a silent no-op — split into separate actions. Invoked children don't auto-receive parent events.
- **Channels are day-scoped**: L3 context resets each day. No migration needed for existing channels.
- **Vivid shell conventions**: Inline styles with `--vivid-*` CSS variables, `@solar-icons/react` icons, framer-motion animations. NOT Tailwind classes.
- **Key rule**: Never use raw strings for events — always `Events.Social.SEND_MSG` etc. from `@pecking-order/shared-types`.
- **Zustand v5**: Selectors returning new objects/arrays MUST use `useShallow` from `zustand/react/shallow` to avoid infinite re-render loops.
- **Build before commit**: Always `npm run build` in affected apps.

### What's being removed

- `PRIVATE` channel type (use `DM` everywhere)
- `PendingInvite` interface (invite state moves to `channel.pendingMemberIds`)
- `dmChannelId()` helper (all channels use UUIDs)
- `sendDM()` in game engine (replaced by `sendToChannel` / first-message flow)
- `SOCIAL.INVITE_DM` event (first message IS the invite)
- `pendingInvites` array in L3 context and SYNC payload
- `selectMyPendingInvites`, `selectMySentInvites` store selectors

### What's being added

- `pendingMemberIds?: string[]` on `Channel` interface
- `SOCIAL.ADD_MEMBER` event (invite to existing conversation, optional message)
- UUID-based channel IDs for ALL DM/GROUP_DM channels
- First-message-creates-channel via `SEND_MSG` with `recipientIds`

---

### Task 1: shared-types — Foundation changes

**Files:**
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-types/src/events.ts`

**Step 1: Remove PRIVATE from ChannelTypeSchema**

In `packages/shared-types/src/index.ts`, find `ChannelTypeSchema` (around line 449):

```typescript
// BEFORE:
export const ChannelTypeSchema = z.enum(['MAIN', 'DM', 'GROUP_DM', 'GAME_DM', 'PRIVATE']);

// AFTER:
export const ChannelTypeSchema = z.enum(['MAIN', 'DM', 'GROUP_DM', 'GAME_DM']);
```

**Step 2: Add pendingMemberIds to Channel interface**

Find the `Channel` interface (around line 453). Add `pendingMemberIds`:

```typescript
export interface Channel {
  id: string;
  type: ChannelType;
  memberIds: string[];
  pendingMemberIds?: string[];  // ← ADD: invited but haven't accepted yet
  createdBy: string;
  createdAt: number;
  label?: string;
  gameType?: string;
  capabilities?: ChannelCapability[];
  constraints?: {
    exempt?: boolean;
    silverCost?: number;
  };
}
```

**Step 3: Remove PendingInvite interface**

Find and delete the `PendingInvite` interface (around line 488-495):

```typescript
// DELETE THIS ENTIRE BLOCK:
export interface PendingInvite {
  id: string;
  channelId: string;
  senderId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: number;
}
```

**Step 4: Remove dmChannelId function**

Find and delete `dmChannelId` (around line 469-472):

```typescript
// DELETE THIS ENTIRE BLOCK:
export function dmChannelId(a: string, b: string): string {
  const sorted = [a, b].sort();
  return `dm:${sorted[0]}:${sorted[1]}`;
}
```

**Step 5: Update events — add ADD_MEMBER, remove INVITE_DM**

In `packages/shared-types/src/events.ts`, update `Events.Social`:

```typescript
Social: {
  PREFIX: 'SOCIAL.',
  SEND_MSG: 'SOCIAL.SEND_MSG',
  SEND_SILVER: 'SOCIAL.SEND_SILVER',
  USE_PERK: 'SOCIAL.USE_PERK',
  CREATE_CHANNEL: 'SOCIAL.CREATE_CHANNEL',
  ADD_MEMBER: 'SOCIAL.ADD_MEMBER',       // ← ADD
  ACCEPT_DM: 'SOCIAL.ACCEPT_DM',
  DECLINE_DM: 'SOCIAL.DECLINE_DM',
  // INVITE_DM removed — first message IS the invite
},
```

Update `ALLOWED_CLIENT_EVENTS`:

```typescript
export const ALLOWED_CLIENT_EVENTS = [
  Events.Social.SEND_MSG,
  Events.Social.SEND_SILVER,
  Events.Social.USE_PERK,
  Events.Social.CREATE_CHANNEL,
  Events.Social.ADD_MEMBER,        // ← ADD
  Events.Social.ACCEPT_DM,
  Events.Social.DECLINE_DM,
  // INVITE_DM removed
] as const;
```

**Step 6: Remove PendingInvite from exports**

In `packages/shared-types/src/index.ts`, remove `PendingInvite` from any export statements. Search for all references to ensure none remain.

**Step 7: Build and fix compilation**

Run: `cd packages/shared-types && npm run build`

This will surface all downstream compilation errors from the removals. **Do not fix them yet** — just verify shared-types builds. Downstream fixes happen in later tasks.

**Step 8: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): unify DM channels — remove PRIVATE, PendingInvite, dmChannelId; add pendingMemberIds + ADD_MEMBER"
```

---

### Task 2: L3 context — Remove pendingInvites

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts`
- Modify: `apps/game-server/src/machines/actions/l3-context.ts` (if exists, or wherever `buildL3Context` lives)

**Step 1: Find L3 context type and remove pendingInvites**

In `l3-session.ts`, find the context type definition. Remove `pendingInvites` field. Keep `slotsUsedByPlayer` — it's still needed for slot tracking.

Before:
```typescript
pendingInvites: PendingInvite[];
slotsUsedByPlayer: Record<string, number>;
```

After:
```typescript
// pendingInvites removed — invite state lives on channel.pendingMemberIds
slotsUsedByPlayer: Record<string, number>;
```

**Step 2: Remove pendingInvites from initial context / buildL3Context**

Find where L3 context is initialized (entry action or `buildL3Context` function). Remove `pendingInvites: []` from the initial context.

**Step 3: Update L3 event type definitions**

In `l3-session.ts`, find the event type union. Remove the INVITE_DM event type. Update SEND_MSG to accept optional `recipientIds`. Add ADD_MEMBER event type:

```typescript
// Remove this:
| { type: 'SOCIAL.INVITE_DM'; senderId: string; recipientIds: string[]; channelId?: string }

// Update SEND_MSG to:
| { type: 'SOCIAL.SEND_MSG'; senderId: string; content: string; channelId?: string; recipientIds?: string[]; targetId?: string }

// Add:
| { type: 'SOCIAL.ADD_MEMBER'; senderId: string; channelId: string; memberIds: string[]; message?: string }
```

**Step 4: Remove PendingInvite import**

Remove the `PendingInvite` import from l3-session.ts.

**Step 5: Build and verify**

Run: `cd apps/game-server && npx tsc --noEmit 2>&1 | head -30`

Expect compilation errors in l3-social.ts (old invite actions). That's expected — Task 3 fixes them.

**Step 6: Commit**

```bash
git add apps/game-server/src/machines/
git commit -m "feat(l3): remove pendingInvites from context, add recipientIds to SEND_MSG, add ADD_MEMBER event type"
```

---

### Task 3: L3 social actions — Core logic refactor

This is the biggest task. Rewrite the DM channel creation and invite logic.

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts`
- Modify: `apps/game-server/src/machines/actions/social-helpers.ts`

**Step 1: Update resolveChannelId for new model**

In `social-helpers.ts`, the current `resolveChannelId` uses `dmChannelId`. Replace with a function that handles all cases:

```typescript
/**
 * Resolve or create a channel for a SEND_MSG event.
 * - If channelId is present → existing channel
 * - If recipientIds is present (no channelId) → find existing or signal new channel needed
 * - If targetId is present (legacy compat) → find existing channel by member pair
 * - Otherwise → MAIN
 */
export function resolveExistingChannel(
  channels: Record<string, any>,
  event: any,
): string | null {
  // Explicit channelId — use it directly
  if (event.channelId) return event.channelId;

  // recipientIds or targetId — look up by member pair
  const recipientIds: string[] = event.recipientIds || (event.targetId ? [event.targetId] : []);
  if (recipientIds.length === 0) return 'MAIN';

  const senderId = event.senderId;
  const allMembers = new Set([senderId, ...recipientIds]);

  for (const ch of Object.values(channels) as any[]) {
    if (ch.type !== 'DM' && ch.type !== 'GROUP_DM') continue;
    const chMembers = new Set([...(ch.memberIds || []), ...(ch.pendingMemberIds || [])]);
    if (chMembers.size !== allMembers.size) continue;
    if ([...allMembers].every(id => chMembers.has(id))) return ch.id;
  }

  // No existing channel found
  return null;
}
```

Keep the old `resolveChannelId` as a thin wrapper for backward compat if needed, or inline the new logic.

**Step 2: Rewrite processChannelMessage action**

This is the SEND_MSG handler. It needs to handle three cases:
1. Message to existing channel (channelId present)
2. First message creating a new channel (recipientIds present, no existing channel)
3. Legacy targetId (find existing channel by member pair)

```typescript
processChannelMessage: assign(({ context, event }: any) => {
  const senderId = event.senderId;
  const existingChannelId = resolveExistingChannel(context.channels, event);

  let channels = { ...context.channels };
  let channelId: string;
  let slotsUsedByPlayer = { ...context.slotsUsedByPlayer };
  const isInviteMode = context.requireDmInvite;

  if (existingChannelId) {
    // Message to existing channel
    channelId = existingChannelId;
  } else {
    // First message — create new channel
    const recipientIds: string[] = event.recipientIds || (event.targetId ? [event.targetId] : []);
    if (recipientIds.length === 0) {
      return {}; // Safety: no recipients, nothing to do
    }

    channelId = crypto.randomUUID();
    const isGroup = recipientIds.length > 1;
    const channelType = isGroup ? 'GROUP_DM' : 'DM';

    if (isInviteMode) {
      // Invite mode: sender active, recipients pending
      channels[channelId] = {
        id: channelId,
        type: channelType,
        memberIds: [senderId],
        pendingMemberIds: recipientIds,
        createdBy: senderId,
        createdAt: Date.now(),
        capabilities: ['CHAT', 'SILVER_TRANSFER'],
      };
    } else {
      // Non-invite mode: all members active immediately
      channels[channelId] = {
        id: channelId,
        type: channelType,
        memberIds: [senderId, ...recipientIds],
        createdBy: senderId,
        createdAt: Date.now(),
        capabilities: ['CHAT', 'SILVER_TRANSFER'],
      };
    }

    // Sender consumes a slot for new conversation
    slotsUsedByPlayer[senderId] = (slotsUsedByPlayer[senderId] ?? 0) + 1;
  }

  // Membership check: sender must be in memberIds to send
  const channel = channels[channelId];
  if (channel && !channel.memberIds.includes(senderId)) {
    return {}; // Sender not an active member — reject silently (guard should catch this)
  }

  // Store the message
  const message = {
    id: crypto.randomUUID(),
    senderId,
    content: event.content,
    channelId,
    timestamp: Date.now(),
  };

  return {
    channels,
    chatLog: [...context.chatLog, message],
    slotsUsedByPlayer,
  };
}),
```

**Step 3: Write addMemberToChannel action**

New action for `SOCIAL.ADD_MEMBER`:

```typescript
addMemberToChannel: assign(({ context, event }: any) => {
  const { senderId, channelId, memberIds: newMemberIds, message } = event;
  const channels = { ...context.channels };
  const channel = channels[channelId];
  if (!channel) return {};

  const isInviteMode = context.requireDmInvite;

  // Add new members
  channels[channelId] = {
    ...channel,
    ...(isInviteMode
      ? { pendingMemberIds: [...(channel.pendingMemberIds || []), ...newMemberIds] }
      : { memberIds: [...channel.memberIds, ...newMemberIds] }
    ),
  };

  // If there's an invite message, store it
  const chatLog = [...context.chatLog];
  if (message) {
    chatLog.push({
      id: crypto.randomUUID(),
      senderId,
      content: message,
      channelId,
      timestamp: Date.now(),
    });
  }

  return { channels, chatLog };
}),
```

**Step 4: Rewrite acceptDmInvite action**

Move player from `pendingMemberIds` to `memberIds`:

```typescript
acceptDmInvite: assign(({ context, event }: any) => {
  const acceptorId = event.senderId;
  const { channelId } = event;
  const channels = { ...context.channels };
  const channel = channels[channelId];
  if (!channel) return {};

  const pendingMemberIds = (channel.pendingMemberIds || []).filter((id: string) => id !== acceptorId);
  const memberIds = channel.memberIds.includes(acceptorId)
    ? channel.memberIds
    : [...channel.memberIds, acceptorId];

  channels[channelId] = { ...channel, memberIds, pendingMemberIds };

  // Acceptor consumes a slot
  const slotsUsedByPlayer = { ...context.slotsUsedByPlayer };
  slotsUsedByPlayer[acceptorId] = (slotsUsedByPlayer[acceptorId] ?? 0) + 1;

  return { channels, slotsUsedByPlayer };
}),
```

**Step 5: Rewrite declineDmInvite action**

Remove from `pendingMemberIds`, free sender slot:

```typescript
declineDmInvite: assign(({ context, event }: any) => {
  const declinerId = event.senderId;
  const { channelId } = event;
  const channels = { ...context.channels };
  const channel = channels[channelId];
  if (!channel) return {};

  const pendingMemberIds = (channel.pendingMemberIds || []).filter((id: string) => id !== declinerId);
  channels[channelId] = { ...channel, pendingMemberIds };

  // Free the sender's slot (channel creator)
  const slotsUsedByPlayer = { ...context.slotsUsedByPlayer };
  const creatorId = channel.createdBy;
  if (creatorId && slotsUsedByPlayer[creatorId] > 0) {
    slotsUsedByPlayer[creatorId] -= 1;
  }

  // If no active members besides creator and no pending members, optionally clean up channel
  // (Keep for now — channel stays until end of day)

  return { channels, slotsUsedByPlayer };
}),
```

**Step 6: Update guards**

Update `isChannelMessageAllowed` guard to handle the new first-message case. When `recipientIds` is present and no channel exists, the guard should validate:
- DMs are open
- Sender is alive
- All recipients are alive and not self
- Sender has available slots (if new conversation)

```typescript
isChannelMessageAllowed: ({ context, event }: any) => {
  const senderId = event.senderId;
  const existingChannelId = resolveExistingChannel(context.channels, event);

  if (existingChannelId) {
    // Existing channel: check sender is active member
    const channel = context.channels[existingChannelId];
    if (!channel) return false;
    if (channel.type === 'MAIN') return context.groupChatOpen;
    if (!context.dmsOpen && !channel.constraints?.exempt) return false;
    return channel.memberIds.includes(senderId);
  }

  // New channel: validate recipients
  const recipientIds: string[] = event.recipientIds || (event.targetId ? [event.targetId] : []);
  if (recipientIds.length === 0) return context.groupChatOpen; // MAIN channel

  if (!context.dmsOpen) return false;
  if (!context.roster[senderId] || context.roster[senderId].status !== 'ALIVE') return false;

  for (const rid of recipientIds) {
    if (rid === senderId) return false;
    if (!context.roster[rid] || context.roster[rid].status !== 'ALIVE') return false;
  }

  // Slot check
  const used = context.slotsUsedByPlayer[senderId] ?? 0;
  if (used >= context.dmSlotsPerPlayer) return false;

  return true;
},
```

Write `canAddMember` guard:

```typescript
canAddMember: ({ context, event }: any) => {
  const { senderId, channelId, memberIds: newMemberIds } = event;
  const channel = context.channels[channelId];
  if (!channel) return false;

  // Only channel creator can add members
  if (channel.createdBy !== senderId) return false;

  // DMs must be open
  if (!context.dmsOpen) return false;

  // All new members must be alive and not already in channel
  const existingIds = new Set([...(channel.memberIds || []), ...(channel.pendingMemberIds || [])]);
  for (const id of newMemberIds) {
    if (existingIds.has(id)) return false;
    if (!context.roster[id] || context.roster[id].status !== 'ALIVE') return false;
  }

  return true;
},
```

Update `canAcceptDm`:

```typescript
canAcceptDm: ({ context, event }: any) => {
  const acceptorId = event.senderId;
  const { channelId } = event;
  const channel = context.channels[channelId];
  if (!channel) return false;

  // Must be in pendingMemberIds
  if (!(channel.pendingMemberIds || []).includes(acceptorId)) return false;

  // Slot check
  const used = context.slotsUsedByPlayer[acceptorId] ?? 0;
  if (used >= context.dmSlotsPerPlayer) return false;

  return true;
},
```

Update `canDeclineDm`:

```typescript
canDeclineDm: ({ context, event }: any) => {
  const declinerId = event.senderId;
  const { channelId } = event;
  const channel = context.channels[channelId];
  if (!channel) return false;

  return (channel.pendingMemberIds || []).includes(declinerId);
},
```

**Step 7: Remove old invite actions**

Delete the following actions that are no longer needed:
- `createPendingInvite`
- `recordInviteSentFacts` (replace with a new fact emission in processChannelMessage for new channels)
- `rejectDmInvite`
- `rejectDmAccept`

Keep fact recording but adapt: emit `DM_INVITE_SENT` fact when a new channel is created in invite mode (from within `processChannelMessage`). Emit `DM_INVITE_ACCEPTED`/`DM_INVITE_DECLINED` from accept/decline actions.

Since `sendParent()` in `assign()` is a no-op in XState v5, fact emission must be a SEPARATE action from the assign. Split as needed.

**Step 8: Remove dmChannelId import**

Remove the `dmChannelId` import from `l3-social.ts` and `social-helpers.ts`.

**Step 9: Build and verify**

Run: `cd apps/game-server && npx tsc --noEmit 2>&1 | head -40`

Fix any remaining type errors.

**Step 10: Commit**

```bash
git add apps/game-server/src/machines/actions/
git commit -m "feat(l3): rewrite social actions for unified DM channels — UUID IDs, pendingMemberIds, ADD_MEMBER"
```

---

### Task 4: L3 session machine wiring

**Files:**
- Modify: `apps/game-server/src/machines/l3-session.ts`

**Step 1: Remove INVITE_DM handler, add ADD_MEMBER**

In the `on:` block of the social region, remove the INVITE_DM handler and add ADD_MEMBER:

```typescript
// REMOVE:
'SOCIAL.INVITE_DM': [
  { guard: 'canInviteDm', actions: ['createPendingInvite', 'recordInviteSentFacts'] },
  { actions: ['rejectDmInvite'] }
],

// ADD:
'SOCIAL.ADD_MEMBER': [
  { guard: 'canAddMember', actions: ['addMemberToChannel', 'recordAddMemberFact'] },
  { actions: ['rejectAddMember'] }
],
```

**Step 2: Update SEND_MSG handler**

The existing SEND_MSG handler uses `isChannelMessageAllowed` guard and `processChannelMessage` action. These have been updated in Task 3 to handle channel creation. Add a fact emission action for new-channel cases:

```typescript
'SOCIAL.SEND_MSG': [
  { guard: 'isChannelMessageAllowed', actions: ['processChannelMessage', 'emitChatFact'] },
  { guard: 'isNewChannelRejected', actions: ['rejectNewChannel'] },
  // ... existing rejection paths
],
```

Or simpler: keep the existing pattern but ensure `processChannelMessage` handles the new channel case internally.

**Step 3: Register new actions and guards in setup()**

In the `setup({ actions, guards })` block, register:
- Actions: `addMemberToChannel`, `recordAddMemberFact`, `rejectAddMember`
- Guards: `canAddMember`
- Remove: `canInviteDm`, `createPendingInvite`, `recordInviteSentFacts`, `rejectDmInvite`

**Step 4: Update GM DM channel creation**

Find where Game Master DM channels are created (around line 292, uses `dmChannelId`). Replace with UUID:

```typescript
// BEFORE:
const gmChannelId = dmChannelId(GAME_MASTER_ID, playerId);

// AFTER:
const gmChannelId = crypto.randomUUID();
```

Ensure the GM DM channel is created with `type: 'DM'` and both GAME_MASTER_ID and the player as `memberIds`.

**Step 5: Build and verify**

Run: `cd apps/game-server && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add apps/game-server/src/machines/
git commit -m "feat(l3): wire unified DM channel handlers — remove INVITE_DM, add ADD_MEMBER"
```

---

### Task 5: Server tests

**Files:**
- Modify: `apps/game-server/src/machines/__tests__/l3-dm-invite.test.ts` (or wherever DM invite tests live)

**Step 1: Find existing DM invite tests**

```bash
find apps/game-server/src -name "*.test.ts" | xargs grep -l "invite\|INVITE_DM\|pendingInvite" 2>/dev/null
```

**Step 2: Rewrite tests for unified model**

Test the following scenarios:

```typescript
describe('unified DM channels', () => {
  describe('non-invite mode (requireDmInvite: false)', () => {
    it('SEND_MSG with recipientIds creates DM channel with UUID', ...);
    it('both players are in memberIds immediately', ...);
    it('subsequent messages use channelId', ...);
    it('sender slot is consumed on channel creation', ...);
    it('SEND_MSG with targetId (legacy) finds existing channel', ...);
  });

  describe('invite mode (requireDmInvite: true)', () => {
    it('SEND_MSG with recipientIds creates channel — sender in memberIds, recipient in pendingMemberIds', ...);
    it('first message is stored in chatLog', ...);
    it('sender slot consumed on creation', ...);
    it('ACCEPT_DM moves recipient from pendingMemberIds to memberIds', ...);
    it('acceptor slot consumed on accept', ...);
    it('DECLINE_DM removes from pendingMemberIds and frees sender slot', ...);
    it('pending member cannot send messages to channel', ...);
    it('active member can send messages after accept', ...);
  });

  describe('ADD_MEMBER', () => {
    it('channel creator can add new members', ...);
    it('non-creator cannot add members', ...);
    it('in invite mode, new members go to pendingMemberIds', ...);
    it('in non-invite mode, new members go to memberIds', ...);
    it('optional message is stored in chatLog', ...);
    it('cannot add already-present member', ...);
    it('cannot add eliminated player', ...);
  });

  describe('slot tracking', () => {
    it('sender slot incremented on new channel creation', ...);
    it('acceptor slot incremented on accept', ...);
    it('sender slot decremented on decline', ...);
    it('slot limit enforced on channel creation', ...);
    it('slot limit enforced on accept', ...);
  });
});
```

**Step 3: Run tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/l3-dm-invite.test.ts`

**Step 4: Commit**

```bash
git add apps/game-server/src/machines/__tests__/
git commit -m "test(l3): rewrite DM tests for unified channel model"
```

---

### Task 6: SYNC payload + Demo server

**Files:**
- Modify: `apps/game-server/src/sync.ts`
- Modify: `apps/game-server/src/demo/demo-sync.ts`
- Modify: `apps/game-server/src/demo/demo-seed.ts`

**Step 1: Remove pendingInvites from SYNC payload**

In `sync.ts`, find `buildSyncPayload`. Remove the `pendingInvites` field from the returned object (around line 148-150):

```typescript
// REMOVE:
pendingInvites: (l3Context.pendingInvites || []).filter((inv: any) =>
  inv.senderId === playerId || inv.recipientId === playerId
),
```

The `pendingMemberIds` is already part of each channel object in `playerChannels`, so clients get this data through the channels field.

**Step 2: Update channel filtering in SYNC**

The existing `playerChannels` filter includes channels where the player is in `memberIds`. Update to also include channels where the player is in `pendingMemberIds`:

```typescript
const playerChannels = Object.fromEntries(
  Object.entries(channels).filter(([_, ch]: [string, any]) =>
    ch.type === 'MAIN' ||
    ch.memberIds.includes(playerId) ||
    (ch.pendingMemberIds || []).includes(playerId)
  )
);
```

**Step 3: Update demo sync**

In `demo-sync.ts`, remove `pendingInvites` from the demo SYNC payload. Remove the `slotsUsed` field from `dmStats` if it was added.

**Step 4: Update demo seed**

In `demo-seed.ts`:
- Remove `requireDmInvite` and `dmSlotsPerPlayer` from manifest days (unless needed for demo)
- Ensure DM channels use UUID IDs (the existing `dm:p0:p1` format should be replaced)
- Remove any PendingInvite references

Update the pre-seeded DM channel:

```typescript
// BEFORE:
'dm:p0:p1': {
  id: 'dm:p0:p1',
  type: 'DM',
  ...
}

// AFTER — use a UUID:
const dmChannelId = 'demo-dm-p0-p1';  // stable demo ID
...
[dmChannelId]: {
  id: dmChannelId,
  type: 'DM',
  memberIds: ['p0', 'p1'],
  ...
}
```

Update `chatLog` entries to reference the new channelId.

**Step 5: Build both**

Run: `cd apps/game-server && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add apps/game-server/src/sync.ts apps/game-server/src/demo/
git commit -m "feat: remove pendingInvites from SYNC, include pendingMemberIds via channels, update demo"
```

---

### Task 7: Client store — Remove pendingInvites

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`

**Step 1: Remove pendingInvites from GameState**

Remove the field, the selectors, and the SYNC handler line:

```typescript
// REMOVE from GameState interface:
pendingInvites: PendingInvite[];

// REMOVE from initial state:
pendingInvites: [],

// REMOVE from SYNC handler:
pendingInvites: data.context?.pendingInvites ?? state.pendingInvites,

// REMOVE selectors:
export const selectMyPendingInvites = ...
export const selectMySentInvites = ...
```

**Step 2: Remove PendingInvite import**

```typescript
// REMOVE PendingInvite from the import:
import { ..., PendingInvite, ... } from '@pecking-order/shared-types';
```

**Step 3: Add pending channel selectors**

Add selectors that detect pending state from channels:

```typescript
/** Channels where the player is a pending member (needs to accept/decline) */
export const selectPendingChannels = (state: GameState): Channel[] => {
  const pid = state.playerId;
  if (!pid) return [];
  return Object.values(state.channels).filter(
    ch => (ch.pendingMemberIds || []).includes(pid)
  );
};

/** Channels where the player has sent invites (created channel, others are pending) */
export const selectSentInviteChannels = (state: GameState): Channel[] => {
  const pid = state.playerId;
  if (!pid) return [];
  return Object.values(state.channels).filter(
    ch => ch.createdBy === pid && (ch.pendingMemberIds || []).length > 0
  );
};
```

**Step 4: Update selectDmSlots**

`selectDmSlots` reads from `dmStats.slotsUsed` which comes from the SYNC payload. This should still work since `slotsUsedByPlayer` is still in L3 context and projected into dmStats.

**Step 5: Build**

Run: `cd apps/client && npx tsc --noEmit 2>&1 | head -30`

Expect errors in components that import PendingInvite or use old selectors — those are fixed in Tasks 9-10.

**Step 6: Commit**

```bash
git add apps/client/src/store/
git commit -m "feat(store): remove pendingInvites, add pending channel selectors"
```

---

### Task 8: Client engine — Unified message sending

**Files:**
- Modify: `apps/client/src/hooks/useGameEngine.ts`

**Step 1: Remove sendDM, add sendFirstMessage**

```typescript
// REMOVE sendDM entirely (and its dmChannelId import):
const sendDM = (targetId: string, content: string) => { ... };

// ADD sendFirstMessage — for creating a new channel via first message:
const sendFirstMessage = (recipientIds: string[], content: string) => {
  socket.send(JSON.stringify({
    type: Events.Social.SEND_MSG,
    content,
    recipientIds,
  }));
};

// ADD addMember — for inviting to existing channel:
const addMember = (channelId: string, memberIds: string[], message?: string) => {
  socket.send(JSON.stringify({
    type: Events.Social.ADD_MEMBER,
    channelId,
    memberIds,
    ...(message ? { message } : {}),
  }));
};
```

**Step 2: Update the return object**

```typescript
return {
  socket,
  sendMessage,
  // sendDM removed
  sendFirstMessage,   // new
  addMember,          // new
  sendSilver,
  sendToChannel,
  createGroupDm,
  sendVoteAction,
  sendGameAction,
  sendActivityAction,
  sendTyping,
  stopTyping,
};
```

**Step 3: Remove dmChannelId import**

```typescript
// REMOVE:
import { dmChannelId } from '@pecking-order/shared-types';
```

**Step 4: Fix other shells (minimal compat)**

Search for `sendDM` usage in classic and immersive shells. For now, replace with `sendToChannel` using a channel lookup, or leave a TODO comment. The user is focused on vivid shell.

**Step 5: Build**

Run: `cd apps/client && npx tsc --noEmit 2>&1 | head -30`

**Step 6: Commit**

```bash
git add apps/client/src/hooks/ apps/client/src/shells/
git commit -m "feat(engine): replace sendDM with sendFirstMessage + addMember, remove dmChannelId"
```

---

### Task 9: WhispersTab + NewConversationPicker

**Files:**
- Modify: `apps/client/src/shells/vivid/components/WhispersTab.tsx`
- Modify: `apps/client/src/shells/vivid/components/NewConversationPicker.tsx`
- Modify: `apps/client/src/shells/vivid/VividShell.tsx`

**Step 1: Update ConversationList — show all DM/GROUP_DM channels**

In the `dmThreads` memo, filter for DM channels where player is a member OR pending:

```typescript
const dmThreads = useMemo(() => {
  if (!playerId) return [];
  return Object.values(channels)
    .filter(ch =>
      ch.type === ChannelTypes.DM &&
      (ch.memberIds.includes(playerId) || (ch.pendingMemberIds || []).includes(playerId))
    )
    .filter(ch => !ch.memberIds.includes(GAME_MASTER_ID)) // exclude GM DMs
    .map(ch => {
      const otherPlayerId = [...ch.memberIds, ...(ch.pendingMemberIds || [])]
        .find(id => id !== playerId && id !== GAME_MASTER_ID);
      const messages = chatLog
        .filter((m: ChatMessage) => m.channelId === ch.id)
        .sort((a, b) => a.timestamp - b.timestamp);
      const lastMsg = messages[messages.length - 1];
      const isPending = (ch.pendingMemberIds || []).includes(playerId);
      return {
        channelId: ch.id,
        playerId: otherPlayerId,
        lastMessage: lastMsg,
        lastTimestamp: lastMsg?.timestamp ?? ch.createdAt,
        isPending,
      };
    })
    .filter(t => t.playerId)
    .sort((a, b) => b.lastTimestamp - a.lastTimestamp);
}, [channels, chatLog, playerId]);
```

**Step 2: Update ConversationItem rendering for pending state**

When rendering dmThreads, use the `isPending` flag to show blurred state:

```typescript
{dmThreads.map(thread => {
  if (!thread.playerId) return null;
  const player = roster[thread.playerId];
  const color = playerColorMap[thread.playerId] || '#9B8E7E';
  const idx = staggerIndex++;
  return (
    <ConversationItem
      key={thread.channelId}
      borderColor={thread.isPending ? 'rgba(59, 169, 156, 0.6)' : color}
      onClick={() => onSelectDm(thread.playerId!, thread.channelId)}
      index={idx}
      avatar={<PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={40} />}
      name={player?.personaName ?? 'Unknown'}
      nameColor={thread.isPending ? '#3BA99C' : color}
      lastMessage={thread.isPending ? 'Tap to view invite' : thread.lastMessage?.content}
      timestamp={thread.lastTimestamp}
      blurred={thread.isPending}
    />
  );
})}
```

**Step 3: Remove old PendingInvite-based rendering**

Remove the `receivedPending` section that used `pendingInvites`:

```typescript
// REMOVE this entire block:
{receivedPending.map(invite => { ... })}
```

Remove the `selectMyPendingInvites` import and usage.

**Step 4: Update onSelectDm to pass channelId**

The `onSelectDm` callback needs to carry the channelId so DMChat can use it. Update the prop type:

```typescript
onSelectDm: (playerId: string, channelId?: string) => void;
```

**Step 5: Update VividShell — pass channelId through**

In VividShell, update the state and callbacks to track channelId alongside targetPlayerId. When `onSelectDm` is called with a channelId, store it:

```typescript
const handleOpenDm = useCallback((targetId: string, channelId?: string) => {
  setDmTargetPlayerId(targetId);
  setDmChannelId(channelId ?? null);
  setActiveTab('whispers');
}, []);
```

**Step 6: Update NewConversationPicker**

The picker no longer sends INVITE_DM. It simply navigates to the DM view for the selected player. The user will type their first message there.

```typescript
onStart={(recipientIds) => {
  setShowNewConversation(false);
  if (recipientIds.length === 1) {
    setDmTargetPlayerId(recipientIds[0]);
    setDmChannelId(null);  // no channel yet — first message will create it
    setActiveTab('whispers');
  } else {
    // Group: navigate to group DM view
    // For now, same pattern — first message in group view creates the channel
    setDmTargetPlayerId(null);
    setDmChannelId(null);
    // Store recipientIds for the first message
    setActiveTab('whispers');
  }
}}
```

Remove the `requireDmInvite` branching that sent `INVITE_DM`.

**Step 7: Build and verify**

Run: `cd apps/client && npx tsc --noEmit 2>&1 | head -30`

**Step 8: Commit**

```bash
git add apps/client/src/shells/vivid/
git commit -m "feat(vivid): update WhispersTab for unified channels — pending from channel.pendingMemberIds"
```

---

### Task 10: DMChat — Channel-based message display + locked state

**Files:**
- Modify: `apps/client/src/shells/vivid/components/DMChat.tsx`
- Modify: `apps/client/src/shells/vivid/components/InviteOverlay.tsx`
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`

**Step 1: DMChat — Find channel by member pair or channelId prop**

DMChat receives `targetPlayerId` (1:1 mode). It needs to find the channel:

```typescript
const dmChannel = useMemo(() => {
  if (channelId) return channels[channelId] ?? null;
  if (!playerId || !targetPlayerId) return null;
  return Object.values(channels).find(ch =>
    ch.type === ChannelTypes.DM &&
    ch.memberIds.includes(playerId) &&
    (ch.memberIds.includes(targetPlayerId) || (ch.pendingMemberIds || []).includes(targetPlayerId))
  ) ?? null;
}, [channels, channelId, playerId, targetPlayerId]);

const dmChannelId = dmChannel?.id ?? null;
const isPending = dmChannel ? (dmChannel.pendingMemberIds || []).includes(playerId!) : false;
```

**Step 2: DMChat — Filter messages by channel**

Replace `usePlayerTimeline` usage with direct chatLog filtering:

```typescript
const dmMessages = useMemo(() => {
  if (!dmChannelId) return [];
  return chatLog
    .filter((m: ChatMessage) => m.channelId === dmChannelId)
    .sort((a, b) => a.timestamp - b.timestamp);
}, [chatLog, dmChannelId]);
```

Use `dmMessages` for rendering instead of `playerTimelineEntries`.

**Step 3: DMChat — Locked state from channel**

Replace the old `pendingInvite` logic:

```typescript
// REMOVE:
const pendingInvite = useMemo(() => { ... pendingInvites.find(...) }, ...);
const isLockedInvite = !!pendingInvite;

// REPLACE WITH:
const isLockedInvite = isPending;
```

**Step 4: Update InviteOverlay**

InviteOverlay currently takes a `PendingInvite` prop. Change to take channel info:

```typescript
interface InviteOverlayProps {
  channel: Channel;
  roster: Record<string, SocialPlayer>;
  slotsRemaining: number;
  slotsTotal: number;
  onAccept: () => void;
  onDecline: () => void;
}
```

Update the display to show the channel creator's info (the person who invited):

```typescript
const sender = roster[channel.createdBy];
```

Show the first message as the invite preview:

```typescript
// Pass firstMessage as a prop or read from chatLog
```

**Step 5: Update ChatInput — handle first message**

ChatInput needs to handle the case where no channel exists yet (first message creates it):

```typescript
case 'dm':
  if (targetId) {
    if (dmChannelId) {
      // Existing channel — send to it
      engine.sendToChannel(dmChannelId, text);
    } else {
      // No channel yet — first message creates it
      engine.sendFirstMessage([targetId], text);
    }
    engine.stopTyping(dmChannelId || targetId);
  }
  break;
```

DMChat passes `dmChannelId` to ChatInput so it knows which path to take.

**Step 6: Remove PendingInvite imports and useShallow(selectMyPendingInvites)**

Clean up all removed imports in DMChat, InviteOverlay, WhispersTab.

**Step 7: Build and verify**

Run: `cd apps/client && npx tsc --noEmit`

**Step 8: Commit**

```bash
git add apps/client/src/shells/vivid/components/
git commit -m "feat(vivid): DMChat uses channel-based message display + locked state from pendingMemberIds"
```

---

### Task 11: Full build + speed run

**Step 1: Build all apps**

```bash
npm run build
```

Fix any remaining compilation errors.

**Step 2: Run all tests**

```bash
npm run test
```

**Step 3: Run speed run**

Use `/speed-run` to verify the full game lifecycle still works. The speed run uses non-invite mode, so it should work with the new UUID-based channel creation.

**Step 4: Manual smoke test**

Start local dev (`npm run dev`) and verify:
1. Non-invite mode: Send DM → channel created → messages flow
2. Invite mode: Send first message → recipient sees blurred preview → accept → conversation unlocked
3. Decline → channel cleaned up, sender slot freed
4. Add member to existing conversation

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build + test issues from unified DM channel refactor"
```

---

### Task 12: Cleanup

**Files:**
- Various — search and clean

**Step 1: Remove all dmChannelId references**

```bash
grep -r "dmChannelId" apps/ packages/ --include="*.ts" --include="*.tsx"
```

Fix any remaining usages.

**Step 2: Remove all PendingInvite references**

```bash
grep -r "PendingInvite\|pendingInvite" apps/ packages/ --include="*.ts" --include="*.tsx"
```

Fix any remaining usages.

**Step 3: Remove INVITE_DM references**

```bash
grep -r "INVITE_DM" apps/ packages/ --include="*.ts" --include="*.tsx"
```

Remove from events, handlers, tests, etc.

**Step 4: Remove PRIVATE references**

```bash
grep -r "'PRIVATE'\|PRIVATE" apps/ packages/ --include="*.ts" --include="*.tsx"
```

**Step 5: Final build + test**

```bash
npm run build && npm run test
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore: clean up PRIVATE, PendingInvite, dmChannelId, INVITE_DM remnants"
```
