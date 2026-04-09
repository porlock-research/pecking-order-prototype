# Client UI Refinement

> Comprehensive analysis of mobile + desktop client issues, with prioritized fixes.

## Current State (Feb 2026)

The client is a functional prototype that renders every game state correctly, but it hasn't had a dedicated polish pass. The information hierarchy is flat (everything gets equal visual weight), chrome eats too much vertical space on mobile, and several elements are positioned in ways that create UX friction.

---

## Design Philosophy: The Timeline IS the Game

The Green Room is not a group chat with game panels bolted on top. It is a **timeline** — a living, scrollable record of everything that happens during a day. Chat messages, game events, voting rounds, silver transfers, eliminations, activity prompts — they are all entries in one chronological stream.

This reframes the entire UI:

1. **One scroll context, not two.** The current architecture renders game/vote/activity panels as fixed blocks above the chat, creating two competing scroll regions. In the timeline model, an active voting card is just another entry in the scroll — it appears at the moment voting starts, with chat messages flowing above and below it. No vertical space war.

2. **Late arrivals get the full story.** This is an async game. A player who joins mid-afternoon should scroll up and see: "Day 2 began → morning briefing → chat reactions → game started → game results card → more chat → voting opened → voting card → elimination reveal." The timeline tells the story of the day without needing a separate Game History panel or ticker.

3. **Everything is a timeline entry.** Chat messages, Game Master announcements, silver transfers ("X sent Y 5 silver"), perk usage, game results, voting results, eliminations — they all get type-specific visual treatments but live in the same chronological flow. The server already records these as facts; the timeline gives them a home.

4. **Active cartridges render inline.** When a vote starts, a voting card appears in the timeline. It's interactive while active, then becomes a static result summary when complete. Same for games and activities. The card scrolls with the rest of the content. The chat input stays pinned at the bottom, always accessible.

5. **DMs are strategic tools, not afterthoughts.** With contextual actions (silver transfers), game-specific DM channels, and per-day partner limits, DMs are a resource players manage. The DM experience should feel like a first-class messaging app.

6. **The input area is sacred ground.** The message composer is always pinned at the bottom, always visible, never obstructed by game panels.

### What this subsumes

The timeline model eliminates the need for several existing components:
- **Game History panel** → game result cards persist in the timeline
- **News ticker content** → system events are timeline entries (the ticker bar itself may stay as ambient flavor or be removed entirely)
- **Debug bar** → phase transitions are visible as timeline milestones
- **"GREEN ROOM" sub-header** → the timeline is the default view, no label needed
- **Stacking panels above chat** → cartridges render inline within the scroll

### What stays separate
- **DMs tab** — private messages are not part of the public timeline
- **Roster tab** — player list, perks, and settings
- **Header** — phase indicator, silver wallet, alerts
- **Footer tabs** — navigation between Timeline / DMs / Roster

---

## Issues

### 0. Replace Green Room + stacked panels with a unified Timeline view

**Severity**: Critical
**Files**: `App.tsx:354-379`, `ChatRoom.tsx`, `VotingPanel.tsx`, `GamePanel.tsx`, `PromptPanel.tsx`, `GameHistory.tsx`, `NewsTicker.tsx`

The Green Room currently treats chat messages and game mechanics as separate UI layers — panels stack above chat, stealing vertical space. The timeline model unifies them into a single scrollable feed.

**Current layout (broken)**:
```
Header
[VotingPanel]       ← fixed block, 300-500px
[GamePanel]         ← fixed block, 400px+
[GameHistory]       ← fixed block, 40px
[PromptPanel]       ← fixed block, 200-400px
[PerkPanel]         ← fixed block, 40-120px
ChatRoom            ← whatever's left (often <100px)
Footer tabs
Ticker
```

**Proposed layout (timeline)**:
```
Header
Timeline (single scroll)
  ├─ SystemEntry: "Day 2 has begun"
  ├─ SystemEntry: "Group chat is open"
  ├─ ChatMessage: "good morning everyone"
  ├─ ChatMessage: "who's ready to vote"
  ├─ SystemEntry: "Countess Snuffles sent 5 silver to Baron Biscuit"
  ├─ GameCard: [Trivia — interactive while active, result summary when done]
  ├─ ChatMessage: "that was hard!"
  ├─ SystemEntry: "Voting has begun — Majority Rules"
  ├─ VoteCard: [Majority voting — interactive while active, result when done]
  ├─ ChatMessage: "no way"
  ├─ EliminationCard: "Baron Biscuit has been eliminated"
  └─ SystemEntry: "Night falls..."
ChatInput (pinned bottom)
Footer tabs
```

