# DM Invite Flow — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a configurable DM invitation system where recipients must accept/decline conversation invites, with a daily slot limit that forces strategic choices about who to talk to.

**Architecture:** Config-driven (`requireDmInvite` flag) routing in L3 that gates between the existing direct-DM path and a new invite flow. Unified channel model replaces the DM/GROUP_DM distinction. Client renders blurred/locked conversation previews for pending invites.

**Tech Stack:** XState v5 (L3 session), Zustand (client store), React (Vivid shell), Zod (schema validation), D1 (fact persistence)

---

## 1. Core Principles

- **Meaningful conversations over volume.** The slot limit forces players to be deliberate about who they talk to.
- **Chat-native actions.** Inviting a player, sending silver, and future actions all flow through the conversation as visible chat events — not disembodied buttons.
- **Async-first.** Players respond on their own schedule. No blocking on other players' actions.
- **Clean slate each day.** Slots reset, pending invites expire. Every day is a fresh set of strategic choices.
- **Backward compatible.** `requireDmInvite: false` (default) preserves all existing behavior.

---

## 2. Data Model

### 2.1 Unified Channel Model

Remove the DM vs GROUP_DM channel type distinction. All private conversations are channels with a member list.

```typescript
interface Channel {
  id: string;              // Generated UUID (replaces deterministic dm-p0-p3)
  type: 'MAIN' | 'PRIVATE' | 'GAME_DM';  // PRIVATE replaces DM + GROUP_DM
  members: ChannelMember[];
  createdBy: string;       // playerId of creator
  createdAt: number;       // timestamp
}

interface ChannelMember {
  playerId: string;
  joinedAt: number;        // timestamp — all history visible regardless
}
```

- A "1:1 DM" is a PRIVATE channel with 2 members.
- A "group DM" is a PRIVATE channel with 3+ members.
- Membership is mutable — players join as they accept invites.
- Max members: number of alive players in the game (practical limit is the 5-slot constraint).

### 2.2 Pending Invites

```typescript
interface PendingInvite {
  id: string;              // Generated UUID
  channelId: string;       // The channel being invited to
  senderId: string;        // Who sent the invite
  recipientId: string;     // One invite per recipient (fan-out from group invite)
  status: 'pending' | 'accepted' | 'declined';
  timestamp: number;
}
```

- Stored in L3 context (`pendingInvites: PendingInvite[]`).
- Expire on day reset (new L3 session starts with empty array).
- One invite record per recipient (a group invite to 3 players creates 3 PendingInvite records).

### 2.3 Slot Tracking

```typescript
// In L3 context
slotsUsedByPlayer: Record<string, number>  // playerId → count
```

- Incremented when a player **creates a new conversation** (1 slot) or **accepts an invite** (1 slot).
- Max = `dmSlotsPerPlayer` from manifest (default 5).
- Declining does not consume a slot.
- Inviting someone to an existing conversation you're already in is free.
- Resets each day (new L3 session).

### 2.4 Configuration

```typescript
// Added to PeckingOrderSocialRules (shared-types)
requireDmInvite: boolean;   // default false
dmSlotsPerPlayer: number;   // default 5, only meaningful when requireDmInvite is true
```

- Flows through manifest → `DailyManifest` → L3 context.
- Available for all game modes (static, dynamic, configurable cycle).
- `normalizeManifest()` fills defaults for old snapshots.

---

## 3. Server-Side Flow (L3)

### 3.1 Config-Driven Routing

L3 reads `requireDmInvite` from the day's manifest. When `false`, all existing SOCIAL.SEND_MSG / SOCIAL.CREATE_CHANNEL behavior is unchanged.

When `true`, the following flows activate:

### 3.2 Starting a Conversation

**Event:** `SOCIAL.INVITE_DM` with `{ recipientIds: string[] }`

**Guard (`canInviteDm`):**
- DMs are open
- Sender is alive
- All recipients are alive
- Sender has slots remaining

**Actions:**
1. Create channel with sender as sole member
2. Create PendingInvite for each recipient
3. Record `DM_INVITE_SENT` fact (per recipient)
4. Consume 1 sender slot

Sender can immediately type in the channel.

### 3.3 Accepting an Invite

**Event:** `SOCIAL.ACCEPT_DM` with `{ channelId: string }`

**Guard (`canAcceptDm`):**
- Invite exists and is pending
- Recipient has slots remaining

**Actions:**
1. Add recipient to channel members (with `joinedAt` timestamp)
2. Mark invite as accepted
3. Record `DM_INVITE_ACCEPTED` fact
4. Consume 1 recipient slot
5. Notify sender (system message in channel: "X joined the conversation")

Recipient can now see full message history and type.

### 3.4 Declining an Invite

**Event:** `SOCIAL.DECLINE_DM` with `{ channelId: string }`

**Actions:**
1. Mark invite as declined
2. Record `DM_INVITE_DECLINED` fact
3. Notify sender (system message in channel: "X declined")
4. No slot consumed

### 3.5 Inviting to an Existing Conversation

**Event:** `SOCIAL.INVITE_DM` with `{ channelId: string, recipientIds: string[] }`

**Guard:**
- Sender is a member of the channel
- Recipients not already members or invited

**Actions:**
- Create PendingInvite for each new recipient
- Record `DM_INVITE_SENT` fact per recipient
- No additional slot cost for sender (already paid when they created/joined)

### 3.6 Sending Messages (Invite Mode)

**Event:** `SOCIAL.SEND_MSG` with `{ channelId: string }`

**Guard:** Sender must be a member of the channel (not just invited).

Messages sent before all invitees accept are visible to those who later join (full history on accept).

### 3.7 Day Reset

