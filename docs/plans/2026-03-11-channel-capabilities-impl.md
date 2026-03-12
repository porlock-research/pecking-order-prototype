# Channel Capabilities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the chat input capability-aware — persistent chips above the input surface channel capabilities, tapping a chip activates that capability's flow (amount picker for silver, player picker for invite), and L3 guards enforce capability checks server-side.

**Architecture:** Extend `ChannelCapability` type with `INVITE_MEMBER` / `REACTIONS` / `REPLIES`. Add capability guard checks in L3 social handlers. Replace the `ChatActions` popup tray + `RingMenu` + `+` button with small, persistent icon buttons inline with the text input in `ChatInput.tsx` (CometChat-style minimal). Each icon activates a contextual flow panel above the input until completed or cancelled.

**Tech Stack:** TypeScript, React 19, Framer Motion, XState v5, Zustand, Solar Icons, Vivid shell CSS variables

**Design doc:** `docs/plans/2026-03-11-channel-capabilities-design.md`

**UI inspiration:** CometChat UI Kit (Figma `l9vbejZk8QrBrmGkIo15bq`). Key pattern: action affordances are **always visible** near the input (not hidden in menus), but **minimal until activated** — small icon buttons that don't compete with the text input. Our capability icons adapt this: icon-only buttons inline with the input row (Dollar, UserPlus), keeping the default state uncluttered. Labels only appear in the activated flow header ("Send Silver to Phoenix"), solving ambiguity through context rather than persistent labels.

---

### Task 1: Extend CapabilityId Type in shared-types

**Files:**
- Modify: `packages/shared-types/src/index.ts:452`

**Step 1: Update the type**

Change:
```typescript
export type ChannelCapability = 'CHAT' | 'SILVER_TRANSFER' | 'GAME_ACTIONS';
```
To:
```typescript
export type ChannelCapability = 'CHAT' | 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'REACTIONS' | 'REPLIES' | 'GAME_ACTIONS';
```

**Step 2: Verify build**

Run: `cd packages/shared-types && npx tsc --noEmit`
Expected: PASS (additive type change, no breakage)

**Step 3: Commit**

```
feat(shared-types): extend ChannelCapability with INVITE_MEMBER, REACTIONS, REPLIES
```

---

### Task 2: Update L3 Channel Creation to Set Correct Capabilities

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts:39,48,235`
- Modify: `apps/game-server/src/machines/l3-session.ts:86`

Per the design doc's default capabilities table:

| Channel Type | Capabilities |
|---|---|
| MAIN | `CHAT`, `REACTIONS` |
| DM | `CHAT`, `SILVER_TRANSFER`, `INVITE_MEMBER` |
| GROUP_DM | `CHAT`, `SILVER_TRANSFER`, `INVITE_MEMBER` |
| GAME_DM | `CHAT`, `GAME_ACTIONS` |

**Step 1: Update MAIN channel in `buildL3Context`**

In `l3-session.ts:86`, change:
```typescript
capabilities: ['CHAT' as const],
```
To:
```typescript
capabilities: ['CHAT', 'REACTIONS'] as const,
```

**Step 2: Update DM channel creation in `processChannelMessage`**

In `l3-social.ts`, both invite-mode (line ~39) and direct-access (line ~48) DM creation paths:
```typescript
capabilities: ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER'],
```

**Step 3: Update GROUP_DM channel creation in `createGroupDmChannel`**

In `l3-social.ts:235`, change:
```typescript
capabilities: ['CHAT'],
```
To:
```typescript
capabilities: ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER'],
```

**Step 4: Verify GAME_DM already correct**

`l3-social.ts:197` already sets `['CHAT', 'GAME_ACTIONS']` — no change needed.

**Step 5: Verify build**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```
feat(engine): set default capabilities per channel type (design doc table)
```

---

### Task 3: Add Capability Guards in L3

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts` (guard functions at bottom)

**Step 1: Add capability check helper**

Add at top of l3-social.ts, after imports:

```typescript
function channelHasCapability(
  channels: Record<string, Channel>,
  channelId: string | undefined,
  capability: ChannelCapability,
): boolean {
  if (!channelId) return false;
  const ch = channels[channelId];
  if (!ch) return false;
  return ch.capabilities?.includes(capability) ?? false;
}
```