**Timeline entry types**:

| Type | Source | Visual Treatment |
|------|--------|-----------------|
| `CHAT_MESSAGE` | L3 chatLog | Bubble (existing style, with avatar + grouping improvements) |
| `SYSTEM_EVENT` | Ticker / phase transitions | Centered label with divider lines, muted text |
| `GAME_MASTER` | GM messages in chatLog | Gold banner with left border (existing style) |
| `VOTE_CARD` | activeVotingCartridge | Embedded interactive card; collapses to result summary when done |
| `GAME_CARD` | activeGameCartridge | Embedded interactive card; collapses to result summary when done |
| `ACTIVITY_CARD` | activePromptCartridge | Embedded interactive card; collapses to result summary when done |
| `SILVER_TRANSFER` | FACT.RECORD | Small inline event: "X → Y: 5 silver" |
| `ELIMINATION` | FACT.RECORD | Dramatic card with skull/animation |
| `PERK_USED` | FACT.RECORD | Small inline event: "X used Spy DMs" |

**Key behaviors**:
- **Auto-scroll**: Timeline auto-scrolls to bottom on new entries (like current chat). If player has scrolled up to read history, pin scroll position and show a "jump to latest" pill.
- **Active cartridge stickiness**: When a vote/game/activity card is active and the player scrolls away from it, show a floating "Return to Vote" / "Return to Game" pill so they can jump back. The card itself stays in its chronological position.
- **Completed cartridges collapse**: A voting card that showed 8 player buttons during the active phase collapses to a compact result summary (e.g., "Majority Vote — Baron Biscuit eliminated · 5-3") once complete. Players can tap to expand the full result.
- **Input always pinned**: Chat composer stays fixed at the bottom of the viewport, outside the scroll. Same sacred-ground principle.

**Data flow — how entries get into the timeline**:

The client already receives everything it needs:
- `chatLog` from SYSTEM.SYNC → `CHAT_MESSAGE` + `GAME_MASTER` entries
- `tickerMessages` from TICKER.UPDATE → `SYSTEM_EVENT` entries
- `activeVotingCartridge` / `activeGameCartridge` / `activePromptCartridge` from SYSTEM.SYNC → `VOTE_CARD` / `GAME_CARD` / `ACTIVITY_CARD` entries
- Facts from ticker pipeline → `SILVER_TRANSFER`, `ELIMINATION`, `PERK_USED` entries

The client merges these into a unified `TimelineEntry[]` sorted by timestamp. Active cartridges are inserted at the timestamp they became active (or at the end if no timestamp available).

**What this replaces**:
- `ChatRoom.tsx` → becomes the Timeline renderer (messages are a subset of entries)
- `GameHistory.tsx` → removed (completed game/vote cards persist in the timeline)
- `VotingPanel.tsx` / `GamePanel.tsx` / `PromptPanel.tsx` → no longer rendered as stacked panels in `App.tsx`; their content renders as inline cards within the Timeline
- `NewsTicker.tsx` → ticker content becomes system events in the timeline (the ticker bar itself can be kept for ambient flavor or removed)
- `PerkPanel.tsx` → moves to Roster tab or header action

**Implementation approach**:
1. Define `TimelineEntry` union type and build a `useTimeline()` hook that merges chatLog + ticker + cartridge state into a sorted array
2. Build a `Timeline` component that renders entries by type, with a scroll container + pinned input
3. Build inline card variants of VotingPanel, GamePanel, PromptPanel (compact active + collapsed complete states)
4. Wire Timeline into App.tsx, replacing the current ChatRoom + stacked panel layout
5. Move PerkPanel and GameHistory out of the main flow (Roster tab)
6. Evaluate whether NewsTicker bar is still needed or if its content is fully absorbed

**Status**: [x] Done (commit 4013e17)

---

### 1. Header is overcrowded on mobile

**Severity**: High
**File**: `App.tsx:278-304`

The header packs 5 distinct elements into one row: title ("PECKING ORDER"), phase badge ("LIVE SESSION"), Alerts button, online count pill, and silver wallet. On a ~375px mobile screen this reads as visual noise.