New L3 session starts with:
- Empty `pendingInvites` array (invites expire)
- Fresh `slotsUsedByPlayer` (all zeros)
- Channels persist (carried forward in L2 context)

### 3.8 Game Master DM

Game Master DMs are always direct — no invite required, no slot consumed. Exempt from the invite system.

---

## 4. Fact Recording (D1 Persistence)

New fact types added to the journal pipeline:

| Fact Type | Actor | Data | Purpose |
|-----------|-------|------|---------|
| `DM_INVITE_SENT` | sender | `{ channelId, recipientId }` | Activity tracking, journal |
| `DM_INVITE_ACCEPTED` | recipient | `{ channelId, senderId }` | Conversation start, journal |
| `DM_INVITE_DECLINED` | recipient | `{ channelId, senderId }` | Strategic data, journal |

These flow through the existing pipeline: L3 action → `sendParent(FACT.RECORD)` → L2 → L1 subscription → D1 GameJournal.

No ticker generation from these events (ticker redesign is a separate project).

---

## 5. Client UI

### 5.1 Whispers Conversation List (Invite Mode ON)

All entries ordered by last message/event timestamp (most recent first). Three visual states for conversation entries:

**Active conversations** — Normal appearance. You're a member, can read and type. Shows last message preview, timestamp, member avatars.

**Sent invites (pending)** — Your conversations where invited recipients haven't responded yet. Shows with a subtle "pending" badge. You can tap in and type (you're the creator/member). Pending invitee names shown dimmed.

**Received invites** — Conversations you've been invited to but haven't accepted. Show as normal conversation entries but with **blurred message preview text** (CSS `filter: blur`). Sender name and avatar visible. For groups, member list visible.

### 5.2 Locked Conversation View

When recipient taps a received invite, the conversation opens in a locked state:

- Messages rendered but blurred behind a semi-transparent overlay
- Overlay content:
  - Sender avatar(s)
  - "X wants to chat" (1:1) or "X invited you to a group with Y, Z" (group)
  - **Accept** button (prominent)
  - **Decline** button (secondary)
  - Remaining slots: "3 of 5 conversations remaining today"
- **Accept** → overlay animates away, blur drops, full conversation revealed, input enabled
- **Decline** → navigates back to Whispers list, conversation entry removed

### 5.3 Slot Counter

Displayed in the Whispers tab header area. Shows "3/5" or similar. Visible reminder of remaining budget.

### 5.4 Contextual Chat Actions

The chat input area gains a `+` button (or similar affordance) that opens available actions. Actions are chat-native — they produce visible events in the conversation, not silent side effects.

**Actions for this feature:**
- **Invite player** — opens player picker scoped to alive players not already in channel. Produces a system message: "Skyler invited Bella to the conversation"
- **Send silver** — existing functionality, moved into the action pattern. Produces a system message: "Skyler sent 5 silver to Bella"

The pattern is extensible for future actions (propose alliance, share intel, etc.) without redesigning the UI.

### 5.5 Invite Mode OFF

When `requireDmInvite` is false, the Whispers tab works exactly as it does today. No blurred cards, no slot counter, no accept/decline. The contextual actions (`+` button) can still be present for send silver and invite-to-group functionality.

---

## 6. Lobby Configuration

### 6.1 Game Config UI

Add to the social settings section (visible for all game modes — static, dynamic, configurable cycle):

- **Toggle:** "Require DM invitations" (default: off)
- **When on:** Slider for "Conversations per player per day" (default: 5, range: 2-10)

### 6.2 Manifest Construction

`createGame()` includes `requireDmInvite` and `dmSlotsPerPlayer` in the social rules section of the manifest. These flow through to each day's `DailyManifest`.

---

## 7. Migration & Backward Compatibility

- `requireDmInvite` defaults to `false` — all existing games unchanged.
- `normalizeManifest()` fills the default for snapshots missing the field.
- Existing `dm-p0-p3` format channel IDs continue to work for `requireDmInvite: false` games.
- New UUID-based channel IDs used only when invite mode creates channels.
- `PRIVATE` channel type is new — existing `DM` and `GROUP_DM` types remain functional for old games. New games with invite mode use `PRIVATE`.
- Client checks `requireDmInvite` from the SYNC payload to decide which UI mode to render.
- Demo server unaffected (uses direct DMs, no invite mode).

---

## 8. What Changes vs What Stays

### Changes
- Unified channel model: `PRIVATE` replaces `DM` + `GROUP_DM` for invite-mode games
- Channel IDs: UUID-based for invite-mode channels
- Mutable channel membership with `joinedAt` tracking
- New L3 context fields: `slotsUsedByPlayer`
- New facts: `DM_INVITE_SENT`, `DM_INVITE_ACCEPTED`, `DM_INVITE_DECLINED`
- Whispers UI: blurred invite cards, locked conversation overlay, slot counter
- Chat input: contextual actions pattern (invite player, send silver)
- Lobby: invite mode toggle + slot count config (all game modes)
- `PeckingOrderSocialRules`: `requireDmInvite`, `dmSlotsPerPlayer` fields

### Stays the Same
- `requireDmInvite: false` preserves all current behavior
- Main group chat unaffected
- Game Master DM unaffected (always direct, no invite needed)
- Silver economy, perks unchanged
- Ticker pipeline unchanged (excluded from this design)
- L2 orchestrator, L4 post-game unchanged
- Alarm/scheduling pipeline unchanged

---

## 9. Open Questions (Deferred)

- **Ticker redesign**: How invite events surface in the ticker feed — separate design project.
- **Push notifications**: "You received a DM invite" push — useful but requires push template additions. Can add later.
- **Contextual action extensibility**: What other chat actions beyond invite and send silver? Design as needed.
- **Group DM cap**: Currently capped at alive player count. May want a stricter default (e.g., 4-5) — observe in playtest.
