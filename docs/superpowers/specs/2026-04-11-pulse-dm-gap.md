# Pulse DM Gap — Missing from Phase 1 Design

**Date:** 2026-04-11
**Status:** Discovered after Phase 1 implementation; design+plan rewrite needed before fixing
**Branch:** `feature/pulse-shell-phase1`

## The Gap

The Pulse shell ships with a working DM **send/view** flow but is missing the **discoverability and management** layer entirely. There are four interconnected missing pieces:

### 1. No DM inbox / conversation list
- **Today:** A player can open a DM only by tapping the recipient's avatar (chat or Cast) → AvatarPopover → DM, or via `/dm` → PlayerPicker. Both paths require the sender to remember exactly who they want to talk to.
- **Missing:** A list of *existing* conversations the player is part of (1:1 DMs, group DMs, GM DM), sorted by recency, showing last-message preview + timestamp.
- **Symptom:** When Bella DMs Silas, Silas has no UI showing the DM exists. He'd have to tap Bella's avatar in chat and open the DM to see what she sent — but he doesn't even know to do that.

### 2. No incoming DM notification
- **Today:** No badge anywhere indicating unread DMs. The store has no `unreadByChannel` selector either.
- **Missing:** Visible signal somewhere persistent (Cast tab badge? new tab? floating bubble? presence-bar dot on the sender's avatar?) that says "you have N unread DMs".
- **Severity:** Critical for engagement — DMs are where the actual gameplay/strategy happens; if they're invisible, players ignore the entire mechanic.

### 3. Group DMs have no creation UI
- **Server supports:** `Events.Social.CREATE_CHANNEL` with `memberIds: [p1, p2, ...]` creates a `GROUP_DM`. `engine.createGroupDm()` is wired.
- **Pulse component:** `GroupDMView.tsx` exists and renders correctly when a group channel is opened.
- **Missing:** Any way for a player to *create* a group DM. `/dm` slash command is single-select. There is no multi-select player picker.
- **Game design weight:** Group DMs are a core game mechanic — they enable alliances, secret coordination, the social fabric of the show.

### 4. DM invite flow is invisible
- **Server supports** (per ADR-096): in `requireDmInvite` mode, recipients of a first DM go into `pendingMemberIds`, not `memberIds`. The DM appears with blurred preview until they `Events.Social.ACCEPT_DM` or `DECLINE_DM`.
- **Engine:** `engine.acceptDm(channelId)` / `engine.declineDm(channelId)` would need to be added.
- **Missing in Pulse:** No UI to surface pending invites. The recipient can't see they have a pending DM, much less accept or decline it.
- **Note:** This is opt-in per manifest (`requireDmInvite: true`), so it's only blocking for invite-mode games — but those are a key configuration.

## Why The Original Spec Missed This

The Pulse spec (`2026-04-10-pulse-shell-design.md`) covers the **DM view** in detail (§5: Direct Messages — full-screen conversation, header, persona image, etc.) and §6 mentions Group DMs ("Same as DM but with overlapping portrait stack in the header"). But it never specifies:

- A conversations list / inbox surface
- Notification model for incoming DMs
- Entry point for *creating* a group DM (only mentions opening one)
- Pending-invite acceptance UI

The spec assumed `/dm` and avatar-tap covered all entry points, which works for outbound but breaks for inbound.

## Vivid's Approach (For Reference, Not To Copy)

Vivid has a dedicated **Whispers tab** (3rd tab alongside Stage and People) that renders `WhispersTab.tsx`:
- Shows GM DM, 1:1 DM threads, group DM threads — sorted by last-message timestamp
- Each row: persona avatar(s), name(s), last-message preview, relative time, pending badge
- Tap row → opens `DMChat` overlay (full-screen)
- "+" button opens `NewConversationPicker` for creating new DMs (single or multi)
- `InviteOverlay` for pending invite accept/decline

Pulse should solve the same problems but in the Pulse interaction model — not duplicate Vivid's tab structure. Pulse only has 2 tabs (Chat + Cast) per spec, and adding a third would dilute that.

## Design Options For Pulse (To Brainstorm)

The next agent should brainstorm with the user before designing. Some directions:

**Option A — Inline conversation list at top of Cast tab**
- Cast tab grows a "Your Conversations" section above the leaderboard
- Pros: stays within 2-tab structure; Cast already shows people, conversations are people-driven
- Cons: dilutes Cast as a leaderboard

**Option B — Floating DM dock above input**
- A subtle bar above the chat input (between it and the tab bar) showing avatars of players you've DM'd recently
- Tap an avatar → opens that DM
- Notification dots on avatars with unread messages
- Pros: persistent, glanceable, no new tab
- Cons: limited info per row (no preview)

**Option C — Slide-out panel from Cast tab**
- Cast tab gets a "Conversations" toggle/header that slides in a drawer with the conversation list
- Pros: rich list view available, doesn't add a tab
- Cons: more taps to access

**Option D — Notification toast / shell-level overlay on incoming DM**
- When a new DM arrives, show a Slack-style toast at top with sender + preview snippet
- Tap to open the DM
- Combine with one of A/B/C for the persistent surface
- Pros: solves the "you don't know it arrived" problem instantly
- Cons: easy to miss / dismiss

**Option E — Replace `/dm` slash with a conversations-aware command**
- `/dm` opens an inbox/picker hybrid: shows existing conversations at top, "start new" below
- Pros: uses an entry point that already exists
- Cons: still requires the user to actively open the slash menu — no passive notification

**Group DM creation:** Whatever the inbox surface is, it should have a "+" / "New conversation" button that opens a multi-select PlayerPicker. (Currently `/dm` is single-select.)

**Invite handling:** Pending invites should appear in the inbox surface with prominent Accept/Decline buttons. Engine needs `acceptDm(channelId)` / `declineDm(channelId)` methods (the events exist server-side already).

## What To Read Before Designing

- **ADR-096** (`plans/DECISIONS.md` line 1413): unified DM channel model + invite flow
- **ADR-100**: DMChat full-screen overlay decision (Vivid's lesson)
- **`apps/client/src/shells/vivid/components/WhispersTab.tsx`**: how Vivid solved the inbox (~750 lines, includes 1:1, group, GM, pending sections)
- **`apps/client/src/shells/vivid/components/NewConversationPicker.tsx`**: multi-select player picker for new conversations
- **`apps/client/src/shells/vivid/components/InviteOverlay.tsx`**: pending invite UI
- **Pulse spec §5/§6/§7**: existing DM/Group DM/Send Silver design (the slot it needs to fit into)
- **`packages/shared-types/src/events.ts`**: `Events.Social.ACCEPT_DM/DECLINE_DM/CREATE_CHANNEL/ADD_MEMBER` (the server events to call)

## Suggested Process

1. Brainstorm with user (use `superpowers:brainstorming` skill) — pick a design direction (A/B/C/D/E or hybrid)
2. Update `2026-04-10-pulse-shell-design.md` with new sections covering: conversation list, notification model, group DM creation, pending invite UI
3. Write a Phase 1.5 plan (or fold into Phase 2) for the implementation
4. Add `engine.acceptDm()` / `engine.declineDm()` to `useGameEngine.ts`
5. Add `unreadByChannel` derived selector to the store using `lastSeenByChannel` localStorage
6. Build the chosen surface, wire entry points
7. Multi-player test: send DM as A, verify notification appears for B, accept invite if applicable, reply, verify A sees it
