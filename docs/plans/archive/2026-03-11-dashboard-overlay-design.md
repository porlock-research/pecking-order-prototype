# Dashboard Overlay — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2026-03-11
**Branch:** `feature/user-friendliness`
**Status:** Approved

## Goal

Replace the scattered game-state surfaces in the Vivid shell (completed phase cards in chat, missing schedule visibility, no mechanic explainers) with a single **Dashboard Overlay** — an ephemeral, always-accessible panel that slides down from the top. It serves as mission control: schedule, explainers, results, and day context in one place.

## Problems Solved

| Issue | How the dashboard addresses it |
|-------|-------------------------------|
| BUG-005 — Completed phase cards lack polish | Results render as evolved timeline cards in the dashboard, not in chat |
| BUG-015a — No voting explainer | `VOTE_TYPE_INFO` explainers shown on upcoming/active timeline events |
| PT1-UX-007 — No rules/onboarding | Welcome card (Day 0) + contextual explainers on every event |
| PT1-UX-010 — "When does the vote end?" | Full day schedule with times visible at a glance |
| BUG-015c — Player activity not surfaced | Ticker/marquee handles this (existing infrastructure, separate concern) |

## Out of Scope

- Economy explainer (BUG-015b) — separate tap-on-balance interaction
- Full onboarding/tutorial strategy — future work, dashboard is a foundation
- Actionable DM invites in dashboard — Whispers tab handles this
- Cast tab layout (DEMO-006) — separate issue

---

## Architecture

### Interaction Model

**Ephemeral overlay** (Approach A) — a `motion.div` that slides down from behind the BroadcastBar. Semi-transparent dark backdrop with blur. Covers ~85vh, leaving the tab bar peeking below. Dismisses on header tap, swipe up, or backdrop tap.

This is NOT a tab or a route — it's a lightweight, always-accessible surface like a notification shade. Content lazy-renders on open.

### Triggering

| Trigger | Mechanism |
|---------|-----------|
| Header tap | `BroadcastBar` onClick → `toggleDashboard()` |
| Swipe down | Global gesture on shell container (top-edge pull) |
| Programmatic | Any component calls `openDashboard()` via Zustand |
| Splash → dashboard | PhaseTransitionSplash crossfades into dashboard on **first view of the day only** |
| Push notification landing | Day transition handler auto-opens if `dashboardSeenForDay !== dayIndex` |

### Dismiss

- Header tap (toggle)
- Swipe up on overlay (when scrolled to top)
- Tap backdrop below overlay content

### Gesture Details (Mobile UX)

- Swipe-to-dismiss only activates when overlay content is scrolled to top — otherwise normal scroll takes priority (iOS notification center pattern)
- All tap targets ≥ 44px
- Full-width cards with 16px horizontal padding
- No hover-dependent interactions
- Safe area insets respected (`env(safe-area-inset-top)`)
- Thumb-zone aware: any future action buttons go at bottom, not top

---

## Dashboard Content

Single scrollable page. Content evolves as the day progresses.

### 1. Welcome Card (Day 0 / first launch only)

"Welcome to Pecking Order" + 3-4 sentence game overview. Rendered at the top, above everything else. Dismissed permanently after first view (persisted flag).

### 2. Day Briefing

2-3 lines of contextual text generated from game state:
- "Day 2 of 5. 4 players remain. Today: Social Hour, then a Bubble Vote."
- Only renders when dashboard was auto-opened or it's the first view of the day.

### 3. Notification Badges (conditional)

Lightweight pill: "2 pending invites" — taps navigate to Whispers tab and close dashboard. Only renders when there are pending actions. Not actionable in-dashboard.

### 4. Day Timeline (main content)

Vertical list of the day's events. Each event is a **living card** that transitions through states:

#### Card States

**Upcoming:**
- Muted styling (lower opacity, subtle border)
- Event name + time on left
- Collapsible explainer on tap (from `VOTE_TYPE_INFO`, game type descriptions)
- ≥ 44px tap target for expand/collapse

**Active:**
- Phase accent border (`--vivid-phase-accent`)
- "LIVE" badge
- Brief status line
- Explainer still accessible

**Completed:**
- Explainer replaced/augmented by results summary
- Vote tallies, game scores, prompt winners
- Styled with glass morphism, accent-colored top border

#### Card Content by Event Type

| Event | Upcoming | Active | Completed |
|-------|----------|--------|-----------|
| Voting | `VOTE_TYPE_INFO[voteType].howItWorks` | "Voting is live — X votes cast" | Vote tallies, eliminated player |
| Game | Game type description, mechanics | "Game in progress" | Scores, silver rewards, winner |
| Prompt/Activity | Prompt type description | "Activity in progress" | Participation, results |
| Social (OPEN_DMS, OPEN_GROUP_CHAT) | "DMs open — X slots, Y chars/day" | Status indicators | N/A (no completion state) |

---

## Splash → Dashboard Transition

### Current Behavior

PhaseTransitionSplash renders full-screen → dramatic animation → auto-dismisses after ~3s → returns to chat. Fires on every phase transition.

### New Behavior

**Every phase transition:** Splash plays headline + contextual subtitle (phase-aware, 1-2 lines). Examples:
- Day 1 start: "WELCOME TO PECKING ORDER — Outwit. Outlast. Outspend."
- Day 2 start: "DAY 2 — THE BUBBLE — One vote could change everything"
- Voting opens: "VOTES ARE OPEN — Choose wisely"

