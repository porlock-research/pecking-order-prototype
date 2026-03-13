# User Friendliness UX Overhaul — Design

**Goal:** Make the Vivid shell feel like a video game interface — clear, immediate, satisfying — not a cluttered app. Players should intuitively understand resource costs, game status, and what happened while they were away.

**Branch:** `feature/user-friendliness`

---

## 1. Main Chat Cleanup

The main stage becomes a **pure chat interface**. All non-chat timeline events (silver transfers, game results, activity results, system announcements like "DMs are now open") are removed from the chat scroll. These move to the Feed in the notifications panel.

**Chat bubbles:**
- Remove per-message timestamps entirely
- Add time separator dividers between message groups (e.g., "10 min ago", "2:34 PM")
- Increase message font size from 15px → 17px
- Increase sender name from 12px → 14px
- Time separators: 11px, uppercase, dimmed

**Chat input when closed (countdown timer):**
- Input becomes readonly with live-updating value: "Group chat opens in 02:14:32"
- Same for DMs: "DMs open in 01:45:10"
- ADMIN mode fallback (no scheduled timeline): "Group chat closed" / "DMs closed"
- BroadcastBar ticker also includes the countdown as a scrolling item

**Countdown data source:**
- PRE_SCHEDULED mode: find next `OPEN_GROUP_CHAT` / `OPEN_DMS` event in manifest timeline
- ADMIN mode: no timeline data → static fallback text
- `useCountdown(targetTimestamp)` hook returns formatted string or null

---

## 2. Notifications Panel (Dashboard Redesign)

**Entry point:**
- BroadcastBar tap opens the panel (same trigger as current dashboard)
- Unread indicator on BroadcastBar — small dot/badge when unseen feed events exist
- Chevron hint stays as "tap to open" affordance

**Read/unread tracking (simple):**
- Single `lastSeenFeedTimestamp` in Zustand store, persisted to localStorage
- Any feed event newer than this = unread
- Opening the panel sets timestamp to now
- No server-side state, no per-event tracking

**Panel layout (top to bottom):**

### 2a. Compact Progress Bar
- Horizontal day progress visualization
- Current phase highlighted, completed phases filled
- Phases as segments: Morning → Social → Game → Voting → Elimination
- Tap a completed segment to see its result

### 2b. Feed
- Chronological event stream, newest at top
- Event types: silver transfers, game/activity results (with full detail — scores, rankings), vote results, eliminations, phase transitions, DM invite events
- Each item: compact card with icon + description + relative time
- Unread items have subtle accent highlight that fades after viewing
- Cartridge results can expand to show detail

### 2c. "While You Were Away"
- When player loads and events happened since last sync, panel shows prominent unread badge
- Section header groups missed events under "While you were away"

### 2d. Rules (future, not this pass)

---

## 3. Resource Animations

### Silver Transfer (sender — big moment)
- Coin icon animates from send button, flies to silver counter near input
- Silver counter ticks down to new value
- ~400ms total

### Silver Received (receiver — HUD popup)
- Floating notification near top of screen: "Bella sent you 5 silver" with coin icon
- Stacks when multiple arrive (newest on top, older shift down)
- Auto-dismiss after ~3s
- Tapping opens notifications panel

### DM Send / Small Decrements
- Silver and char counters tick down with number change
- Particle sparkle effect at the counter
- For -1 changes: spring scale bounce (1.0 → 1.15 → 1.0) so change is noticeable
- ~200-300ms, fast and snappy

### Slot Used (accept DM invite)
- Spring bounce on slot counter in People tab header
- Brief color flash (green → neutral)

### Implementation
- Reusable `AnimatedCounter` component — detects value changes, triggers animation
- Coin fly via Framer Motion absolute-positioned motion element
- HUD popups: simple array in Zustand, auto-removed after timeout

---

## 4. Sizing Pass (~15% scale up)

| Element | Before | After |
|---------|--------|-------|
| Chat message text | 15px | 17px |
| Chat sender name | 12px | 14px |
| Chat input text | 15px | 17px |
| Stats row text | 11px | 12px |
| Presence strip avatars | 34px | 40px |
| People tab top 3 avatars | 48/42px | 56/48px |
| People tab other avatars | 38px | 44px |
| People tab name text | 14-15px | 16px |
| People tab silver amount | 12px | 14px |
| BroadcastBar ticker | 13px | 14px |
| Composer action icons | 16px | 20px |
| Send button icon | 16px | 20px |
| Send button size | 32px | 38px |
| Capability toolbar icons | 16px | 20px |
| Capability toolbar buttons | 30px | 36px |
| Time separator dividers | — | 11px, uppercase, dim |

---

## 5. Implementation Order

1. **Chat cleanup + timestamps** — Strip non-chat events from StageChat, remove per-message timestamps, add time separators, apply sizing
2. **Sizing pass** — Scale up text, avatars, icons across all components
3. **Countdown timers** — `useCountdown` hook, integrate into chat input and BroadcastBar
4. **Notifications panel** — Redesign dashboard into feed-first panel with progress bar
5. **Resource animations** — AnimatedCounter, coin fly, HUD popups, spring bounces
6. **Silver transfer relocation** — Move silver transfer results to feed, add receiver HUD popups