**Problems**:
- The title "PECKING ORDER" takes ~130px at `text-lg` for branding that the player already knows
- Phase badge ("LIVE SESSION", "CASTING LOBBY", etc.) is useful context but competes with the title
- Online count pill is nice-to-have, not need-to-see
- All items have similar visual weight so nothing stands out

**Proposed fix**:
- Shrink or remove the full title on mobile — show a compact logo mark or just "PO"
- Keep phase badge (it's the most useful header info)
- Move online count to the Roster tab or make it a subtle indicator, not a full pill
- Keep silver wallet (players check it constantly) and alerts
- Result: header goes from 5 elements to 3 (phase + silver + alerts), with breathing room

**Status**: [x] Partially done — phase badge removed (commit 78c6478). Online pill + title remain; further declutter TBD.

---

### 2. Relocate Perks panel (Game History absorbed by timeline)

**Severity**: High
**Files**: `App.tsx:355-359`, `PerkPanel.tsx`, `GameHistory.tsx`

With the timeline model (issue #0), Game History is eliminated — completed game/vote results persist as collapsed cards in the timeline itself. No separate panel needed.

Perks still needs a home. It's currently an always-present collapsible row above chat (~40px collapsed, ~120px expanded) used maybe once per day phase.

**Proposed fix**:
- **Delete GameHistory component** — its purpose is absorbed by the timeline's persistent cards
- **Move Perks** to the Roster tab (alongside player list) or behind a button in the header
- Result: the timeline gets 100% of the content area between header and input

**Status**: [x] Done — GameHistory removed, PerkPanel in desktop sidebar + People list.

---

### 3. Admin FAB overlaps the SHOUT button

**Severity**: High
**File**: `App.tsx:419-429`

The admin link is a `fixed bottom-24 right-4 z-50` red circle (48x48px) with a gear emoji. It sits directly in the path of the send button.

**Problems**:
- Overlaps with or sits very close to the SHOUT button, causing misclicks
- `glow-breathe` animation draws the eye to a dev tool, not a player action
- Should not exist in production builds at all

**Proposed fix**:
- Gate behind a dev/admin flag (env var or query param) — regular players never see it
- When shown, move it to a less conflicting position (e.g., inside settings, or top-left long-press)

**Status**: [x] Done enough — gated behind `import.meta.env.DEV`, production safe. Position tweak is low priority.

---

### 4. Chat needs to feel like a first-class messaging app

**Severity**: High
**File**: `ChatRoom.tsx`, `DirectMessages.tsx`

Chat is the core game mechanic (see Design Philosophy above), but the current implementation feels like a prototype chat widget, not a messaging experience players will spend 90% of their time in.

**Green Room (main chat) issues**:
- Messages are small bubbles floating in vast space with no visual anchoring
- Own messages show no timestamp (only on hover — which doesn't work on mobile)
- No avatar or initial circle next to messages
- The "GREEN ROOM" sub-header takes a full row for a label the tab already implies
- Empty state is a cryptic `(~)` glyph
- No message grouping — consecutive messages from the same player repeat the name header each time

**DM issues**:
- Thread list and message view are solid but need polish as game-specific DM channels arrive
- Silver transfer UI is inline but could be more discoverable
- No visual distinction between regular DMs, group DMs, and upcoming game DMs

**Proposed fixes**:
- Add sender initial circles to other players' messages (consistent with roster avatars)
- Show timestamps inline (small, below the bubble) — always visible, not hover-only
- Group consecutive messages from the same sender (show name once, stack bubbles)
- Remove the "GREEN ROOM" sub-header — the active tab already provides context
- Improve empty state with something thematic ("The room is quiet... for now")
- Prepare DM thread list for channel-type badges (DM vs GROUP_DM vs GAME_DM)

**Status**: [x] Done — Timeline has avatars, always-visible timestamps, message grouping. DMs merged into People tab with per-player detail views.

---

### 5. Debug bar leaks into player UI

**Severity**: Medium
**File**: `NewsTicker.tsx:31-38`

The debug strip shows raw state machine paths like `L2: DAYLOOP.ACTIVESESSION.RUNNING · VOTE: MAJORITY`. It renders whenever `debugTicker` is truthy.

**Problems**:
- Exposes internal implementation details to players
- Takes ~20px of already-scarce vertical space
- Green monospace text on black doesn't match the design language

**Proposed fix**:
- Gate behind `import.meta.env.DEV` or a `?debug` query param
- Never render in production builds

**Status**: [x] Done — already gated behind `import.meta.env.DEV`.

---

### 6. News ticker — reposition or absorb into timeline

**Severity**: Medium
**File**: `App.tsx:416`, `NewsTicker.tsx`

The ticker currently renders below the footer tabs, competing with system navigation on phones. With the timeline model (issue #0), ticker content (game events, phase transitions) becomes system event entries in the timeline itself.

**Options**:
- **Remove ticker entirely** — its content lives in the timeline now. Saves ~40px of chrome.
- **Keep as ambient flavor bar** above the footer tabs, but only for "breaking" events (eliminations, winner declared). Move it above tabs so it doesn't fight the OS gesture bar.
- **Hybrid** — ticker only appears when the player is NOT on the Timeline tab (i.e., browsing DMs or Roster) as a notification that something happened in the main feed.

**Status**: [x] Done — ticker bar hidden (commit 78c6478). Component kept for potential future use.

---

### 7. No visual distinction for eliminated players in roster

**Severity**: Low
**File**: `App.tsx:231-262` (RosterRow)

Eliminated players show their status as text ("ELIMINATED") but have the same visual treatment as alive players. In a game about social elimination, this should be more dramatic.

**Proposed fix**:
- Grey out / reduce opacity for eliminated players
- Add a skull icon or strikethrough on the name
- Sort eliminated players below alive ones

**Status**: [x] Done in PeopleList — sorted, dimmed, labeled. Desktop sidebar RosterRow still basic.

---

### 8. Mobile tab bar has no unread indicator for COMMS

**Severity**: Low
**File**: `App.tsx:385-413`

DMs tab shows a pink badge dot when there are unread DMs. The COMMS tab has no equivalent — if you're on the DMs or Roster tab, you won't know new main chat messages arrived.

**Proposed fix**:
- Track `lastSeenMainChatIndex` in store
- Show a gold badge dot on the COMMS tab when new messages exist

**Status**: [ ] Tabled for now

---

### 9. Silver wallet icon uses wrong color

**Severity**: Low
**Files**: `App.tsx:299`, `RosterRow:258`, `PerkPanel.tsx:197`

The Coins icon uses `className="text-gray-300"` — a hardcoded gray that doesn't respond to the theme system. Everything else uses `skin-*` tokens.

**Proposed fix**:
- Replace `text-gray-300` with `text-skin-dim` or `text-skin-gold/60` to stay in the design system

**Status**: [x] Done — all Coins icons use `text-skin-dim`.

---

### 10. Input area uses absolute positioning

**Severity**: Low
**File**: `ChatRoom.tsx:176`

The chat input is `absolute bottom-0` with the message list using `pb-20` to compensate. This works but is fragile — any change to input height (typing indicator, "chat closed" banner) can cause overlap.

**Proposed fix**:
- Switch to flex layout: messages area `flex-1 overflow-y-auto` above a `shrink-0` input section
- Removes the need for magic `pb-20` padding

**Status**: [x] Done — TimelineInput uses flex `shrink-0` layout.

---

## Priority Order

### Tier 0 — The Timeline (foundational; reshapes everything)

| # | Issue | Description | Effort |
|---|-------|-------------|--------|
| 0 | Unified Timeline view | Replace Green Room + stacked panels with single chronological feed | Large |

This is the architectural shift. Issues #2, #4, #5, #6 are partially or fully absorbed by this work:
- #2 (Game History) → eliminated, timeline has persistent result cards
- #4 (Chat polish) → avatars, timestamps, grouping built into timeline renderer from the start
- #5 (Debug bar) → phase transitions visible as timeline milestones; debug bar gated to dev
- #6 (Ticker) → content absorbed as system events; bar repositioned or removed

### Tier 1 — Chrome & Navigation (do alongside or after timeline)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | Header declutter | High | Small |
| 2 | Relocate Perks panel | High | Small |
| 3 | Remove/gate admin FAB | High | Small |

### Tier 2 — Polish (after layout stabilizes)

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 10 | Chat input flex layout (absorbed into timeline build) | Low | — |
| 9 | Fix coin icon colors | Low | Tiny |
| 7 | Eliminated player styling | Low | Small |
| 8 | Unread indicator for Timeline tab | Low | Small |

---

## Out of Scope (for now)

- Desktop layout redesign (sidebar, two-panel) — desktop works reasonably well
- Dark/light theme toggle — single dark theme is the brand identity
- Animations overhaul — existing animations are solid
- New features (emoji reactions, read receipts, etc.) — separate feature work