**First view of the day only:** After splash animation (~2.5s), crossfade into dashboard overlay:
- Splash opacity fades to 0
- Dashboard slides down to open position simultaneously
- Net effect: dramatic moment → useful information, seamless
- Sets `dashboardSeenForDay = dayIndex`

**Subsequent phase transitions (same day):** Splash plays normally, auto-dismisses. No dashboard.

**Exceptions — splash does NOT open dashboard:**
- Elimination reveals (DramaticReveal) — pure drama
- Game over / winner declared — separate celebration flow

### Detection Logic

```
shouldOpenDashboard = (dashboardSeenForDay !== dayIndex)
```

Splash component checks this flag in its exit animation callback. If true, calls `openDashboard()` instead of simply unmounting.

---

## Visual Treatment

- **Backdrop:** semi-transparent dark (`rgba(0,0,0,0.6)`) + `backdrop-filter: blur(12px)`
- **Overlay panel:** dark glass background consistent with Vivid shell aesthetic
- **Cards:** glass morphism (dark translucent bg, subtle 1px borders, inner shadow)
- **Phase accent:** `--vivid-phase-accent` tints active event cards and LIVE badges
- **Typography:** Quicksand display font for headings, system font for body, 15-16px readable body text
- **Animations:** Framer Motion springs from `shells/vivid/springs.ts`
- **Max height:** ~85vh (BroadcastBar visible above, tab bar peeking below)

---

## Component Architecture

### New Components

| Component | Responsibility |
|-----------|---------------|
| `DashboardOverlay.tsx` | Overlay container — backdrop, motion sheet, scroll, gestures, mount/unmount |
| `DayTimeline.tsx` | Timeline list — maps manifest events to living cards, merges completed results |
| `TimelineEventCard.tsx` | Single event card — upcoming/active/completed states, collapsible explainer |
| `DayBriefing.tsx` | Contextual day summary text |

### Modified Components

| Component | Change |
|-----------|--------|
| `VividShell.tsx` | Render `DashboardOverlay` between tab content and modals |
| `BroadcastBar.tsx` | Add `onClick={toggleDashboard}`, visual indicator when dashboard is open |
| `PhaseTransitionSplash.tsx` | Add contextual subtitles, splash-to-dashboard crossfade logic |
| `useGameStore.ts` | Add dashboard state slice |

### Data Sources (all existing — no new fetching)

| Data | Source | Used for |
|------|--------|----------|
| Day schedule | `selectDayTimeline` → `manifest.days[dayIndex].timeline[]` | Timeline card list |
| Vote explainer | `VOTE_TYPE_INFO[voteType]` from `shared-types` | Upcoming/active voting card |
| Vote results | `completedCartridges` (kind: 'voting') | Completed voting card |
| Game results | `completedCartridges` (kind: 'game') | Completed game card |
| Prompt results | `completedCartridges` (kind: 'prompt') | Completed prompt card |
| Day context | `dayIndex`, `roster`, `manifest` | Day briefing text |
| Pending invites | `selectPendingChannels` | Notification badge count |
| Dashboard state | `dashboardOpen`, `dashboardSeenForDay` | Open/close, auto-expand |

### Zustand State Additions

```typescript
// Dashboard slice
dashboardOpen: boolean
dashboardSeenForDay: number | null
welcomeSeen: boolean          // persists across days, Day 0 welcome card

openDashboard: () => void
closeDashboard: () => void
toggleDashboard: () => void
```

### Render Order in VividShell

```
<div className="vivid-shell">
  <BroadcastBar onClick={toggleDashboard} />
  <TabContent />              {/* Stage / Whispers / Cast */}
  <TabBar />
  <DashboardOverlay />        {/* Above tabs, below modals */}
  <PlayerQuickSheet />
  <PhaseTransitionSplash />
  <DramaticReveal />
  <Toaster />
  <PwaGate />
</div>
```

---

## Stage Tab Cleanup

With completed phases living in the dashboard, the Stage tab becomes a clean chat surface:

- Remove the `completed-cartridge` case from StageChat (currently returns `null` anyway)
- Active cartridges (voting, games) **stay inline** in Stage — they need to be front-and-center
- Chat is the primary Stage content

---

## Event-to-Card Mapping

The `selectDayTimeline` selector returns raw manifest `TimelineEvent[]` (time + action). The dashboard needs to determine card state by cross-referencing with game state:

```
For each TimelineEvent in today's manifest:
  1. Match action to event type (OPEN_VOTING → voting, START_GAME → game, etc.)
  2. Check server state to determine card state:
     - If the event hasn't fired yet → UPCOMING
     - If the event is currently active → ACTIVE
     - If a completedCartridge exists for this event → COMPLETED
  3. For COMPLETED cards, merge the result snapshot from completedCartridges
```

Paired events (OPEN_VOTING / CLOSE_VOTING) collapse into a single card. The card shows the span and evolves through all three states.

---

## Testing Strategy

- **Unit:** TimelineEventCard renders correctly in all three states (upcoming/active/completed)
- **Unit:** DayTimeline correctly merges manifest events with completed cartridges
- **Unit:** Dashboard auto-open logic (dashboardSeenForDay flag)
- **Integration (Playwright):** Create game → verify dashboard auto-opens on first day → dismiss → verify it doesn't auto-open on next phase transition
- **Visual:** Screenshot tests for glass morphism, blur, and responsive layout