Import `ChannelCapability` from `@pecking-order/shared-types` if not already imported.

**Step 2: Add capability check to `isSilverTransferAllowed`**

The guard currently validates amount/funds/target. Add at the top of the function body:

```typescript
// channelId comes from the event — resolve it
const channelId = resolveExistingChannel(context.channels, event);
if (channelId && !channelHasCapability(context.channels, channelId, 'SILVER_TRANSFER')) {
  return false;
}
```

Note: If there's no resolved channel (silver from profile, future), allow it — capabilities only gate channel-bound actions.

**Step 3: Add capability check to `canAddMember`**

At the start of the guard body, after fetching the channel:

```typescript
if (!channelHasCapability(context.channels, event.channelId, 'INVITE_MEMBER')) {
  return false;
}
```

**Step 4: Add capability check to `isChannelMessageAllowed` (existing channel path)**

In the existing-channel branch (after resolving channel), add:

```typescript
if (!channel.capabilities?.includes('CHAT')) {
  return false;
}
```

**Step 5: Verify build**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: PASS

**Step 6: Run existing tests**

Run: `cd apps/game-server && npx vitest run src/machines/__tests__/ --reporter=verbose`
Expected: All tests PASS (existing channels already have CHAT capability set)

**Step 7: Commit**

```
feat(engine): add capability guard checks to L3 social handlers
```

---

### Task 4: Update Demo Seed Data

**Files:**
- Modify: `apps/game-server/src/demo/demo-seed.ts:145,154`
- Modify: `apps/game-server/src/demo/demo-machine.ts:81,115`

**Step 1: Update demo MAIN channel**

In `demo-seed.ts:145`, change:
```typescript
capabilities: ['CHAT'],
```
To:
```typescript
capabilities: ['CHAT', 'REACTIONS'],
```

**Step 2: Update demo DM channel**

In `demo-seed.ts:154`, change:
```typescript
capabilities: ['CHAT', 'SILVER_TRANSFER'],
```
To:
```typescript
capabilities: ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER'],
```

**Step 3: Update demo-machine DM creation**

In `demo-machine.ts:81`:
```typescript
capabilities: ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER'],
```

**Step 4: Update demo-machine GROUP_DM creation**

In `demo-machine.ts:115`:
```typescript
capabilities: ['CHAT', 'SILVER_TRANSFER', 'INVITE_MEMBER'],
```

**Step 5: Verify build**

Run: `cd apps/game-server && npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```
chore(demo): align demo seed capabilities with design doc defaults
```

---

### Task 5: Redesign ChatInput — Capability Icon Buttons (Core UI)

This is the largest task. Replace the `+ button → ChatActions tray` pattern with small, persistent **icon buttons** inline with the input row. Tapping an icon activates an `activeCapability` state that morphs the input area into that capability's flow. Inspired by CometChat's minimal action icon pattern — icons are always visible but unobtrusive, labels only appear in the active flow.

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx` (major rewrite of render section)
- Delete: `apps/client/src/shells/vivid/components/ChatActions.tsx`
- Delete: `apps/client/src/shells/vivid/components/RingMenu.tsx`

**Step 1: Update ChatInput props**

Replace the `onChatAction` callback with capability-aware props:

```typescript
interface ChatInputProps {
  engine: {
    sendMessage: (content: string) => void;
    sendToChannel: (channelId: string, content: string) => void;
    sendFirstMessage: (recipientIds: string[], content: string) => void;
    sendTyping: (channel?: string) => void;
    stopTyping: (channel?: string) => void;
    sendSilver: (amount: number, targetId: string) => void;
    addMember: (channelId: string, memberIds: string[], message?: string) => void;
  };
  context: 'main' | 'dm' | 'group';
  targetId?: string;
  targetName?: string;
  replyTarget?: ChatMessage | null;
  onClearReply?: () => void;
  channelId?: string;
  /** Capabilities for this channel — drives icon button rendering */
  capabilities?: ChannelCapability[];
  /** Members of current channel — for invite flow filtering */
  channelMemberIds?: string[];
}
```

