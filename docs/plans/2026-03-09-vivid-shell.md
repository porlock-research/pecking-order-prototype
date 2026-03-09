# Vivid Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a new "Vivid" client shell with a game-show aesthetic, persona-centric navigation, and three navigable spaces (Stage, Backstage, Spotlight).

**Architecture:** The Vivid shell is a self-contained shell module under `apps/client/src/shells/vivid/`. It implements the same `ShellProps` contract as the existing shells, uses `useGameStore` for state, and renders cartridges via the shared panel components. Navigation between the three spaces (Stage, Backstage, Spotlight) is managed via local React state with Framer Motion page transitions.

**Tech Stack:** React 19, Framer Motion, Tailwind CSS, Phosphor Icons, Zustand (existing store), Vaul (bottom sheets), canvas-confetti, sonner (toasts)

---

### Task 1: Install Phosphor Icons + scaffold shell directory

**Files:**
- Modify: `apps/client/package.json`
- Create: `apps/client/src/shells/vivid/VividShell.tsx` (minimal placeholder)
- Create: `apps/client/src/shells/vivid/vivid.css`
- Create: `apps/client/src/shells/vivid/springs.ts`
- Modify: `apps/client/src/shells/registry.ts`

**Step 1: Install @phosphor-icons/react**

Run: `cd apps/client && npm install @phosphor-icons/react`

**Step 2: Create vivid.css with color variables and font imports**

```css
/* Vivid Shell — scoped theme variables */
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=DM+Sans:wght@400;500;600&display=swap');

.vivid-shell {
  /* Backgrounds */
  --vivid-bg-deep: #1a1b3a;
  --vivid-bg-surface: #252758;
  --vivid-bg-elevated: #2f3170;
  --vivid-bg-glass: rgba(37, 39, 88, 0.7);

  /* Accents */
  --vivid-coral: #FF6B6B;
  --vivid-teal: #4ECDC4;
  --vivid-gold: #FFD93D;
  --vivid-pink: #FF2E63;
  --vivid-lavender: #A78BFA;

  /* Text */
  --vivid-text: #F8F0E3;
  --vivid-text-dim: #8B8DB3;

  /* Typography */
  --vivid-font-display: 'Nunito', sans-serif;
  --vivid-font-body: 'DM Sans', sans-serif;

  font-family: var(--vivid-font-body);
  color: var(--vivid-text);
  background: var(--vivid-bg-deep);
}

/* Phase-reactive background classes */
.vivid-phase-social { background: linear-gradient(135deg, #1a1b3a 0%, #1e2045 100%); }
.vivid-phase-voting { background: linear-gradient(135deg, #2a1525 0%, #1a1b3a 100%); }
.vivid-phase-game { background: linear-gradient(135deg, #152a28 0%, #1a1b3a 100%); }
.vivid-phase-elimination { background: linear-gradient(135deg, #2a0a0a 0%, #1a1b3a 100%); }
.vivid-phase-default { background: var(--vivid-bg-deep); }
```

**Step 3: Create springs.ts**

```ts
export const VIVID_SPRING = {
  bouncy: { type: 'spring' as const, stiffness: 400, damping: 25 },
  dramatic: { type: 'spring' as const, stiffness: 200, damping: 20 },
  gentle: { type: 'spring' as const, stiffness: 120, damping: 20 },
  snappy: { type: 'spring' as const, stiffness: 500, damping: 30 },
  page: { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.8 },
} as const;

export const VIVID_TAP = {
  button: { scale: 0.95 },
  card: { scale: 0.97 },
  fab: { scale: 0.88 },
} as const;
```

**Step 4: Create minimal VividShell.tsx placeholder**

```tsx
import React from 'react';
import './vivid.css';
import type { ShellProps } from '../types';

function VividShell({ playerId, engine, token }: ShellProps) {
  return (
    <div className="vivid-shell fixed inset-0 flex flex-col overflow-hidden">
      <div className="flex-1 flex items-center justify-center">
        <span className="text-2xl" style={{ fontFamily: 'var(--vivid-font-display)', color: 'var(--vivid-coral)' }}>
          Vivid Shell
        </span>
      </div>
    </div>
  );
}

export default VividShell;
```

