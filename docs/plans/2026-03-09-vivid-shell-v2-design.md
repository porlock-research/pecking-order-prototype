# Vivid Shell v2 — "Live Broadcast" Redesign

## Concept

A radical redesign of the Vivid shell around the metaphor: **"You're a contestant on a live reality TV show."** The app feels like a live broadcast event — not a static chat app with games bolted on. The entire UI is phase-reactive, shifting mood, color, and energy with the game state.

Chat remains first-class (the primary gameplay IS conversation), but every surface is infused with broadcast drama: pulsing LIVE indicators, breaking-news elimination banners, phase-transition bumpers, and a color palette that breathes with the game's rhythm.

## What's Radically Different from Immersive

- **No chat bubbles** — Messages are full-width "Talk Show Panel" cards with player accent colors
- **No persona rail** — Player identity is embedded in every message card; player roster lives in the Cast tab
- **No CartridgeOverlay** — Voting/game/prompt cartridges render inline in the chat timeline
- **Phase-reactive theming** — The entire app shifts color/mood with game phases (not just a banner)
- **Live broadcast chrome** — Pulsing LIVE dot, breaking-news banners, phase transition splashes
- **Tab-based navigation** — Simple 3-tab bar (Stage/Whispers/Cast) vs. hidden space navigation
- **Player accent colors** — Each player has a unique color; their messages, cards, and profile all use it

## Navigation: Three-Tab Bottom Bar

**Stage | Whispers | Cast**

Always visible, pinned to bottom. Frosted glass strip with the phase gradient bleeding through. Active tab icon uses current phase accent color; inactive tabs are muted.

A 2px **phase gradient line** runs above the tab bar — animated, shifts color with game phase. The most persistent "live broadcast" signal.

### Top Bar (always visible, all tabs)

Compact single row:
- Left: Pulsing red "LIVE" dot + phase label (e.g. "DAY 2 — SOCIAL HOUR")
- Right: Silver count + Gold count (in monospace font)
- Background: subtle phase-reactive gradient, not flat

## Tab 1: Stage (Main Chat)

The primary screen. Chat-first, broadcast-flavored.

### Message Cards (Talk Show Panel style)

Full-width, no bubbles. Each message is a horizontal card:
- **Left edge**: 3px vertical accent bar in the player's unique color
- **Header line**: Avatar (32px) + player name (bold, in accent color) + timestamp (muted, right-aligned)
- **Body**: Message text below the name line, full width
- Cards have a subtle frosted background (rgba tint over the phase gradient)
- **Your own messages**: Same structure (no right-alignment), but get a subtle highlight tint

**Message grouping**: Consecutive messages from the same player within 2 minutes collapse — only the first shows avatar + name, subsequent ones just show text with the accent bar continuing.

### Broadcast Alerts (System Events)

NOT message cards. Full-width banners with distinct styling per type:
- **Elimination**: Red gradient background, bold white text, danger icon. Brief shake animation.
- **Game results**: Gold gradient, trophy icon, player name highlighted.
- **Phase changes**: Full-width banner with new phase name in display font, background shifts simultaneously.
- **General announcements**: Teal-tinted banner, more subdued.

### Cartridge Integration (Inline)

Voting/Game/Prompt cartridges render **inline in the chat timeline** (like the existing StageChat pattern), NOT as overlays. When a round starts, the cartridge appears as a special card in the flow. A floating "Return to Vote" pill appears if the player scrolls away.

### Chat Input

Pinned above tab bar. Compact: single-line input with rounded corners, send button. No silver transfer button (that lives in player quick sheet). Phase-aware placeholder text:
- Social: "Plot your next move..."
- Voting: "Quick, before votes close..."
- Game: "Talk strategy..."
- Default: "Say something..."

## Tab 2: Whispers (DMs & Groups)

Conversation thread list, sorted by recency.

Each thread card:
- Player avatar (or stacked avatars for groups) with online indicator
- Player name in their accent color
- Last message preview (truncated, muted)
- Timestamp right-aligned
- Unread: accent bar on left pulses/glows

**Sections** (top to bottom):
1. Game Master thread (pinned, gold accent, if GM messages exist)
2. Group DMs
3. 1:1 DMs (sorted by recency)

**"+ New Whisper" and "+ New Group"** as compact pill buttons at top.

**Tapping a thread** opens DM chat view — same Talk Show Panel card style as Stage but scoped to that conversation. Compact header with other player's avatar + name (tappable → quick sheet). Back button returns to Whispers list.

## Tab 3: Cast (Leaderboard + Roster)

Two sections:

### Leaderboard (top)

Ranked player cards ordered by silver count:
- **Top 3**: Larger cards with rank badges (gold/silver/bronze accent), accent color prominent, crown/star on #1
- **Remaining**: Compact ranked rows
- **Eliminated**: Drop to bottom, greyed out with "ELIMINATED" badge

### Roster Interaction

- **Tap a player** → navigates to Whispers tab with their DM open (primary action, fast)
- **Tap info/profile icon** on player row → opens full Player Detail screen (secondary action)

## Player Interaction: Two Layers

### 1. Quick Sheet (Bottom Sheet)

Triggered by tapping any avatar/name in Stage chat messages. Compact bottom sheet:
- Avatar, player name, status (alive/eliminated)
- Stats: silver, gold
- Action buttons: "Whisper" (→ DM), "Send Silver" (amount picker), "View Profile" (→ detail screen)