Key changes:
- Remove `onChatAction` — ChatInput now owns the full capability flow
- Add `sendSilver` and `addMember` to engine (ChatInput executes actions directly)
- Add `capabilities` prop — passed from DMChat/StageChat based on channel data
- Add `channelMemberIds` — for filtering eligible invite targets

**Step 2: Add capability state management**

```typescript
type ActiveCapability = 'SILVER_TRANSFER' | 'INVITE_MEMBER' | null;

export function ChatInput({ engine, context, targetId, targetName, replyTarget, onClearReply, channelId, capabilities, channelMemberIds }: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeCapability, setActiveCapability] = useState<ActiveCapability>(null);

  const { playerId, roster } = useGameStore();
  // ... existing store hooks ...

  // Filter to input-area capabilities (exclude CHAT, REACTIONS, REPLIES)
  const inputCapabilities = useMemo(() =>
    (capabilities ?? []).filter(c => c !== 'CHAT' && c !== 'REACTIONS' && c !== 'REPLIES'),
    [capabilities]
  );
```

**Step 3: Remove ChatActions import and `showActions` state**

Delete:
```typescript
import { ChatActions } from './ChatActions';
```
And remove:
```typescript
const [showActions, setShowActions] = useState(false);
```

Add new imports:
```typescript
import { SilverTransferFlow } from './SilverTransferFlow';
import { InviteMemberFlow } from './InviteMemberFlow';
```

**Step 4: Render icon buttons inline with input row**

Replace the old `+ button` with small icon buttons placed **between the text input and the send button** inside the `<form>`. They sit in the input row, not above it — keeping the layout compact and CometChat-style minimal:

```tsx
<form onSubmit={handleSend} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
  {/* Text input */}
  <input ... />

  {/* Capability action icons — small, inline, always visible */}
  {inputCapabilities.includes('SILVER_TRANSFER') && (
    <motion.button
      type="button"
      onClick={() => setActiveCapability('SILVER_TRANSFER')}
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'none',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: activeCapability === 'SILVER_TRANSFER' ? '#C49A20' : 'var(--vivid-text-dim)',
        cursor: 'pointer',
        padding: 0,
      }}
      whileTap={VIVID_TAP.button}
    >
      <Dollar size={20} weight="Bold" />
    </motion.button>
  )}
  {inputCapabilities.includes('INVITE_MEMBER') && (
    <motion.button
      type="button"
      onClick={() => setActiveCapability('INVITE_MEMBER')}
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'none',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: activeCapability === 'INVITE_MEMBER' ? '#3BA99C' : 'var(--vivid-text-dim)',
        cursor: 'pointer',
        padding: 0,
      }}
      whileTap={VIVID_TAP.button}
    >
      <UserPlus size={20} weight="Bold" />
    </motion.button>
  )}

  {/* Send button */}
  <motion.button type="submit" ... />
</form>
```

The form row always renders (icons + input + send). The active capability flow renders **above** the form row when activated, and the text input gets visually de-emphasized (lower opacity or hidden) depending on the flow.

**Step 5: Render active capability flow (silver) above the input row**

When `activeCapability === 'SILVER_TRANSFER'`, show the flow panel above the form:

```tsx
<AnimatePresence>
  {activeCapability === 'SILVER_TRANSFER' && (
    <SilverTransferFlow
      playerId={playerId}
      targetId={targetId}
      targetName={targetName}
      channelId={channelId}
      roster={roster}
      context={context}
      onSend={(amount, recipientId) => {
        engine.sendSilver(amount, recipientId);
        setActiveCapability(null);
      }}
      onCancel={() => setActiveCapability(null)}
    />
  )}
</AnimatePresence>
```

**Step 6: Render active capability flow (invite) above the input row**

When `activeCapability === 'INVITE_MEMBER'`, show the flow panel above the form:

```tsx
<AnimatePresence>
  {activeCapability === 'INVITE_MEMBER' && (
    <InviteMemberFlow
      playerId={playerId}
      channelId={channelId}
      roster={roster}
      channelMemberIds={channelMemberIds ?? []}
      onInvite={(memberIds) => {
        if (channelId) {
          engine.addMember(channelId, memberIds);
        }
        setActiveCapability(null);
      }}
      onCancel={() => setActiveCapability(null)}
    />
  )}
</AnimatePresence>
```