**Step 5: Register in registry.ts**

Add the vivid entry to `SHELL_REGISTRY` and update `getActiveShellId()` to read from localStorage with 'vivid' as default:

```ts
// In SHELL_REGISTRY array, add:
{
  id: 'vivid',
  name: 'Vivid',
  load: () => import('./vivid/VividShell'),
},

// Update getActiveShellId:
export function getActiveShellId(): string {
  return localStorage.getItem(STORAGE_KEY) || 'vivid';
}
```

**Step 6: Verify it builds and renders**

Run: `cd apps/client && npx vite build`
Expected: Clean build, no errors.

**Step 7: Commit**

```
feat(vivid): scaffold shell directory, install Phosphor Icons, register shell
```

---

### Task 2: GameHUD component

The persistent top bar showing day, phase, alive pips, and currency.

**Files:**
- Create: `apps/client/src/shells/vivid/components/GameHUD.tsx`

**Reference:**
- `shells/immersive/components/Header.tsx` — data sources (useGameStore fields)
- `utils/formatState.ts:formatPhase` — phase string formatting

**Step 1: Build the GameHUD**

The HUD is always visible (no collapse/expand like immersive Header). It shows:
- Day number + phase name (animated on change)
- Alive player pips (small colored dots, one per player — green=alive, red=eliminated)
- Your silver + gold with Phosphor icons (CurrencyDollarSimple, Trophy)
- Admin link (small settings gear, same as immersive)

Use Phosphor duotone icons. Style with vivid CSS variables. ~48px height. Game-show feel: phase name in display font, bold colors.

Key data sources:
```ts
const { roster, goldPool, playerId, dayIndex, serverState, gameId } = useGameStore();
const phase = formatPhase(serverState);
const me = playerId ? roster[playerId] : null;
const aliveCount = Object.values(roster).filter(p => p.status === PlayerStatuses.ALIVE).length;
```

**Step 2: Verify it builds**

Import into VividShell.tsx, render at top of the layout.

Run: `cd apps/client && npx vite build`

**Step 3: Commit**

```
feat(vivid): add GameHUD component with phase, pips, currency
```

---

### Task 3: PersonaRail component

Horizontal scrollable row of player avatars. This IS the navigation.

**Files:**
- Create: `apps/client/src/shells/vivid/components/PersonaRail.tsx`

**Reference:**
- `shells/immersive/components/PeopleList.tsx` — roster data, online detection, DM stats
- `components/PersonaAvatar.tsx` — avatar rendering (reuse directly)
- `store/useGameStore.ts` — `onlinePlayers`, `chatLog`, `channels`

**Step 1: Build the PersonaRail**

Props:
```ts
interface PersonaRailProps {
  onSelectPlayer: (playerId: string) => void;
  onSelectMainChat: () => void;
  activePlayerId: string | null; // currently viewing DM with this player
  showingMainChat: boolean;
}
```

Layout: Horizontal scroll, ~72px height. Renders:
1. Your persona first (60px, coral glow ring, always highlighted)
2. All alive players (52px, sorted alphabetically)
3. Eliminated players (40px, grayscale, diagonal slash CSS overlay)
4. Special "main chat" bubble at the end — Phosphor `ChatCircleDots` icon in a circle

Each avatar shows:
- Green ring if online (use `onlinePlayers.includes(id)`)
- Bouncing coral dot if unread DMs (check `chatLog` for DM channel messages not yet seen — simplified: just check if DM channel has messages)
- Gold shimmer ring if `activePlayerId === id` (currently viewing their DM)
- Tap handler calls `onSelectPlayer(id)`

Use `PersonaAvatar` for rendering. Use Framer Motion `layoutId` on avatars for shared-element transitions later.

**Step 2: Wire into VividShell**