### 2. Player Detail Screen (Full Page)

Accessible from quick sheet "View Profile" or Cast tab info icon:
- Hero avatar (large, with accent color glow ring)
- Name, status badge (ALIVE/ELIMINATED)
- Stats row: silver, gold, online status
- Action buttons: Whisper, Send Silver
- Empty space below for future features
- Back button returns to previous context

## Phase-Reactive Theming

The ENTIRE app transforms with game phase. Not just a banner — backgrounds, card tints, accent glows, everything.

| Phase | Background Gradient | Accent Shift | Mood |
|-------|-------------------|--------------|------|
| Pre-game | Soft indigo → deep purple | Lavender | Anticipation |
| Morning/Social | Warm amber → peach undertones | Coral, teal | Energy |
| Game/Activity | Electric blue → cyan | Teal, bright white | Competition |
| Voting | Deep crimson → burgundy | Gold, red | Tension |
| Elimination/Night | Near-black → cool charcoal | Muted, dramatic pops | Drama |

Implemented via CSS custom properties on `.vivid-shell` toggled by a phase class. All surfaces inherit. Transitions are 2-3 seconds, smooth.

## Live Broadcast Chrome

- **Pulsing "LIVE" dot**: Always visible in top bar. Red, animated pulse.
- **Phase transition splash**: When phase changes, brief full-screen overlay with phase name in large display font, fades after ~1.5s. Like a TV segment bumper.
- **Breaking news banners**: Eliminations and major events get dramatic full-width animated entries.
- **Phase gradient line**: 2px animated line above tab bar, color matches current phase.
- **Background energy**: Subtle animated gradient shifts. The screen feels alive, not static.

## Typography

New font stack (loaded via Google Fonts):
- **Display** (Quicksand, 600-700): Phase banners, player names, tab labels, headers. Rounded, playful.
- **Body** (DM Sans, 400-500): Message text, timestamps, descriptions. Clean, compact.
- **Mono** (JetBrains Mono, 400): Silver/gold numbers, rankings, timers. Broadcast-dashboard feel.

## Player Accent Colors

Each player is auto-assigned a unique accent color from a curated palette (8-10 colors, high contrast on dark backgrounds). Used for:
- Message card left border bar
- Player name text in messages
- Cast tab leaderboard accents
- Quick sheet / detail screen glow
- Consistent everywhere — instant player identification without reading names

## Icons

**Solar Icons** (`@solar-icons/react`) — BoldDuotone weight. Already swapped in. Colorful, chunky, two-tone fills.

## File Structure (Revised)

```
src/shells/vivid/
├── VividShell.tsx              # Tab-based layout orchestrator
├── vivid.css                   # Phase-reactive CSS variables, fonts
├── springs.ts                  # Framer Motion spring presets (keep)
├── colors.ts                   # Player accent color palette + assignment
├── components/
│   ├── BroadcastBar.tsx        # Top bar: LIVE dot + phase label + currency
│   ├── TabBar.tsx              # Bottom 3-tab navigation
│   ├── StageChat.tsx           # Main chat timeline (rewrite)
│   ├── MessageCard.tsx         # Talk Show Panel message card (replaces ChatBubble)
│   ├── BroadcastAlert.tsx      # Breaking-news system events (replaces SystemAnnouncement)
│   ├── ChatInput.tsx           # Simplified input bar (modify)
│   ├── WhispersTab.tsx         # DM/Group list (replaces Backstage)
│   ├── WhisperThread.tsx       # Conversation card in Whispers list
│   ├── DMChat.tsx              # DM chat view (restyle)
│   ├── CastTab.tsx             # Leaderboard + roster
│   ├── PlayerQuickSheet.tsx    # Bottom sheet for player actions
│   ├── PlayerDetail.tsx        # Full-page player profile (replaces Spotlight)
│   ├── PhaseTransitionSplash.tsx # Full-screen phase change bumper
│   └── DramaticReveal.tsx      # Elimination reveal (restyle)
```

**Deleted** (no longer needed):
- `PersonaRail.tsx`
- `CartridgeOverlay.tsx`
- `ChatPeek.tsx`
- `ChatBubble.tsx` (replaced by MessageCard)
- `ConversationCard.tsx` (replaced by WhisperThread)
- `SystemAnnouncement.tsx` (replaced by BroadcastAlert)
- `GameHUD.tsx` (replaced by BroadcastBar)
- `Spotlight.tsx` (replaced by PlayerDetail)
- `QuickActions.tsx` (replaced by PlayerQuickSheet)

## Shared Components (Reused)

- `PersonaAvatar` — avatar rendering
- `VotingPanel`, `GamePanel`, `PromptPanel` — cartridge panel content
- `PwaGate` — PWA install/push prompts
- `NewDmPicker`, `NewGroupPicker` — DM/group creation flows
- `useGameStore` — all game state
- `useTimeline` — timeline entry ordering
- Engine prop — all send methods

## Dependencies

**Existing** (no new deps needed):
- `framer-motion` — animations, layout transitions
- `sonner` — toast notifications
- `vaul` — drawer/sheet primitives (for quick sheet)
- `@solar-icons/react` — icons (already added)
- Tailwind CSS — utility classes
- Google Fonts — Quicksand, DM Sans, JetBrains Mono