**Step 7: Remove the old + button, ChatActions tray, and RingMenu integration**

Delete the entire `{(context === 'dm' || context === 'group') && (` block that renders the `AddCircle` button and `ChatActions`/`RingMenu`.

Delete the `AnimatePresence` block that renders `ChatActions`.

**Step 8: Delete ChatActions.tsx and RingMenu.tsx**

```bash
rm apps/client/src/shells/vivid/components/ChatActions.tsx
rm apps/client/src/shells/vivid/components/RingMenu.tsx
```

**Step 9: Verify build**

Run: `cd apps/client && npx vite build`
Expected: PASS (will fail until Task 6 and Task 7 implement the flow components and update callers)

**Step 10: Commit**

```
feat(vivid): capability chips in ChatInput, remove ChatActions + RingMenu
```

---

### Task 6: Implement SilverTransferFlow Component

**Files:**
- Create: `apps/client/src/shells/vivid/components/SilverTransferFlow.tsx`

This is the inline flow that replaces the text input when the Silver chip is active.

**Step 1: Build the component**

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Dollar, CloseCircle } from '@solar-icons/react';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';
import { VIVID_SPRING, VIVID_TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface SilverTransferFlowProps {
  playerId: string | null;
  targetId?: string;         // 1:1 DM target (pre-selected)
  targetName?: string;
  channelId?: string;
  roster: Record<string, SocialPlayer>;
  context: 'main' | 'dm' | 'group';
  onSend: (amount: number, recipientId: string) => void;
  onCancel: () => void;
}

const AMOUNTS = [1, 2, 5, 10];

export function SilverTransferFlow({
  playerId,
  targetId,
  targetName,
  channelId,
  roster,
  context,
  onSend,
  onCancel,
}: SilverTransferFlowProps) {
  const myPlayer = playerId ? roster[playerId] : null;
  const mySilver = myPlayer?.silver ?? 0;

  // For 1:1 DM, target is pre-selected. For group, need a picker step.
  // Phase 1: 1:1 only. Group silver transfer is future work.
  const recipientId = context === '1on1' || context === 'dm' ? targetId : undefined;
  const recipientName = recipientId ? (roster[recipientId]?.personaName ?? 'them') : undefined;

  if (!recipientId) {
    // Group silver — show a simple message for now, future: player picker
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 16,
        background: 'rgba(196, 154, 32, 0.06)',
        border: '1px solid rgba(196, 154, 32, 0.15)',
      }}>
        <span style={{
          fontSize: 13,
          fontFamily: 'var(--vivid-font-body)',
          color: 'var(--vivid-text-dim)',
        }}>
          Silver transfer in groups coming soon
        </span>
        <motion.button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--vivid-text-dim)', cursor: 'pointer', padding: 4 }}
          whileTap={VIVID_TAP.button}
        >
          <CloseCircle size={18} weight="Bold" />
        </motion.button>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 16,
      background: 'rgba(196, 154, 32, 0.06)',
      border: '1px solid rgba(196, 154, 32, 0.15)',
      padding: '10px 14px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--vivid-font-display)',
          color: '#C49A20',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <Dollar size={16} weight="Bold" />
          Send Silver to {recipientName}
        </span>
        <motion.button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--vivid-text-dim)', cursor: 'pointer', padding: 4 }}
          whileTap={VIVID_TAP.button}
        >
          <CloseCircle size={16} weight="Bold" />
        </motion.button>
      </div>

      {/* Amount chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        {AMOUNTS.map((amt) => {
          const canAfford = mySilver >= amt;
          return (
            <motion.button
              key={amt}
              type="button"
              disabled={!canAfford}
              onClick={() => canAfford && onSend(amt, recipientId)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                background: canAfford ? '#FFFFFF' : 'rgba(139, 115, 85, 0.04)',
                border: `1.5px solid ${canAfford ? 'rgba(196, 154, 32, 0.3)' : 'rgba(139, 115, 85, 0.08)'}`,
                color: canAfford ? '#C49A20' : 'var(--vivid-text-dim)',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'var(--vivid-font-display)',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                opacity: canAfford ? 1 : 0.4,
              }}
              whileTap={canAfford ? VIVID_TAP.button : undefined}
              transition={VIVID_SPRING.snappy}
            >
              {amt}
            </motion.button>
          );
        })}
      </div>

      {/* Balance hint */}
      <div style={{
        marginTop: 6,
        fontSize: 11,
        color: 'var(--vivid-text-dim)',
        fontFamily: 'var(--vivid-font-body)',
        textAlign: 'right',
      }}>
        You have {mySilver} silver
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/client && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```
feat(vivid): add SilverTransferFlow — inline amount picker for silver capability
```

