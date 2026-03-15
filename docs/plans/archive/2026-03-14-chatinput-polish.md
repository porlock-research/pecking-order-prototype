# ChatInput Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish the ChatInput composer with dramatic silver animations, a proper daily char counter, cleaner contextual action layouts, and persona-reinforcing avatar chips.

**Architecture:** All changes are in `ChatInput.tsx`. The existing `AnimatedCounter` component handles silver badge animation. New `CHAR_INFO` capability mode toggles helper text. Invite chips use first name + avatar. No X button — toolbar icons toggle themselves.

**Tech Stack:** React 19, Framer Motion, @solar-icons/react, Zustand store

---

### Task 1: Remove X (Close) button and inline char counter

Remove the `CloseCircle` cancel button (lines 677-700) that appears when a capability is active — the toolbar icons already toggle. Also remove the inline char counter from the text input area (lines 499-520) since it's moving to the toolbar.

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`

**Step 1: Remove the cancel button block**

Delete lines 677-700 (the `{activeCapability !== null && (` block with `CloseCircle`).

**Step 2: Remove inline char counter**

Delete lines 499-520 (the `{(context === 'dm' || context === 'group') && dmStats && inputValue.length > 0 && (() => {` block).

**Step 3: Clean up unused import**

Change import line 3 from:
```tsx
import { Plain, CloseCircle, Dollar, UserPlus } from '@solar-icons/react';
```
to:
```tsx
import { Plain, Dollar, UserPlus, FileText } from '@solar-icons/react';
```

(`CloseCircle` removed, `FileText` added for char counter icon in next task.)

**Step 4: Build and verify**

Run: `cd apps/client && npx vite build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add apps/client/src/shells/vivid/components/ChatInput.tsx
git commit -m "refactor(vivid): remove X button and inline char counter from ChatInput"
```

---

### Task 2: Add AnimatedCounter to silver badge

Replace the static `{myBalance}` in the silver toolbar badge with the `AnimatedCounter` component for dramatic particle burst + shake on silver decrease.

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`

**Step 1: Add AnimatedCounter import**

Add to existing imports:
```tsx
import { AnimatedCounter } from './AnimatedCounter';
```

**Step 2: Replace static badge content**

Find the silver balance badge `<span>` (the one with `position: 'absolute', top: -2, right: -4`). Replace its child `{myBalance}` with:

```tsx
<AnimatedCounter
  value={myBalance}
  style={{
    fontFamily: 'var(--vivid-font-mono)',
    fontSize: 9,
    fontWeight: 800,
    color: '#FFFFFF',
  }}
  decreaseColor="#D94073"
  increaseColor="#D4960A"
/>
```

Remove the duplicate font/color styles from the parent `<span>` since `AnimatedCounter` handles them. The parent span keeps only its positioning/layout styles:

```tsx
<span
  style={{
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    background: '#D4960A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
    lineHeight: 1,
    overflow: 'visible',
  }}
>
  <AnimatedCounter
    value={myBalance}
    style={{
      fontFamily: 'var(--vivid-font-mono)',
      fontSize: 9,
      fontWeight: 800,
      color: '#FFFFFF',
    }}
    decreaseColor="#D94073"
    increaseColor="#D4960A"
  />
</span>
```

**Step 3: Build and verify**

Run: `cd apps/client && npx vite build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/client/src/shells/vivid/components/ChatInput.tsx
git commit -m "feat(vivid): animated silver badge with particle burst on decrease"
```

---

### Task 3: Add char counter toolbar icon with CHAR_INFO capability

Add a new toolbar icon (leftmost position) that shows remaining daily chars as a badge. Clicking toggles a `CHAR_INFO` mode that shows helper text in the input area.

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`

**Step 1: Extend ActiveCapability type**

Change:
```tsx
type ActiveCapability = 'SILVER_TRANSFER' | 'INVITE_MEMBER' | null;
```
to:
```tsx
type ActiveCapability = 'SILVER_TRANSFER' | 'INVITE_MEMBER' | 'CHAR_INFO' | null;
```

**Step 2: Add stashed text state**

Add new state for stashing input text when toggling CHAR_INFO:
```tsx
const [stashedInput, setStashedInput] = useState<string | null>(null);
```

**Step 3: Compute char counter values**

After the `myBalance` line, add:
```tsx
// Char counter for DM/group
const isDmContext = context === 'dm' || context === 'group';
const charsRemaining = isDmContext && dmStats
  ? Math.max(0, (dmStats.charsLimit ?? 0) - (dmStats.charsUsed ?? 0))
  : null;
const charsLimit = dmStats?.charsLimit ?? 0;
const charsRatio = charsLimit > 0 && charsRemaining !== null ? charsRemaining / charsLimit : 1;
const charsColor = charsRatio < 0.15 ? '#D94073' : charsRatio < 0.3 ? '#D4960A' : 'var(--vivid-text-dim)';
const hasCharCounter = isDmContext && charsRemaining !== null;
```

**Step 4: Update hasToolbar**

Change:
```tsx
const hasToolbar = hasSilver || hasInvite;
```
to:
```tsx
const hasToolbar = hasSilver || hasInvite || hasCharCounter;
```

**Step 5: Update toggleCapability for CHAR_INFO stash/restore**

Replace the `toggleCapability` function:
```tsx
const toggleCapability = (cap: ActiveCapability) => {
  if (activeCapability === cap) {
    // Toggling off — restore stashed input if coming from CHAR_INFO
    if (cap === 'CHAR_INFO' && stashedInput !== null) {
      setInputValue(stashedInput);
      setStashedInput(null);
    }
    setActiveCapability(null);
    setSelectedInvitee(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  } else {
    // Toggling on — stash current input if entering CHAR_INFO
    if (cap === 'CHAR_INFO') {
      setStashedInput(inputValue);
    } else if (activeCapability === 'CHAR_INFO' && stashedInput !== null) {
      // Switching from CHAR_INFO to another cap — restore first
      setInputValue(stashedInput);
      setStashedInput(null);
    }
    setActiveCapability(cap);
    setSelectedInvitee(null);
    if (cap === 'SILVER_TRANSFER') setSilverAmount(5);
  }
};
```

**Step 6: Update canSend to handle CHAR_INFO**

Change the `canSend` computation to also return false for CHAR_INFO (it's informational, not sendable):
```tsx
const canSend =
  activeCapability === 'SILVER_TRANSFER'
    ? silverAmount > 0 && silverAmount <= myBalance && !!targetId
    : activeCapability === 'INVITE_MEMBER'
      ? !!selectedInvitee && !!channelId
      : activeCapability === 'CHAR_INFO'
        ? false
        : !!inputValue.trim();
```

**Step 7: Update containerBorderColor**

Add CHAR_INFO accent:
```tsx
const containerBorderColor =
  activeCapability === 'SILVER_TRANSFER'
    ? 'rgba(196, 154, 32, 0.35)'
    : activeCapability === 'INVITE_MEMBER'
      ? 'rgba(59, 169, 156, 0.35)'
      : activeCapability === 'CHAR_INFO'
        ? 'rgba(139, 115, 85, 0.2)'
        : undefined;
```

**Step 8: Add CHAR_INFO content in AnimatePresence**

After the invite member mode block (the `{activeCapability === 'INVITE_MEMBER' && (` block) and before the closing `</AnimatePresence>`, add:

```tsx
{/* Char info mode */}
{activeCapability === 'CHAR_INFO' && (
  <motion.div
    key="char-info"
    style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.15 }}
  >
    <span style={{
      fontSize: 14,
      fontFamily: 'var(--vivid-font-body)',
      color: 'var(--vivid-text-dim)',
      fontStyle: 'italic',
    }}>
      <span style={{
        fontFamily: 'var(--vivid-font-mono)',
        fontWeight: 700,
        fontStyle: 'normal',
        color: charsColor,
      }}>
        {charsRemaining}
      </span>
      {' of '}
      <span style={{
        fontFamily: 'var(--vivid-font-mono)',
        fontWeight: 700,
        fontStyle: 'normal',
      }}>
        {charsLimit}
      </span>
      {' chars remaining today'}
    </span>
  </motion.div>
)}
```

**Step 9: Add char counter icon in toolbar row**

In the toolbar `<div>` (the `{hasToolbar && (` block), add the char counter icon **before** the silver icon:

```tsx
{hasCharCounter && (
  <motion.button
    type="button"
    onClick={() => toggleCapability('CHAR_INFO')}
    disabled={isDisabled}
    style={{
      width: 36,
      height: 36,
      borderRadius: 10,
      background: activeCapability === 'CHAR_INFO'
        ? 'rgba(139, 115, 85, 0.1)'
        : 'transparent',
      border: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: activeCapability === 'CHAR_INFO'
        ? 'var(--vivid-text)'
        : 'var(--vivid-text-dim)',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      padding: 0,
      position: 'relative',
    }}
    whileTap={!isDisabled ? VIVID_TAP.button : undefined}
  >
    <FileText size={20} weight="Bold" />
    {/* Chars remaining badge */}
    <span
      style={{
        position: 'absolute',
        top: -2,
        right: -6,
        minWidth: 18,
        height: 14,
        borderRadius: 7,
        background: charsRatio < 0.15 ? '#D94073' : charsRatio < 0.3 ? '#D4960A' : 'rgba(139, 115, 85, 0.5)',
        color: '#FFFFFF',
        fontFamily: 'var(--vivid-font-mono)',
        fontSize: 8,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3px',
        lineHeight: 1,
      }}
    >
      {charsRemaining}
    </span>
  </motion.button>
)}
```

**Step 10: Build and verify**

Run: `cd apps/client && npx vite build`
Expected: Build succeeds.

**Step 11: Commit**

```bash
git add apps/client/src/shells/vivid/components/ChatInput.tsx
git commit -m "feat(vivid): char counter toolbar icon with CHAR_INFO helper toggle"
```

---

### Task 4: Silver transfer row — avatar, drop name text

Replace the trailing "silver to {name}" text with the target's `PersonaAvatar` for a cleaner, more compact silver transfer row.

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`

**Step 1: Replace silver transfer content area**

Find the silver transfer mode `<motion.div key="silver">`. Replace its children with:

```tsx
<span style={{ ...CANNED_TEXT, color: '#C49A20' }}>Send</span>
{SILVER_AMOUNTS.map(amt => (
  <motion.button
    key={amt}
    type="button"
    onClick={() => setSilverAmount(amt)}
    disabled={amt > myBalance}
    style={{
      padding: '2px 10px',
      borderRadius: 10,
      background: amt === silverAmount
        ? '#C49A20'
        : 'rgba(196, 154, 32, 0.1)',
      color: amt === silverAmount ? '#FFFFFF' : '#C49A20',
      border: 'none',
      fontWeight: 700,
      fontSize: 14,
      fontFamily: 'var(--vivid-font-display)',
      cursor: amt > myBalance ? 'not-allowed' : 'pointer',
      opacity: amt > myBalance ? 0.3 : 1,
      lineHeight: '22px',
    }}
    whileTap={amt <= myBalance ? VIVID_TAP.button : undefined}
  >
    {amt}
  </motion.button>
))}
{/* Target avatar */}
{targetId && (
  <PersonaAvatar
    avatarUrl={roster[targetId]?.avatarUrl}
    personaName={roster[targetId]?.personaName}
    size={22}
  />
)}
```

This replaces the `<span style={CANNED_TEXT}>silver{targetName ? ` to ${targetName}` : ''}</span>` with a 22px avatar.

**Step 2: Build and verify**

Run: `cd apps/client && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/ChatInput.tsx
git commit -m "feat(vivid): silver transfer row shows target avatar instead of name text"
```

---

### Task 5: Invite row — first name + avatar chips

Replace full `personaName` in invite chips with first name only, keeping the avatar. This makes chips ~80px instead of ~140px, fitting 3 per row on mobile.

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`

**Step 1: Update invite chip content**

Find the invite member `eligible.map` block. Change `{player.personaName}` to `{player.personaName.split(' ')[0]}` inside each chip button.

The chip button JSX becomes:
```tsx
{eligible.map(([pid, player]) => (
  <motion.button
    key={pid}
    type="button"
    onClick={() => setSelectedInvitee(
      selectedInvitee === pid ? null : pid
    )}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 10px 2px 4px',
      borderRadius: 9999,
      background: pid === selectedInvitee
        ? '#3BA99C'
        : 'rgba(59, 169, 156, 0.1)',
      color: pid === selectedInvitee ? '#FFFFFF' : '#3BA99C',
      border: 'none',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'var(--vivid-font-display)',
      cursor: 'pointer',
      lineHeight: '22px',
    }}
    whileTap={VIVID_TAP.button}
  >
    <PersonaAvatar
      avatarUrl={player.avatarUrl}
      personaName={player.personaName}
      size={20}
    />
    {player.personaName.split(' ')[0]}
  </motion.button>
))}
```

**Step 2: Build and verify**

Run: `cd apps/client && npx vite build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/ChatInput.tsx
git commit -m "feat(vivid): invite chips use first name + avatar for compact mobile layout"
```

---

### Task 6: Create test game and visual verification

Create a 5-6 player game to test all changes on a mobile viewport.

**Step 1: Create test game**

Use the `/create-game` skill with 5-6 players.

**Step 2: Open player tabs and verify**

Open DM between two players. Verify:
- [ ] Char counter icon appears leftmost in toolbar with badge showing remaining chars
- [ ] Tapping char icon shows helper text ("X of Y chars remaining today"), tapping again restores any draft text
- [ ] Silver $ icon shows AnimatedCounter badge — send silver and verify particle burst + shake on decrease
- [ ] Silver transfer row shows `Send [1] [2] [5] [10] [avatar]` — no name text, no X button
- [ ] Invite toggle shows first-name + avatar chips in wrapping flex
- [ ] Send button never shifts position across all modes
- [ ] Stage chat has no char counter icon (no dmStats on main channel)

**Step 3: Commit any fixes**

If visual issues found, fix and commit.

---

### Task 7: Final build verification

**Step 1: Full build**

Run: `npm run build`
Expected: All packages build successfully.

**Step 2: Commit and done**

All changes committed in Tasks 1-6.
