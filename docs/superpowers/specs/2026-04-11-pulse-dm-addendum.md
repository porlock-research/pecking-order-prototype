# Pulse Shell — DM & Group DM Design Addendum

**Date:** 2026-04-11
**Status:** Draft, awaiting review
**Supersedes:** Nothing; extends `2026-04-10-pulse-shell-design.md`
**Related ADRs:** ADR-056 (Unified Chat Channel Architecture), ADR-096 (DM Invite Flow)

## Problem

The Pulse spec and mockups cover DM **composition** (pick a player → open conversation) but not DM **discovery, management, or group creation**. In practice this means:

1. A player receiving a DM while in main chat has no signal it arrived.
2. There is no persistent surface listing active DM conversations.
3. Returning to an existing DM requires re-walking the slash flow or hoping you can tap the right avatar.
4. Group DMs have no creation UI — `/dm` is single-select, and there is no "add someone" affordance inside an existing DM.
5. Incoming DM invites (per ADR-096 — `DM_INVITE_SENT` facts) have no accept/decline surface.

DMs are where alliance-building happens. If the discovery layer is broken, the deepest social mechanic in the game goes dark between sessions and the meta-game flattens.

## Design Principles (inherited from Pulse spec)

- **Everything on one screen** — don't bury DMs in a third tab
- **Low-friction** — one tap to reach an active conversation
- **Reality TV show, not chat app** — portraits are the anchor, not message previews
- **Always alive** — unread/activity should *feel* like the game is breathing at you
- **Tabs: 2** — keep Chat and Cast; don't add a third

---

## 1. DM Thread Strip (in the Chat tab)

Replace the current "LIVE / 1 online + avatar stack" presence strip (which diverged from prototype 08 anyway) with a **DM thread strip** that doubles as presence:

```
┌─────────────────────────────────────────────────────────┐
│  [🟢 Daisy•2]  [Silas]  [🔴 Brick+Luna•5]  [+]           │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Horizontal scroll of round/square-cornered 40×40 portrait chips for each of the current player's **active DM threads** (ordered by recency of last message).
- 1:1 DMs show a single portrait. Group DMs show overlapping 2-portrait stacks (truncated past 2).
- Badge overlay on the top-right corner of each chip:
  - **Coral dot with count** (`•2`) = unread count
  - **No badge** = no unread
  - **Green presence ring** on the chip = that DM partner is online (for 1:1s); for groups, green ring = any member online
- Tap → jumps directly into that DM conversation. This is the primary return path.
- **+ chip on the right** = "Start new DM" → opens the existing `/dm` picker (now multi-select, see §3).
- Empty state (no active DMs) = just the **+** chip with "Start a DM" hint text.

**Why this placement:** it lives where the presence bar currently lives (below ticker, above chat feed), so it's a persistent, glanceable layer. It *is* presence (green ring) + *is* inbox (unread count) + *is* composition (+ chip) — one strip, three jobs.

**Data source:**
- `channels` store slice filtered to `type === 'DM' | 'GROUP_DM'` where current player is a member
- Unread count derived from `chatLog` messages in that channel with `timestamp > lastReadTimestamp[channelId]` (new store field)
- Online state from `onlinePlayers`

---

## 2. Unread Signals Across the Shell

Without good signals, the thread strip isn't enough. Add three lightweight indicators:

### 2a. Chat tab badge
Coral dot with total unread DM count on the Chat tab icon in the tab bar, visible when looking at the Cast tab.

### 2b. Cast card badge
On each Cast grid card, if the current player has unread messages from that persona, overlay a small coral "• N" badge on the portrait's top-right corner. A teenager looking at the cast should be able to see "Daisy sent me something" at a glance.

### 2c. Ticker surfacing (selective)
The current ticker shows "2 players are whispering" (anonymized). Also surface:
- `"Daisy → you"` (shown only to the recipient) as a coral-tinted ticker entry when Daisy starts a new DM thread with you
- `"Brick + Luna invited you"` when someone adds you to a group DM (drives the accept flow below)
- Tap → jumps to that DM or surfaces the invite sheet

Do **not** broadcast "X sent a DM to Y" publicly — DMs are private. Only the involved parties see the ticker line. (The server's per-player SYNC filtering already supports this.)

### 2d. No push-notification overlap bug
When a DM push notification lands and the app is in foreground, *don't* also fire an in-app toast. One signal, not two.

---

## 3. Group DM Creation

### 3a. Multi-select in the /dm picker

Extend the existing player picker (`PlayerPicker.tsx`) to support multi-select when the source is `/dm`:

- Tap a portrait → a **coral checkmark overlay** appears on the top-right corner of that card.
- Tap again to deselect.
- As soon as **2+ players are selected**, a floating bar appears above the picker: `"Start group with [2] →"` (or 3, 4, etc.). The count is coral.
- If only 1 is selected, tapping it continues to the existing "open 1:1 DM" flow (no change).
- Back button (`←`) in the breadcrumb cancels.

**No long-press.** First tap = select; "Start group" button is the confirm (per the "no long-press on scrollable content" rule from memory).

### 3b. Group creation = direct (no naming)

On "Start group" tap:
- Engine calls `createGroupDm(memberIds)` (already exists)
- Shell navigates directly into the new group DM conversation
- Group name defaults to **first names joined**: `"Daisy, Silas, Brick"` (truncate to 3 names then "+ 2 more" if needed). Names use per-player colors.
- **No manual naming in v1.** A "Rename group" affordance can live inside the group DM header as a future extension, but first-run data from playtests should decide whether teens care about naming groups. Default heuristic is likely fine.

### 3c. Add a member to an existing DM

Inside a DM or Group DM conversation, the header has a stacked-portraits cluster (existing). Tap the header cluster → a **member sheet** slides up:
- Lists current members (portrait + name + stereotype)
- At the bottom: `[+ Add someone]` button
- Tap → re-opens the player picker in multi-select mode, filtered to exclude current members
- On confirm → engine calls `addMember(channelId, newMemberIds)` (already exists)
- Creates a system message in the channel: `"[you] added Silas"` with Silas's portrait, styled like a broadcast card but in-thread.

**1:1 → Group promotion:** adding a third person to a 1:1 DM creates a new `GROUP_DM` channel rather than mutating the existing 1:1 (server-side detail; UX is seamless). Server behavior should match ADR-056.

---

## 4. Incoming DM Invite Handling (ADR-096)

Per ADR-096, DMs into a player who hasn't accepted their DM slot show as **pending invites**. The current Pulse shell surfaces none of this.

### 4a. Pending invite card in the DM thread strip

A pending invite from another player shows up in the **DM thread strip** with:
- The inviter's portrait
- A **yellow/nudge-color pulsing dot** badge (not coral — distinguish pending from unread)
- Tap → opens an **invite sheet** (not the conversation directly)

### 4b. Invite sheet

Full-screen or bottom-sheet:
```
┌─────────────────────────────┐
│  [large portrait]           │
│  Silas Vane                 │
│  The Brooding Artist        │
│                             │
│  wants to DM you            │
│                             │
│  [Accept]  [Decline]        │
└─────────────────────────────┘
```

- **Accept** → engine sends `SOCIAL.ACCEPT_DM`, sheet dismisses, navigates into the DM. Records `DM_INVITE_ACCEPTED` fact.
- **Decline** → engine sends `SOCIAL.DECLINE_DM`, sheet dismisses, thread strip chip disappears. Records `DM_INVITE_DECLINED` fact.
- **Message preview** should *not* be shown on the invite card — decision should be based on persona, not content (matches the "relationships, not content" framing of alliance-building).

### 4c. Outgoing pending state

When the current player sends a DM that's pending recipient acceptance:
- Their side of the DM thread strip shows a **dim/muted chip** with a clock icon overlay
- Tapping opens the (already-sent) conversation, but the input is disabled with a hint: `"Waiting for [Name] to accept…"`
- If declined, chip disappears + a ticker line surfaces to the sender: `"[Name] declined your DM"`

---

## 5. DM Conversation View — Header Refinements

Current `DMView.tsx` has a persona header. Add:

- **Status ring** on the header portrait (online/offline) — same as the Cast tab treatment
- **Typing indicator** as a subtle pulsing dot under the name when `typingPlayers[channelId]` matches
- **Member count chip** for group DMs: `"3 members"` tappable → member sheet (see 3c)
- **Close button** returns to Chat tab, pulse bar and ticker re-appear. The DM view should feel like a *dive* not a *destination* — surfacing the persistent game state when you return is critical.

---

## 6. Store Additions

```typescript
// useGameStore additions
lastReadTimestamp: Record<string, number>  // channelId -> timestamp of last read message
pendingDmInvites: PendingInvite[]           // populated from SYNC
openDmChannelId: string | null              // currently-open DM view, null if in main chat