---

### Task 7: Implement InviteMemberFlow Component

**Files:**
- Create: `apps/client/src/shells/vivid/components/InviteMemberFlow.tsx`

This is the inline flow that replaces the text input when the Invite chip is active.

**Step 1: Build the component**

```tsx
import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, CloseCircle } from '@solar-icons/react';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { VIVID_SPRING, VIVID_TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface InviteMemberFlowProps {
  playerId: string | null;
  channelId?: string;
  roster: Record<string, SocialPlayer>;
  /** Current channel member IDs — to exclude from picker */
  channelMemberIds: string[];
  onInvite: (memberIds: string[]) => void;
  onCancel: () => void;
}

export function InviteMemberFlow({
  playerId,
  channelId,
  roster,
  channelMemberIds,
  onInvite,
  onCancel,
}: InviteMemberFlowProps) {
  // Eligible = alive players not already in channel and not self
  const eligible = Object.entries(roster).filter(([pid, p]) =>
    pid !== playerId &&
    p.status !== 'ELIMINATED' &&
    !channelMemberIds.includes(pid)
  );

  if (!channelId) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 16,
        background: 'rgba(59, 169, 156, 0.06)',
        border: '1px solid rgba(59, 169, 156, 0.15)',
      }}>
        <span style={{
          fontSize: 13,
          fontFamily: 'var(--vivid-font-body)',
          color: 'var(--vivid-text-dim)',
        }}>
          Send a message first to create the conversation
        </span>
        <motion.button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--vivid-text-dim)', cursor: 'pointer', padding: 4 }}
          whileTap={VIVID_TAP.button}
        >
          <CloseCircle size={18} weight="Bold" />
        </motion.button>
      </div>
    );
  }

  if (eligible.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 16,
        background: 'rgba(59, 169, 156, 0.06)',
        border: '1px solid rgba(59, 169, 156, 0.15)',
      }}>
        <span style={{
          fontSize: 13,
          fontFamily: 'var(--vivid-font-body)',
          color: 'var(--vivid-text-dim)',
        }}>
          No eligible players to invite
        </span>
        <motion.button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--vivid-text-dim)', cursor: 'pointer', padding: 4 }}
          whileTap={VIVID_TAP.button}
        >
          <CloseCircle size={18} weight="Bold" />
        </motion.button>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 16,
      background: 'rgba(59, 169, 156, 0.06)',
      border: '1px solid rgba(59, 169, 156, 0.15)',
      padding: '10px 14px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--vivid-font-display)',
          color: '#3BA99C',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <UserPlus size={16} weight="Bold" />
          Invite a player
        </span>
        <motion.button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--vivid-text-dim)', cursor: 'pointer', padding: 4 }}
          whileTap={VIVID_TAP.button}
        >
          <CloseCircle size={16} weight="Bold" />
        </motion.button>
      </div>

      {/* Player avatars as tappable chips */}
      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {eligible.map(([pid, player]) => (
          <motion.button
            key={pid}
            type="button"
            onClick={() => onInvite([pid])}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px 6px 6px',
              borderRadius: 9999,
              background: '#FFFFFF',
              border: '1.5px solid rgba(59, 169, 156, 0.2)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--vivid-font-display)',
              color: 'var(--vivid-text)',
            }}
            whileTap={VIVID_TAP.button}
            transition={VIVID_SPRING.snappy}
          >
            <PersonaAvatar
              avatarUrl={player.avatarUrl}
              personaName={player.personaName}
              size={24}
              isOnline={player.isOnline}
            />
            {player.personaName}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd apps/client && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```