Import and render below GameHUD. Wire up state:
```ts
const [activeSpace, setActiveSpace] = useState<'stage' | 'backstage' | 'spotlight'>('stage');
const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
```

**Step 3: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 4: Commit**

```
feat(vivid): add PersonaRail with avatar navigation and unread indicators
```

---

### Task 4: ChatBubble + SystemAnnouncement components

Vivid-styled chat message bubbles and theatrical system events.

**Files:**
- Create: `apps/client/src/shells/vivid/components/ChatBubble.tsx`
- Create: `apps/client/src/shells/vivid/components/SystemAnnouncement.tsx`

**Reference:**
- `shells/immersive/components/ChatBubble.tsx` — full props interface, long-press, reactions
- `shells/immersive/components/SystemEvent.tsx` — category-based coloring

**Step 1: Build ChatBubble**

Same props as immersive ChatBubble. Visual differences:
- **Your messages**: Coral background (`--vivid-coral`), right-aligned, rounded with bottom-right notch
- **Their messages**: Surface background (`--vivid-bg-surface`), left-aligned, rounded with bottom-left notch
- **Game Master messages**: Gold left border + gold tinted background (similar concept, vivid palette)
- Persona avatar (28px) next to message clusters (reuse `PersonaAvatar`)
- Sender name in display font, colored per-player
- Reactions bar with Phosphor icons
- Long-press and tap-reply preserved (same logic)

Bubble shape: Use `border-radius` with asymmetric values for organic feel:
```css
/* Their message */
border-radius: 4px 18px 18px 18px;
/* My message */
border-radius: 18px 4px 18px 18px;
```

**Step 2: Build SystemAnnouncement**

Theatrical system events instead of plain text dividers:
- **ELIMINATION**: Red-bordered card with Phosphor `Skull` icon, player name bold
- **VOTE**: Gold banner with Phosphor `Scales` icon
- **GAME/GAME.REWARD**: Teal card with Phosphor `GameController` icon
- **PHASE changes**: Full-width gradient banner in display font, phase-colored
- **SOCIAL**: Lavender accent with Phosphor `ChatCircleDots` icon
- Default: Dim divider (similar to current but with vivid palette)

Each announcement animates in with scale + fade (Framer Motion).

**Step 3: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 4: Commit**

```
feat(vivid): add ChatBubble and SystemAnnouncement with vivid styling
```

---

### Task 5: ChatInput component

Bottom-pinned input bar with contextual quick actions.

**Files:**
- Create: `apps/client/src/shells/vivid/components/ChatInput.tsx`

**Reference:**
- `shells/immersive/components/FloatingInput.tsx` — full logic (typing indicator, optimistic send, reply preview, group chat closed state)

**Step 1: Build ChatInput**

Props:
```ts
interface ChatInputProps {
  engine: ShellProps['engine'];
  context: 'main' | 'dm' | 'group';
  targetId?: string; // DM target or channel ID for group
  replyTarget?: ChatMessage | null;
  onClearReply?: () => void;
  onSendSilver?: () => void; // Opens silver transfer UI
}
```

Visual:
- Pill-shaped input field with `--vivid-bg-elevated` background
- Placeholder changes with context: "Plot in main chat...", "Whisper to [name]...", "Message the group..."
- Send button: Coral circle with Phosphor `PaperPlaneRight` icon
- Quick action: Gold coin button (Phosphor `CurrencyDollarSimple`) for silver transfer, visible in DM context
- Typing indicator with persona avatars + animated dots
- Reply preview with coral left border + dismiss X
- "Chat closed" / "DMs closed" state

Reuses the same `sendMessage`/`sendDM`/`sendToChannel`/`sendTyping`/`stopTyping` engine methods.

**Step 2: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 3: Commit**

```
feat(vivid): add ChatInput with contextual placeholders and quick actions
```

---

### Task 6: StageChat — main chat timeline

The Stage's content area: chat messages + system events + cartridges inline.

**Files:**
- Create: `apps/client/src/shells/vivid/components/StageChat.tsx`

