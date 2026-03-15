# ChatInput Polish — Design

## Context

The ChatInput composer in the Vivid shell needs several UX improvements for mobile gameplay. Silver balance changes lack drama, the DM character counter is too subtle and easily mistaken for a per-message limit, contextual action layouts overflow on small screens, and the X (close) button is redundant since toolbar icons already toggle.

## Changes

### 1. Silver Badge AnimatedCounter

Wrap the silver balance badge on the $ toolbar button with `AnimatedCounter`. On silver decrease: particle burst + shake + scale + color flash. On increase: gentle scale bounce + gold flash. Reuses the existing `AnimatedCounter` component — no new animation code needed.

### 2. DM Character Counter — Toolbar Icon + Helper Text Toggle

Add a new "capability-style" icon to the toolbar row (leftmost position, before $ and invite icons). Shows a small badge with remaining daily chars.

**Behavior**: Clicking the icon toggles a new `CHAR_INFO` capability mode:
- Stashes any current `inputValue` text
- Replaces the input area with helper text: *"847 of 1200 characters remaining today for all DMs"*
- Number colored by threshold: normal → amber (< 30%) → red (< 15%)
- Clicking the icon again restores the stashed text and returns to normal input mode
- Only renders in DM/group context (not stage chat)

**Icon**: `ChatRound` or `Document` from Solar icons with a mono badge overlay showing the remaining count.

### 3. Remove X (Close) Button

Delete the `CloseCircle` cancel button that appears when a capability is active. The toolbar icons are already toggles — tapping the active icon dismisses it. This saves ~24px horizontal space in the input row.

### 4. Silver Transfer Row — Avatar, Drop Name Text

Current: `Send [1] [2] [5] [10] silver to {targetName}`
New: `Send [1] [2] [5] [10] [avatar]`

- Drop "silver to {name}" suffix — gold accent border + active $ icon provides context
- Add target's `PersonaAvatar` (20px) at the end of the row to reinforce who you're sending to
- Horizontal flex, single row. Fits ~220px on a 300px content area

### 5. Invite Players Row — First Name + Avatar Chips

Current: Full `personaName` per chip, no max-width, can overflow.
New: `Invite [av FirstName] [av FirstName] ...`

- Extract first name: `personaName.split(' ')[0]`
- Each chip: 20px `PersonaAvatar` + first name (~80px total per chip)
- Wrapping flex with `gap: 6px`, fits 3 chips/row on 300px width
- 6 players = 2 rows, no truncation needed
- Selected chip: solid teal bg + white text. Unselected: light teal bg + teal text

### 6. Stable Input Width

The send button (38px circle) is always fixed at the right edge of the input row. The content area is always `flex: 1`. Removing the X button means no elements appear/disappear that could shift the send button. AnimatePresence `mode="wait"` handles smooth content swaps.

## Files

| File | Action | Purpose |
|------|--------|---------|
| `apps/client/.../ChatInput.tsx` | MODIFY | All changes: AnimatedCounter badge, char counter icon + helper toggle, remove X button, silver row avatar, invite first-name chips, stable layout |
| `apps/client/.../AnimatedCounter.tsx` | READ | Existing component, no changes needed |

## Testing

- Create a 5-6 player game via `/create-game`
- Open DM with a player → verify:
  - Char counter icon in toolbar with badge
  - Tapping char icon shows helper text, tapping again restores draft
  - Silver $ toggle shows `Send [1] [2] [5] [10] [avatar]`, no X button
  - Sending silver triggers AnimatedCounter particle burst on badge
  - Invite toggle shows first-name + avatar chips in wrapping flex
  - Send button never shifts position
- Open Stage chat → verify no char counter icon (no dmStats)