// actions
markDmRead: (channelId: string) => void     // updates lastReadTimestamp[channelId] = Date.now(), persists to localStorage
openDm: (channelId: string) => void
closeDm: () => void
```

`lastReadTimestamp` persists to localStorage keyed by `(gameId, playerId)` so unread counts survive refreshes.

## 7. New Components

```
apps/client/src/shells/pulse/components/
  dm/
    DMThreadStrip.tsx       # horizontal scroll of DM thread chips
    DMThreadChip.tsx        # single chip (portrait(s) + badges)
    MemberSheet.tsx         # bottom sheet listing DM/group members + Add button
    InviteSheet.tsx         # pending DM invite accept/decline UI
  input/
    PlayerPicker.tsx        # MODIFY: add multi-select mode when source='/dm'
```

## 8. Open Questions

1. **Group DM cap** — server currently supports N-person groups; should the UI cap at 4? 6? (Teen social dynamics may favor smaller groups.)
2. **Leave group** — if a player adds themselves into a group they want to leave, how? Propose: long-press on member-sheet entry reveals a `[Leave]` button (exception to the no-long-press rule since this surface is not scrollable chat). Or an explicit "Leave group" option in the group DM header overflow menu.
3. **Invite from message avatar** — when current player taps a non-member's avatar in main chat and selects DM, and that player has no pending slot, does it silently create a `DM_INVITE_SENT` fact, or does the sender see a confirmation sheet first? Recommend: show a confirmation sheet with "You'll use 1 of your 3 DM slots" text, then send.
4. **Group DM silver cost** — ADR-056 notes DMs have `silverCost` constraints. Are group DMs more expensive than 1:1s? Needs game-design input.
5. **Archiving / hiding** — should old DM threads drop off the strip after N days of inactivity? Proposal: strip shows threads with activity in last 24 hours + all threads with unread; older threads accessible via an expanded view (swipe left on the strip).

## 9. Phased Delivery

**Phase 1.5 (small, ships into current Pulse implementation):**
- DM thread strip replacing the presence bar (§1)
- Chat tab unread badge (§2a)
- Cast card unread badges (§2b)
- `lastReadTimestamp` + `markDmRead` store plumbing

**Phase 2 (group + invites):**
- Multi-select in `/dm` picker (§3a, §3b)
- Add-member flow inside existing DMs (§3c)
- Pending invite surface (§4)
- Member sheet (§3c header tap)

**Phase 3 (polish):**
- Status rings + typing indicator in DM header (§5)
- Ticker surfacing for invites and new threads (§2c)
- Archive/hide logic (§8.5)

## 10. Success Criteria

- A player in main chat who receives a new DM *always* sees at least one signal without switching tabs (thread strip badge, ticker, or Cast badge).
- Returning to an active DM is **one tap** from the Chat tab.
- Creating a group with 3 people takes ≤ 5 taps: `/dm` → tap 3 portraits → "Start group".
- Incoming invites are unmissable but not intrusive — pulsing yellow dot, never a modal interrupt.
- DM discovery is visually distinct from game-phase cartridges: thread strip uses portraits (personal), pulse bar uses labeled pills (scheduled). No chrome ambiguity.

---

## Summary

The original Pulse spec optimized for **initiating** player-to-player interaction. This addendum closes the loop on **maintaining** it — seeing who wants to talk to you, returning to ongoing conversations, and expanding conversations into alliances. Without these, the server's rich DM/group/invite model stays invisible to players and the alliance meta-game stays flat.