**Reference:**
- `shells/immersive/components/Timeline.tsx` — full timeline logic (useTimeline hook, scroll management, optimistic messages, cartridge rendering)
- `hooks/useTimeline.ts` — timeline entry merging

**Step 1: Build StageChat**

This is the Vivid equivalent of immersive's Timeline. It uses:
- `useTimeline()` hook for merged chat + system + cartridge entries
- Vivid `ChatBubble` for chat entries
- Vivid `SystemAnnouncement` for system entries
- Shared `VotingPanel`, `GamePanel`, `PromptPanel` for cartridge entries (wrapped in Vivid's CartridgeOverlay — Task 8)
- Vivid `ChatInput` for the bottom input (context='main')
- Scroll management: auto-scroll to bottom, "Jump to latest" button
- Optimistic messages (same logic as immersive Timeline)
- `shouldShowSender` / `shouldShowTimestamp` grouping (same logic)

Empty state: Centered illustration with "The stage is set..." text in display font.

**Step 2: Wire into VividShell as the Stage view**

The Stage view shows GameHUD + PersonaRail + StageChat.

**Step 3: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 4: Commit**

```
feat(vivid): add StageChat timeline with message grouping and scroll management
```

---

### Task 7: CartridgeOverlay + ChatPeek

When a cartridge is active, it overlays the Stage. Chat remains accessible via a peek button.

**Files:**
- Create: `apps/client/src/shells/vivid/components/CartridgeOverlay.tsx`
- Create: `apps/client/src/shells/vivid/components/ChatPeek.tsx`

**Reference:**
- `shells/immersive/components/CartridgeWrapper.tsx` — entrance animation, glow colors
- `shells/immersive/components/Timeline.tsx:130-133` — return-to-action pill logic

**Step 1: Build CartridgeOverlay**

Renders when `activeVotingCartridge || activeGameCartridge || activePromptCartridge`. Uses `AnimatePresence` for entrance/exit:
- Entrance: Scale from 0.85 + fade in + optional confetti burst (via `canvas-confetti`)
- Background: Semi-transparent black overlay (0.4 opacity) over the StageChat
- Cartridge fills ~85% of screen height, rounded top corners, `--vivid-bg-surface` background
- HUD stays visible above
- Exit: Scale down + fade out

Props:
```ts
interface CartridgeOverlayProps {
  engine: ShellProps['engine'];
  onOpenChatPeek: () => void;
}
```

Renders the appropriate panel based on which cartridge is active. Uses `ChatPeek` button.

**Step 2: Build ChatPeek**

A floating pill button that appears when a cartridge is active: "Chat (N)" with unread count. Tap opens a Vaul bottom sheet showing the StageChat in a scrollable overlay. Dismiss by swiping down.

Position: Top-right, below the HUD. Teal accent color.

Uses the `Drawer` component from `vaul` (already a dependency).

**Step 3: Wire into VividShell**

CartridgeOverlay renders as an overlay layer in the Stage space, above StageChat but below the HUD.

**Step 4: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 5: Commit**

```
feat(vivid): add CartridgeOverlay with dramatic entrance and ChatPeek sheet
```

---

### Task 8: Backstage — conversation hub

The Backstage space: all DMs and group DMs as conversation cards.

**Files:**
- Create: `apps/client/src/shells/vivid/components/Backstage.tsx`
- Create: `apps/client/src/shells/vivid/components/ConversationCard.tsx`

**Reference:**
- `shells/immersive/components/PeopleList.tsx` — DM/group data derivation (lastDmByPlayer, groupThreads, gmDm)
- `shells/classic/components/NewDmPicker.tsx` — DM creation flow
- `shells/classic/components/NewGroupPicker.tsx` — group creation flow

**Step 1: Build ConversationCard**

A single conversation card used for both 1:1 DMs and group DMs.

Props:
```ts
interface ConversationCardProps {
  type: '1on1' | 'group' | 'gm';
  avatarUrl?: string;
  personaName?: string;
  memberAvatars?: Array<{ avatarUrl?: string; personaName?: string }>; // For groups
  lastMessage?: string;
  lastSenderName?: string;
  timestamp?: number;
  unreadCount?: number;
  isOnline?: boolean;
  onClick: () => void;
}
```

Visual:
- Large persona avatar (48px) for 1:1, overlapping cluster for groups, gold crown for GM
- Name + last message preview + relative timestamp
- Unread count as a bouncing coral badge
- Stagger animation on mount (delay per index)
- Tap → Framer Motion press scale

**Step 2: Build Backstage**

Full-screen view with:
- Header: "Backstage" in display font + "New DM" and "New Group" FABs (Phosphor `Plus`, `UserPlus`, `UsersThree`)
- GM DM card pinned at top (if messages exist)
- Group DMs section with header "Groups"
- 1:1 DMs section with header "Direct Messages"
- Cards sorted by last activity

Reuses `NewDmPicker` and `NewGroupPicker` from classic shell (same as immersive does).

Props:
```ts
interface BackstageProps {
  onSelectDm: (playerId: string) => void;
  onSelectGroup: (channelId: string) => void;
  onBack: () => void; // Return to Stage
  engine: ShellProps['engine'];
}
```

**Step 3: Wire navigation in VividShell**

Backstage is accessible by swiping left from Stage OR tapping a persona in the rail.

**Step 4: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 5: Commit**

```
feat(vivid): add Backstage conversation hub with ConversationCard
```

---

### Task 9: DMChat — full-screen DM/Group DM view

**Files:**
- Create: `apps/client/src/shells/vivid/components/DMChat.tsx`

**Reference:**
- `shells/immersive/components/PlayerDrawer.tsx` — 1:1 DM logic (messages, send, silver transfer, rejection toasts)
- `shells/immersive/components/GroupDrawer.tsx` — group DM logic (channel messages, typing)
- `hooks/usePlayerTimeline.ts` — DM message filtering

**Step 1: Build DMChat**

A full-screen chat view (NOT a drawer) for both 1:1 and group DMs.

Props:
```ts
interface DMChatProps {
  mode: '1on1' | 'group';
  targetPlayerId?: string; // For 1:1
  channelId?: string; // For group
  engine: ShellProps['engine'];
  onBack: () => void;
  onOpenSpotlight?: (playerId: string) => void; // Pull-down reveals persona detail
}
```

Layout:
- Header: Back arrow (Phosphor `ArrowLeft`) + large persona avatar (56px) + name + online status + pull-down hint
- Pull down on header → navigate to Spotlight for that player
- Messages area: Vivid ChatBubbles, auto-scroll, empty state
- Input: Vivid ChatInput (context='dm' or context='group')
- Silver transfer inline (same logic as PlayerDrawer)
- Typing indicator
- DM rejection toasts via sonner

For 1:1 DMs, use `usePlayerTimeline(targetPlayerId)` for merged messages + ticker events.
For group DMs, filter `chatLog` by `channelId` (same as GroupDrawer).

**Step 2: Wire into VividShell**

When a persona is selected (via rail tap or backstage card), navigate to DMChat.

**Step 3: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 4: Commit**

```
feat(vivid): add DMChat full-screen view for 1:1 and group conversations
```

---

### Task 10: Spotlight — persona detail page

**Files:**
- Create: `apps/client/src/shells/vivid/components/Spotlight.tsx`

**Reference:**
- `shells/immersive/components/PlayerDrawer.tsx:112-150` — player header (avatar, name, status, currency, online)

**Step 1: Build Spotlight**

Full-screen persona detail page.

Props:
```ts
interface SpotlightProps {
  targetPlayerId: string;
  engine: ShellProps['engine'];
  onBack: () => void;
  onMessage: (playerId: string) => void;
}
```

Layout:
- Back button (Phosphor `ArrowLeft`)
- Hero avatar (120px) centered, with animated aura ring (Framer Motion box-shadow pulse):
  - Alive: green/teal aura
  - Eliminated: red aura + grayscale + slash
- Persona name in display font (Nunito 900)
- Status badge: "ALIVE" (green pill, pulsing) or "ELIMINATED" (red pill)
- Stats grid (2x2): Silver, Gold, DM count with this player, online/offline
  - Phosphor duotone icons: `CurrencyDollarSimple`, `Trophy`, `ChatCircleDots`, `WifiHigh`/`WifiSlash`
- Action buttons row:
  - "Message" (teal, Phosphor `ChatCircleDots`) → navigates to DMChat
  - "Send Silver" (gold, Phosphor `CurrencyDollarSimple`) → inline silver amount picker
  - "Start Group" (lavender, Phosphor `UsersThree`) → opens NewGroupPicker with this player pre-selected
- Shared-element transition: avatar `layoutId={`vivid-avatar-${playerId}`}` matches PersonaRail's avatar

**Step 2: Wire into VividShell**

Spotlight is accessed by long-pressing a persona in the rail, or pull-down in DMChat header, or explicit "View Profile" action.

**Step 3: Verify it builds**

Run: `cd apps/client && npx vite build`

**Step 4: Commit**

```
feat(vivid): add Spotlight persona detail page with hero avatar and actions
```

---

### Task 11: VividShell orchestrator — wire everything together

**Files:**
- Modify: `apps/client/src/shells/vivid/VividShell.tsx` (replace placeholder)

**Step 1: Build the full VividShell**

Space navigation state:
```ts
type Space = 'stage' | 'backstage' | 'dm-chat' | 'spotlight' | 'new-dm' | 'new-group';

const [space, setSpace] = useState<Space>('stage');
const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
```

Layout:
```tsx
<div className="vivid-shell fixed inset-0 flex flex-col overflow-hidden">
  {/* Phase-reactive background */}
  <PhaseBackground />

  {/* Game HUD — always visible */}
  <GameHUD />

  {/* Persona Rail — visible on Stage and Backstage */}
  {(space === 'stage' || space === 'backstage') && (
    <PersonaRail ... />
  )}

  {/* Space content — animated page transitions */}
  <AnimatePresence mode="wait">
    {space === 'stage' && <StageChat ... />}
    {space === 'backstage' && <Backstage ... />}
    {space === 'dm-chat' && <DMChat ... />}
    {space === 'spotlight' && <Spotlight ... />}
    {space === 'new-dm' && <NewDmPicker ... />}
    {space === 'new-group' && <NewGroupPicker ... />}
  </AnimatePresence>

  {/* Cartridge overlay — only on Stage */}
  {space === 'stage' && <CartridgeOverlay ... />}

  {/* Dramatic reveal overlay — all spaces */}
  <DramaticReveal />

  {/* PWA gate */}
  <PwaGate token={token} />

  {/* Toaster */}
  <Toaster ... />
</div>
```

Page transitions (Framer Motion):
- Stage → Backstage: slide left (translateX)
- Backstage → Stage: slide right
- Any → Spotlight: zoom from avatar (shared element via layoutId)
- Any → DMChat: slide up
- DMChat → back: slide down

Navigation handlers:
- `handleSelectPlayer(id)` → if on Stage, navigate to DMChat. If on Backstage, navigate to DMChat.
- `handleSelectMainChat()` → navigate to Stage
- `handleSelectGroup(channelId)` → navigate to DMChat (group mode)
- `handleOpenSpotlight(id)` → navigate to Spotlight
- `handleBack()` → return to previous space (stack-based or Stage fallback)

**Step 2: Add PhaseBackground component**

Simple component that reads `serverState` from store and applies the phase-reactive CSS class:

```tsx
function PhaseBackground() {
  const serverState = useGameStore(s => s.serverState);
  const phaseClass = getPhaseClass(serverState); // maps to vivid-phase-* CSS classes
  return <div className={`fixed inset-0 transition-colors duration-2000 ${phaseClass} -z-10`} />;
}
```

**Step 3: Verify full build**

Run: `cd apps/client && npx vite build`
Expected: Clean build.

**Step 4: Manual verification**

Run the client dev server (`npm run dev` in `apps/client`) and verify:
- Shell loads with vivid colors
- HUD shows game state
- Persona rail scrolls horizontally
- Tapping a persona navigates to DM
- Main chat shows messages
- Backstage shows DM list
- Spotlight shows persona detail

**Step 5: Commit**

```
feat(vivid): wire VividShell orchestrator with space navigation and transitions
```

---

### Task 12: DramaticReveal (Vivid-styled)

**Files:**
- Create: `apps/client/src/shells/vivid/components/DramaticReveal.tsx`

**Reference:**
- `shells/immersive/components/DramaticReveal.tsx` — full reveal logic (elimination queue, winner detection, localStorage dedup, confetti)

**Step 1: Build DramaticReveal**

Same logic as immersive version but with vivid styling:
- Elimination: Skull icon (Phosphor `Skull`), red aura on avatar, `--vivid-pink` color theme, screen shake animation
- Winner: Crown icon (Phosphor `Crown`), gold confetti burst, `--vivid-gold` color theme, celebratory animation
- Background: Dark overlay with subtle radial gradient
- Tap to dismiss (same)
- localStorage dedup (same)

**Step 2: Verify**

Run: `cd apps/client && npx vite build`

**Step 3: Commit**

```
feat(vivid): add DramaticReveal with vivid-styled eliminations and winner
```

---

### Task 13: Context menu + long-press actions

**Files:**
- Create: `apps/client/src/shells/vivid/components/QuickActions.tsx`

**Reference:**
- `shells/immersive/components/ContextMenu.tsx` — long-press popover (send silver, view profile, message)

**Step 1: Build QuickActions**

Popover that appears on long-press of a persona in the rail or a chat bubble. Shows:
- "Message" (Phosphor `ChatCircleDots`, teal)
- "Send Silver" (Phosphor `CurrencyDollarSimple`, gold)
- "View Profile" (Phosphor `User`, lavender)

Uses Framer Motion for scale-in entrance. Backdrop click to dismiss. Position near the press point.

Same props/logic as immersive ContextMenu.

**Step 2: Verify**

Run: `cd apps/client && npx vite build`

**Step 3: Commit**

```
feat(vivid): add QuickActions popover for persona long-press
```

---

### Task 14: PerkFAB integration

**Files:**
- Check if `shells/immersive/components/PerkFAB.tsx` can be reused directly or needs vivid styling

**Reference:**
- `shells/immersive/components/PerkFAB.tsx` — perk purchase FAB

**Step 1: Evaluate and integrate**

If PerkFAB uses only skin-* classes, it may need vivid overrides. If it's too coupled to immersive styling, create a vivid-styled version.

Integrate into VividShell at the Stage space level.

**Step 2: Verify**

Run: `cd apps/client && npx vite build`

**Step 3: Commit**

```
feat(vivid): integrate PerkFAB with vivid styling
```

---

### Task 15: Final polish and verification

**Step 1: Run full build**

Run: `cd apps/client && npx vite build`
Expected: Clean build, all chunks generated.

**Step 2: Run speed-run to verify game flow**

Start the game server and client, run `/speed-run` to verify the full game lifecycle works with the Vivid shell. Check:
- [ ] Shell loads
- [ ] HUD updates with day/phase changes
- [ ] Main chat displays messages
- [ ] System events render as theatrical announcements
- [ ] Cartridge overlays appear for voting/games/prompts
- [ ] Chat peek works during cartridge
- [ ] DMs work (1:1 and group)
- [ ] Persona rail updates (online/offline, eliminated)
- [ ] Spotlight shows player details
- [ ] DramaticReveal fires for eliminations and winner
- [ ] Silver transfer works
- [ ] Page transitions are smooth

**Step 3: Commit**

```
feat(vivid): complete Vivid shell with all game mechanics
```
