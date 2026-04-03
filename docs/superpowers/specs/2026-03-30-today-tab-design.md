# Today Tab — Cartridge Relocation & Lifecycle Fix

**Date:** 2026-03-30
**Status:** Draft
**Related Issues:** #113, #72, #70, #2, #6, #16, #24, #32, #34, #36, #58, #61, #83, #86, #88, #89, #90

## Problem

Two interrelated problems:

1. **Chat tab clutter:** Cartridges (games, voting, prompts, dilemmas) render inline in the chat timeline, competing with messages for screen real estate on mobile. Multiple simultaneous cartridges make the chat unusable.

2. **Results vanish instantly:** When a cartridge completes, the server immediately stops the child actor and nulls the ref. The next SYNC delivers `null` to the client, so results never render. This is the root cause of #113 and #72.

## Solution

**Hybrid approach:** Relocate all cartridge rendering from the chat tab to a renamed "Today" tab (formerly "Schedule"), and delay server-side cartridge cleanup so results persist until the day ends.

- **Intro/upcoming cards:** Client-only, derived from manifest schedule data
- **Live interaction:** Fullscreen takeover from the Today tab
- **Results:** Server holds cartridge actor alive in results state; client renders the cartridge component in its results mode
- **Chat tab:** Pure messaging with lightweight system messages for cartridge events
- **BroadcastBar:** Replaced with compact Activity Status Strip

## Design

### Today Tab — Card Stack

The tab displays a vertical stack of fixed-layout cards, one per cartridge scheduled for the day. No scrolling in the default (collapsed) state.

**Card states:**

| State | Visual | Tap Action |
|-------|--------|------------|
| **Upcoming** | Muted/subdued, cartridge type icon, name, countdown ("Starts in 2h 15m"), tutorial text from type registry | No action (not interactive yet) |
| **Live** | Gold accent border + glow, LIVE badge, countdown, prominent CTA button | Opens fullscreen takeover |
| **Completed** | Checkmark icon, one-line result summary (e.g., "Diana eliminated", "+15 Silver") | Opens fullscreen takeover in results mode |

**Card order:** Chronological top-to-bottom. Completed cards at top, live in middle, upcoming at bottom.

**Data sources:**
- Upcoming cards: `manifest.days[dayIndex].timeline` — schedule data the client already has
- Live cards: `activeVotingCartridge`, `activeGameCartridge`, `activePromptCartridge`, `activeDilemma` from SYNC
- Completed cards: same SYNC fields — cartridge actor stays alive in results state (see Server Changes)

### Fullscreen Takeover

Tapping a live CTA or a completed card opens the cartridge in a fullscreen overlay:

- **Header:** X dismiss button, cartridge name, live countdown (if playing)
- **Body:** The actual cartridge component (`MajorityVoting`, `Sequence`, `HotTakePrompt`, etc.) — same components as today, unmoved
- **Tab bar hidden** during fullscreen
- **Dismiss:** X button or swipe down returns to Today tab
- **Auto-close:** When a live cartridge completes server-side, fullscreen dismisses and card transitions to Completed state
- **Re-entry:** Player can dismiss and return to a live cartridge anytime via the CTA

The cartridge components already handle both interactive and results rendering based on their internal phase (e.g., `VotingPhases.REVEAL`, `phase: 'RESULTS'`). No separate result components needed.

### Activity Status Strip (BroadcastBar Replacement)

Replaces the scrolling marquee ticker. Compact, single-line strip at the top of all tabs.

**Layout:** `[Bell icon] | [DAY N] | [Live pills...] | [Next up hint] [›]`

**Tap targets:**
- Bell icon → opens notifications/dashboard panel (preserves current BroadcastBar onClick behavior)
- Everything else → switches to Today tab

**Scenarios:**
- **One live cartridge:** `[Bell] | DAY 3 | [● Voting 4:32] | Sequence in 1h ›`
- **Two live cartridges:** `[Bell] | DAY 3 | [● Voting 4:32] [● Dilemma 12:00] | ›`
- **Nothing live:** `[Bell] | DAY 3 | Social Hour | Voting in 45m ›`

**Bell icon:** Shows red badge with unread count when notifications exist. Muted with no badge when empty.

### Chat Timeline Changes

- Remove cartridge entry types (`voting`, `game`, `prompt`, `dilemma`) from `useTimeline()`
- Inject lightweight system messages when cartridge events occur:
  - "Voting has started" / "Voting complete — Diana was eliminated"
  - "Game Time: Sequence" / "Sequence complete — see results in Today"
  - "New dilemma: Silver Gambit" / "Dilemma resolved"
- System messages are non-interactive — just contextual markers in the chat flow
- Generated client-side from state transitions (cartridge appearing/disappearing in SYNC), not server-originated ticker messages

### Tab Bar

- Rename "Schedule" → "Today"
- Badge on Today tab when there's an active live cartridge the player hasn't interacted with

## Server Changes

### L3 Cartridge Lifecycle — Result Hold

