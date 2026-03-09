# Vivid Shell — Design Document

## Concept

A new client shell ("Vivid") for Pecking Order that treats chat as gameplay, not utility. The metaphor is a social game show: players are contestants on a stage, conversations are the game, and every interaction has theatrical energy.

The shell has three navigable spaces — Stage, Backstage, Spotlight — with dramatic transitions between them. Personas are first-class UI citizens, always visible and interactive.

## Spaces & Navigation

### 1. The Stage (default, home)

The main game view. Three vertical zones:

**Game HUD** (top, always visible, ~48px): Day counter, phase name, alive/total pips (small colored dots per player), your silver + gold. Rendered as ambient game-show set dressing — not a collapsible toolbar. Phase name animates on change. Background subtly tints based on current phase.

**Persona Rail** (below HUD, ~72px, horizontal scroll): Large circular avatars (52px) in a horizontally scrollable row. Your persona is first, slightly larger (60px) with a pulsing glow ring. Each avatar has:
- Colored ring: green = online, dim = offline, gold shimmer = active in current phase
- Unread dot: bouncing coral dot for unread DMs
- Eliminated: grayscale + diagonal slash overlay + shrinks to 40px
- Tap → navigates to Backstage with that player's DM pre-selected
- Long-press → quick-action popover (Send Silver, View Profile)
- Special last item: speech-bubble icon = main group chat (active by default)

**Main Chat** (fills remaining space): Group chat timeline with rich message bubbles. System events styled as theatrical announcements (see Chat Experience below). Floating input bar pinned to bottom with contextual quick-actions.

**Cartridge Overlay**: When a cartridge activates (voting/game/prompt), it enters with a dramatic animation (scale up from center + particle burst). The chat dims and slides down but remains partially visible. A floating "chat peek" pill in the top-right corner lets you pull chat back as a sheet overlay on top of the cartridge. The cartridge is NOT a blocking modal — it's a layer. Tapping outside or swiping down on the chat sheet returns focus to the cartridge.

### 2. The Backstage (swipe left from Stage, or tap persona in rail)

Private conversation hub. All DMs and group DMs live here.

**Header**: "Backstage" title + "New DM" and "New Group" buttons as playful pill-shaped FABs with Phosphor icons.

**Conversation Cards** (vertical scrollable list, sorted by last activity):
- **1:1 DMs**: Large persona avatar (48px) with name, last message preview, timestamp, unread count badge
- **Group DMs**: Overlapping avatar cluster (2-3 faces stacked with offset) with member names, last message, unread badge
- **Game Master DM**: Special gold-bordered card with crown icon, always pinned at top when it has messages

Tap a card → full-screen DM chat view:
- Large persona face in header (or group avatar cluster for group DMs)
- Pull down on header → reveals persona/group details (mini-spotlight)
- Back button returns to Backstage list
- Chat input at bottom, identical to Stage input

**Transition**: Backstage slides in from the left like a curtain pull (translateX with spring easing). Chat messages in the DM stagger-animate in.

### 3. The Spotlight (tap persona avatar directly, or "View Profile" action)

Full-screen persona detail page. Designed to be extensible for future features.

**Hero Section**: Large avatar (120px) centered, with animated aura ring behind it. Persona name in display font below. Status badge: "ALIVE" (green, pulsing) or "ELIMINATED" (red, with slash effect).

**Stats Grid**: Silver balance, gold balance, DM history count, silver sent/received between you and them. Displayed as chunky stat cards with Phosphor duotone icons.

**Action Buttons**: "Message" (opens DM), "Send Silver" (opens amount picker), "Start Group" (opens group creator with this player pre-selected). Large, colorful pill buttons.

**Transition**: Shared-element transition from the avatar in the rail/list — the avatar zooms and expands into the hero section. Exit reverses the animation.

## Visual Identity

### Colors (CSS custom properties, scoped to Vivid shell)