feat(vivid): add InviteMemberFlow — inline player picker for invite capability
```

---

### Task 8: Update DMChat to Pass Capabilities and Engine Methods

**Files:**
- Modify: `apps/client/src/shells/vivid/components/DMChat.tsx:554-564`

**Step 1: Remove `handleChatAction` callback**

Delete the entire `handleChatAction` useCallback (lines 202-218). ChatInput now owns the capability flows directly.

**Step 2: Get channel capabilities from store**

Add near the existing store reads in DMChat:

```typescript
const channels = useGameStore((s) => s.channels);
const currentChannel = channelId ? channels[channelId] : undefined;
const channelCapabilities = currentChannel?.capabilities;
const channelMemberIds = [
  ...(currentChannel?.memberIds ?? []),
  ...(currentChannel?.pendingMemberIds ?? []),
];
```

**Step 3: Update ChatInput usage**

Change the `<ChatInput>` call to pass capabilities and extended engine:

```tsx
<ChatInput
  engine={engine}
  context={mode === '1on1' ? 'dm' : 'group'}
  targetId={mode === '1on1' ? targetPlayerId : channelId}
  targetName={mode === '1on1' ? target?.personaName ?? 'them' : 'the group'}
  channelId={mode === '1on1' ? (dmChannelId ?? undefined) : channelId}
  capabilities={channelCapabilities}
/>
```

Note: Remove `onChatAction={handleChatAction}` — that prop no longer exists.

**Step 4: Ensure engine object includes sendSilver and addMember**

Check that the `engine` object passed from the parent already includes these methods. If not, extend it in the parent component. The `useGameEngine` hook returns `sendSilver` and `addMember`, so the engine object just needs to include them. Verify the engine destructuring in the parent and add if missing.

**Step 5: Verify build**

Run: `cd apps/client && npx vite build`
Expected: PASS

**Step 6: Commit**

```
feat(vivid): wire capabilities from channel to ChatInput in DMChat
```

---

### Task 9: Update StageChat (MAIN channel has no action chips)

**Files:**
- Modify: `apps/client/src/shells/vivid/components/StageChat.tsx:462-467`

**Step 1: Pass capabilities for MAIN channel**

The MAIN channel only has `['CHAT', 'REACTIONS']`, so no input-area chips will render. But pass capabilities for correctness:

```tsx
<ChatInput
  engine={engine}
  context="main"
  replyTarget={replyTarget}
  onClearReply={() => setReplyTarget(null)}
  capabilities={['CHAT', 'REACTIONS']}
/>
```

Alternatively, read from the store:

```typescript
const channels = useGameStore((s) => s.channels);
const mainChannel = channels['MAIN'];
```

And pass `capabilities={mainChannel?.capabilities}`. Either approach works since MAIN never has input-area capabilities.

**Step 2: Verify build**

Run: `cd apps/client && npx vite build`
Expected: PASS

**Step 3: Commit**

```
feat(vivid): pass capabilities to ChatInput in StageChat
```

---

### Task 10: Visual QA with Integration Test

**Files:**
- None (testing only)

**Step 1: Start dev servers**

Run: `npm run dev` (turborepo — all apps)

**Step 2: Run integration test or manual QA**

Use the Playwright integration testing skill to:

1. Create a test game and advance to a state where DMs are open
2. Open the demo at `/demo` (or `localhost:5173/demo`) — quickest way to see the UI
3. Navigate to a DM conversation
4. Verify: capability chips (Silver, Invite) appear above the text input
5. Tap Silver chip → amount picker replaces input
6. Tap Cancel → returns to freeform input
7. Tap Invite chip → player picker replaces input
8. Tap a player → invite fires, returns to input
9. Verify MAIN chat has no chips (only CHAT + REACTIONS)

**Step 3: Fix any visual issues**

Adjust spacing, colors, animation timing as needed.

**Step 4: Final commit**

```
fix(vivid): visual QA polish for capability chips
```

---

### Task 11: Final Build Verification + Cleanup

**Files:**
- Verify no stale imports reference ChatActions or RingMenu

**Step 1: Check for stale references**

```bash
grep -r "ChatActions\|RingMenu" apps/client/src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (both deleted).

**Step 2: Full build**

Run: `npm run build`
Expected: All apps PASS

**Step 3: Run tests**

Run: `npm run test`
Expected: All PASS

**Step 4: Commit any remaining fixes**

```
chore: clean up stale references after capability chip migration
```