**Current flow:**
```
cartridge completes → xstate.done.actor → applyRewards + forwardResultToL2 → cleanupCartridge (stopChild + null ref) → SYNC → client sees null
```

**New flow:**
```
cartridge completes → xstate.done.actor → applyRewards + forwardResultToL2 → actor stays alive in results state → SYNC → client sees results
                                                                             ↓
                                                           cleanup when: day ends OR next same-type cartridge spawns
```

**Changes to L3 machine (`l3-session.ts`):**
- Remove `cleanupXxxCartridge` from `xstate.done.actor.*` transition actions
- Add cleanup to day-end teardown (when L3 session completes)
- Add cleanup to spawn actions: when spawning a new cartridge of the same type, stop the previous one first

**Changes to cartridge machines:**
- Ensure `results`/`REVEAL` is a proper holding state (not a transient/final state that triggers `xstate.done`)
- Most already have this (`VotingPhases.REVEAL`, `phase: 'RESULTS'`, `DilemmaPhases.REVEAL`)
- Verify all voting, prompt, and dilemma machines hold in results state

**No changes to `sync.ts`:** Already reads child snapshots by name — will continue to work as cartridge actors stay alive longer.

**Snapshot persistence:** Cartridge actors in results state will be included in DO snapshots. This increases snapshot size slightly but is bounded (at most 4 actors per day — one of each type). The actors are in terminal states with no pending timers.

### Arcade Game Results Mode — All-Player Leaderboard

9 arcade games currently show individual scores only: Aim Trainer, Color Match, Gap Run, Grid Push, Quick Math, Reaction Time, Sequence, Simon Says, Stacker.

These need a results mode enhancement to show an all-player leaderboard alongside individual performance. The server machine output already includes `silverRewards` (Record<string, number>) for all games.

**Enhancement:**
- Add a leaderboard view to the `ArcadeGameWrapper` results breakdown showing all players ranked by score/silver earned
- The wrapper already receives `roster` — it has player names and avatars
- Use `silverRewards` from game output as the ranking metric
- Keep individual breakdown visible below the leaderboard (existing `renderBreakdown` callback)

7 games already have all-player views: Bet Bet Bet, Blind Auction, King's Ransom, Realtime Trivia, Touch Screen, Trivia, The Split. These need no changes.

## Files Changed

| Layer | File(s) | Change |
|-------|---------|--------|
| L3 machine | `l3-session.ts` | Remove cleanup from `xstate.done` transitions, add to day-end/new-spawn |
| L3 actions | `l3-voting.ts`, `l3-games.ts`, `l3-activity.ts`, `l3-dilemma.ts` | Adjust cleanup triggers |
| Cartridge machines | Various voting/prompt/dilemma machines | Verify results state holds (not final) |
| Arcade wrapper | `ArcadeGameWrapper.tsx` (or equivalent) | Add all-player leaderboard to results mode |
| Client store | `useGameStore.ts` | Distinguish playing vs results state in cartridge fields |
| Today tab | New `TodayTab.tsx` replacing `ScheduleTab.tsx` | Card stack + fullscreen takeover container |
| BroadcastBar | `BroadcastBar.tsx` | Rewrite as Activity Status Strip with bell icon |
| Chat timeline | `useTimeline.ts` | Remove cartridge entry types |
| Chat system msgs | `StageChat.tsx` or `useTimeline.ts` | Inject system messages for cartridge events |
| Tab bar | `TabBar.tsx` | Rename "Schedule" → "Today", add live badge |
| Shell | `VividShell.tsx` | Update tab type, wire fullscreen takeover overlay |

## Out of Scope

- Full server-side lifecycle rewrite (spawning cartridges at day start in intro state) — future enhancement if needed
- Cross-day result history (viewing previous days' results)
- Classic and Immersive shell updates (Vivid shell only for now)
- Push notification deep-linking to Today tab (#61)

## Phasing

**Phase 1 — Server: Result Hold**
- Modify L3 cleanup triggers
- Verify cartridge machines hold in results state
- Test snapshot persistence with held actors

**Phase 2 — Client: Today Tab + Fullscreen Takeover**
- Build TodayTab card stack
- Build fullscreen takeover container
- Wire cartridge components into takeover
- Remove cartridge entries from chat timeline
- Add system messages to chat

**Phase 3 — Client: Activity Status Strip**
- Rewrite BroadcastBar as status strip
- Add bell icon with notification badge
- Wire tap targets (bell → notifications, rest → Today tab)

**Phase 4 — Arcade Leaderboards**
- Enhance 9 arcade games with all-player results mode
- Add leaderboard to ArcadeGameWrapper

## Mockups

Visual companion mockups saved in `.superpowers/brainstorm/` (session 45240-1774899101):
- `today-tab-cards.html` — Card stack with three states
- `today-tab-expanded.html` — Expanded results (superseded by fullscreen approach)
- `fullscreen-takeover.html` — Three-step interaction flow
- `broadcast-bar-v2.html` — Activity Status Strip with bell icon