| Token | Value | Usage |
|-------|-------|-------|
| `--vivid-bg-deep` | `#1a1b3a` | Base background (deep warm indigo) |
| `--vivid-bg-surface` | `#252758` | Cards, panels |
| `--vivid-bg-elevated` | `#2f3170` | Elevated surfaces, input fields |
| `--vivid-bg-glass` | `rgba(37, 39, 88, 0.7)` | Glass panels with backdrop-blur |
| `--vivid-coral` | `#FF6B6B` | Primary accent — actions, your messages, CTAs |
| `--vivid-teal` | `#4ECDC4` | Social/chat accent — DMs, online, message theirs |
| `--vivid-gold` | `#FFD93D` | Currency, rewards, winners, Game Master |
| `--vivid-pink` | `#FF2E63` | Danger — eliminations, warnings, hot moments |
| `--vivid-lavender` | `#A78BFA` | Groups, secondary accents |
| `--vivid-text` | `#F8F0E3` | Primary text (warm cream, not pure white) |
| `--vivid-text-dim` | `#8B8DB3` | Secondary text (lavender mist) |

### Phase-Reactive Backgrounds

The shell's base background shifts with game phase via CSS transition:
- **Social Hour / DMs Open**: Deep indigo (default calm)
- **Voting Active**: Warm coral undertone (`#2a1525`)
- **Game Active**: Electric teal undertone (`#152a28`)
- **Elimination Reveal**: Dark red pulse (`#2a0a0a`)
- **Pre-game / Post-game**: Neutral deep

Implemented as a gradient overlay that transitions `background-color` with a 2s ease.

### Typography

New font stack (loaded via Google Fonts in the shell's own CSS):
- **Display**: `Nunito` (700, 800, 900) — rounded, friendly, game-like
- **Body**: `DM Sans` (400, 500, 600) — clean, modern, readable
- **Mono**: `JetBrains Mono` (inherited from preset) — numbers, currency

### Icons

**Phosphor Icons** (`@phosphor-icons/react`) — duotone weight. 24-28px default. Colored per-context:
- Teal for social/chat (ChatCircleDots, UserCircle, UsersThree)
- Coral for game actions (GameController, Sword, Lightning)
- Gold for economy (CurrencyDollar, Crown, Trophy)
- Pink for danger (Skull, XCircle, Warning)

### Animations

Continue using **Framer Motion** (already a dependency). New spring presets:
- `VIVID_SPRING.bouncy`: `{ type: 'spring', stiffness: 400, damping: 25 }` — buttons, taps
- `VIVID_SPRING.dramatic`: `{ type: 'spring', stiffness: 200, damping: 20 }` — cartridge entrances
- `VIVID_SPRING.gentle`: `{ type: 'spring', stiffness: 120, damping: 20 }` — page transitions
- `VIVID_SPRING.snappy`: `{ type: 'spring', stiffness: 500, damping: 30 }` — quick UI feedback

Additional effects:
- **Particle bursts** via `canvas-confetti` (already a dependency) for cartridge activations, eliminations, silver transfers
- **Staggered list animations** for message/card entrances (delay: `i * 30ms`)
- **Shared-element transitions** via `layoutId` (Framer Motion) for persona avatar → Spotlight

## Chat Experience

### Message Bubbles

Not rectangles. Organic rounded shapes with slight asymmetry:
- **Your messages**: Coral background, right-aligned, slight bottom-right tail
- **Their messages**: Surface color (`--vivid-bg-surface`), left-aligned, slight bottom-left tail
- **Persona avatar** (28px) appears next to each message cluster (not every message)
- **Timestamp** appears between message clusters, not on every bubble

### System Messages (Theatrical Announcements)

System events are styled as game-show announcements, not plain text:
- **Phase changes**: Full-width banner, bold display font, phase-colored background, subtle shimmer animation
- **Eliminations**: Red-bordered card with skull icon, player avatar with slash, dramatic entrance
- **Silver transfers**: Animated coin icon trail, gold highlight, "X sent Y silver" as a compact card
- **Game results**: Confetti burst + gold banner + reward display
- **Voting results**: Reveal animation with suspense delay

### Chat Input

Bottom-pinned, pill-shaped input with:
- Text field with placeholder that changes with context ("Plot in main chat...", "Whisper to [name]...", "Message the group...")
- Send button (coral, Phosphor PaperPlaneRight icon)
- Quick-action row above input: Send Silver (gold coin icon), contextual actions
- Expands smoothly when focused (keyboard open)

## Cartridge Integration

Cartridges (VotingPanel, GamePanel, PromptPanel) render in a **dramatic overlay layer** on the Stage:

**Entrance**: Scale up from 0.8 + fade in + confetti burst. Background dims to 40% opacity.

**Layout**: Cartridge fills ~85% of screen height, leaving the HUD visible at top. Rounded top corners, surface-colored background. The cartridge content scrolls within.

**Chat Peek**: While a cartridge is active, a floating pill button appears: "Chat (3)" showing unread count. Tap → chat slides up as a bottom sheet over the cartridge. Dismiss by swiping down or tapping outside.

**Exit**: Cartridge scales down + fades out. Chat slides back up to full height.

**Styling**: Cartridge panels inherit Vivid's color variables. Voting buttons use coral/teal accents. Game cartridges use the existing game-cartridge renderers, wrapped in Vivid's CartridgeWrapper for consistent borders/padding.

## File Structure

```
src/shells/vivid/
├── VividShell.tsx              # Main shell component, space navigation
├── vivid.css                   # CSS variables, fonts, phase backgrounds
├── springs.ts                  # Framer Motion spring presets
├── components/
│   ├── GameHUD.tsx             # Persistent top bar (day, phase, currency, pips)
│   ├── PersonaRail.tsx         # Horizontal avatar rail
│   ├── StageChat.tsx           # Main chat timeline (Stage view)
│   ├── ChatBubble.tsx          # Message bubble component
│   ├── SystemAnnouncement.tsx  # Theatrical system event cards
│   ├── ChatInput.tsx           # Bottom input bar with quick actions
│   ├── Backstage.tsx           # DM/Group DM conversation list
│   ├── ConversationCard.tsx    # DM thread card
│   ├── DMChat.tsx              # Full-screen DM/Group DM chat view
│   ├── Spotlight.tsx           # Persona detail full-screen page
│   ├── CartridgeOverlay.tsx    # Cartridge wrapper with dramatic entrance/exit
│   ├── ChatPeek.tsx            # Floating chat bubble during cartridge
│   ├── QuickActions.tsx        # Long-press popover for persona rail
│   └── PhaseBackground.tsx     # Phase-reactive background gradient
```

## Dependencies

**New** (to add):
- `@phosphor-icons/react` — icon library

**Existing** (already available):
- `framer-motion` — animations, layout transitions, shared elements
- `canvas-confetti` — particle effects
- `sonner` — toast notifications
- `vaul` — drawer/sheet primitives (can reuse for chat peek sheet)
- Tailwind CSS — utility classes + Vivid-scoped custom properties

## Shared Components

The Vivid shell reuses from the existing codebase:
- `PersonaAvatar` (`components/PersonaAvatar.tsx`) — avatar rendering
- `GamePanel`, `VotingPanel`, `PromptPanel` (`components/panels/`) — cartridge dispatchers
- `PwaGate` (`components/PwaGate.tsx`) — PWA install/push prompts
- `NewDmPicker`, `NewGroupPicker` (`shells/classic/components/`) — DM/group creation flows (reuse initially, restyle later)
- `useGameStore` — all game state
- Engine prop — all send methods

## Registration

Add to `shells/registry.ts`:
```ts
{
  id: 'vivid',
  name: 'Vivid',
  load: () => import('./vivid/VividShell'),
}
```

Update `getActiveShellId()` to read from localStorage (currently hardcoded to 'immersive'), defaulting to 'vivid'.
