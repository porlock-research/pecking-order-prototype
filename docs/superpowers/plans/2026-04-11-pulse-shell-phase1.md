# Pulse Shell — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Pulse shell with persona-first chat, broadcast ticker, pulse bar, emoji reactions, flat replies, slash commands, @mentions, whisper, nudge, avatar status rings, and motion language.

**Architecture:** New shell registered alongside Classic/Immersive/Vivid. All UI components built from scratch (no Vivid component reuse). Reuses shell-agnostic infrastructure: Zustand store, useGameEngine, cartridge panels, useCartridgeTheme. Server-side additions for REACT, NUDGE, WHISPER events handled as a dedicated task group.

**Tech Stack:** React 19, TypeScript, Zustand, Framer Motion, @use-gesture/react, lucide-react, Outfit font, Tailwind-free (inline styles + CSS variables)

**Spec:** `docs/superpowers/specs/2026-04-10-pulse-shell-design.md`
**Prototypes:** `docs/reports/pulse-mockups/08-full-interaction-prototype.html`

---

## File Structure

```
apps/client/src/shells/pulse/
  PulseShell.tsx              # Main shell — layout, tabs, overlays, phase awareness
  pulse-theme.css             # CSS vars (--pulse-*), --po-* mapping, Outfit font, dark+light
  springs.ts                  # Pulse spring/tap presets (distinct from Vivid's)
  colors.ts                   # Player color palette (10 fixed colors, round-robin by index)
  hooks/
    usePillStates.ts          # Derive pill lifecycle from store cartridge fields + manifest
    useTickerRetention.ts     # 60-minute time-based ticker retention
    useCommandBuilder.ts      # Slash command state machine (React state, not Zustand)
  components/
    Ticker.tsx                # Broadcast ticker — scrolling strip, event-reactive flashes
    PulseBar.tsx              # Horizontal pill strip with urgency escalation
    Pill.tsx                  # Single pill — lifecycle states, breathing dot, countdown
    TabBar.tsx                # Chat / Cast tab switcher
    StatusRing.tsx            # Animated presence ring for avatars
    AmbientBackground.tsx     # Subtle radial gradient + optional noise texture
    chat/
      ChatView.tsx            # Chat tab — message list, scroll mgmt, jump-to-latest
      MessageCard.tsx         # Persona-first message — portrait, nameplate, text
      ReactionTrigger.tsx     # ☺ button — visible tap target, scroll-safe
      ReactionBar.tsx         # Floating bar — 5 emojis + divider + reply button
      ReactionChips.tsx       # Emoji + mechanic chips below messages
      BroadcastCard.tsx       # Inline social event card (silver, nudge, etc.)
      WhisperCard.tsx         # Redacted "Someone whispered to X" card
    input/
      PulseInput.tsx          # Input bar — text field, send button, mode switching
      HintChips.tsx           # /silver /dm /nudge /whisper @mention chips
      CommandPicker.tsx       # 4-card action picker (silver, DM, nudge, whisper)
      PlayerPicker.tsx        # Portrait grid — medium images, 3 columns
      AmountPicker.tsx        # Silver amount buttons (5, 10, 25, 50)
      CommandPreview.tsx      # Styled preview bar: "💰 → Daisy · 10 silver"
      WhisperMode.tsx         # Purple-tinted input with lock icon
      ReplyBar.tsx            # "Replying to [Name]" indicator above input
      MentionRenderer.tsx     # Styled @Name inline text in messages
    popover/
      AvatarPopover.tsx       # Player action popover — Silver, DM, Nudge buttons
      SendSilverSheet.tsx     # Bottom sheet — amount picker, message, send
      NudgeConfirmation.tsx   # Full-screen nudge confirmation
    cast/
      CastGrid.tsx            # Portrait card grid (Phase 1: basic, Phase 2: full redesign)
      CastCard.tsx            # Single cast card — portrait, name, stats, actions
    dm/
      DMView.tsx              # Full-screen DM conversation
      GroupDMView.tsx         # Group DM conversation with stacked avatars
    reveals/
      EliminationReveal.tsx   # Full-screen elimination (from scratch)
      WinnerReveal.tsx        # Full-screen winner + confetti (from scratch)
      PhaseTransition.tsx     # Phase change interstitial (from scratch)

packages/shared-types/src/
  events.ts                   # Add Events.Social.REACT, NUDGE, WHISPER
  index.ts                    # Add schemas, fact types, ChatMessage.replyTo/whisperTarget/reactions

apps/game-server/src/
  machines/actions/l3-social.ts  # New handlers for REACT, NUDGE, WHISPER
  sync.ts                       # Reactions on messages, whisper projection
  demo/demo-sync.ts             # Mirror sync changes
  ws-handlers.ts                # ALLOWED_CLIENT_EVENTS whitelist
```

---

## Task Groups Overview

| Group | Tasks | Description |
|-------|-------|-------------|
| A | 1–4 | Server foundation — events, schemas, handlers, SYNC |
| B | 5–7 | Shell scaffold — registration, layout, theme, tabs |
| C | 8–9 | Broadcast ticker + Pulse bar |
| D | 10–12 | Chat view + message components |
| E | 13–15 | Reaction system (trigger, bar, chips) |
| F | 16–17 | Avatar popover + player actions |
| G | 18–21 | Slash commands + @mentions + whisper |
| H | 22–23 | DM views + send silver sheet |
| I | 24–25 | Status rings + motion polish |
| J | 26–27 | Dramatic reveals + phase transitions |

**Dependency order:** A (server) can run in parallel with B (scaffold). C–J depend on B. Within C–J, tasks are mostly independent — an agent executing in parallel should start with A+B, then fan out.

---

## Group A: Server Foundation

### Task 1: New Events and Types in shared-types

**Files:**
- Modify: `packages/shared-types/src/events.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Add event constants**

In `events.ts`, add to the `Social` namespace:
```typescript
REACT: 'SOCIAL.REACT',
NUDGE: 'SOCIAL.NUDGE',
WHISPER: 'SOCIAL.WHISPER',
```

- [ ] **Step 2: Add fact types**

In `index.ts`, add to the `FactType` enum (or const object):
```typescript
REACTION: 'REACTION',
NUDGE: 'NUDGE',
WHISPER: 'WHISPER',
```

- [ ] **Step 3: Update schemas**

In `index.ts`, update:

`ChatMessageSchema` — add fields:
```typescript
replyTo: z.string().optional(),         // messageId of the message being replied to
whisperTarget: z.string().optional(),   // playerId — if set, only sender+target see full content
reactions: z.record(z.string(), z.array(z.string())).optional(), // emoji → [reactorPlayerIds]
```

`SocialEventSchema` — add new event schemas for REACT, NUDGE, WHISPER:
```typescript
// REACT
{ type: Events.Social.REACT, messageId: z.string(), emoji: z.string() }
// NUDGE
{ type: Events.Social.NUDGE, targetId: z.string() }
// WHISPER
{ type: Events.Social.WHISPER, targetId: z.string(), text: z.string() }
// SEND_MSG — add optional replyTo
replyTo: z.string().optional()
```

Add new `FactSchema` entries for REACTION, NUDGE, WHISPER.

- [ ] **Step 4: Build shared-types and fix any type errors**

Run: `cd packages/shared-types && npm run build`

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): add REACT, NUDGE, WHISPER events and schemas for Pulse shell"
```

### Task 2: ALLOWED_CLIENT_EVENTS Whitelist

**Files:**
- Modify: `apps/game-server/src/ws-handlers.ts`

- [ ] **Step 1: Add new events to whitelist**

Find the `ALLOWED_CLIENT_EVENTS` array/set (ADR-025) and add:
```typescript
Events.Social.REACT,
Events.Social.NUDGE,
Events.Social.WHISPER,
```

- [ ] **Step 2: Commit**

```bash
git add apps/game-server/src/ws-handlers.ts
git commit -m "feat(game-server): allow REACT, NUDGE, WHISPER client events"
```

### Task 3: L3 Social Handlers

**Files:**
- Modify: `apps/game-server/src/machines/actions/l3-social.ts`
- Modify: `apps/game-server/src/machines/actions/social-helpers.ts` (if needed)
- Modify: `apps/game-server/src/machines/l3-session.ts` (register new handlers)

- [ ] **Step 1: Read existing L3 social handlers**

Read `l3-social.ts` and `l3-session.ts` to understand the handler pattern. L3 social handlers receive events forwarded from L2, process them, and update context (chatLog, channels, facts).

- [ ] **Step 2: Implement REACT handler**

In `l3-social.ts`, add handler for `Events.Social.REACT`:
- Validate: messageId exists in chatLog, emoji is from allowed set (😂 👀 🔥 💀 ❤️)
- Find the message in chatLog by messageId
- Add/toggle the reaction: if player already reacted with this emoji, remove it; otherwise add
- Store in message's `reactions` field: `Record<string, string[]>` (emoji → playerIds)
- Record REACTION fact: `{ type: FactType.REACTION, senderId, data: { messageId, emoji } }`

- [ ] **Step 3: Implement NUDGE handler**

Handler for `Events.Social.NUDGE`:
- Validate: targetId is a valid, alive player
- Rate limit: one nudge per sender→target per day (check facts for existing NUDGE today)
- Record NUDGE fact: `{ type: FactType.NUDGE, senderId, data: { targetId } }`
- Add ticker message: "PlayerName nudged TargetName"

- [ ] **Step 4: Implement WHISPER handler**

Handler for `Events.Social.WHISPER`:
- Validate: targetId is a valid, alive player; text is non-empty
- Add to MAIN channel chatLog as a ChatMessage with `whisperTarget: targetId`
- Record WHISPER fact: `{ type: FactType.WHISPER, senderId, data: { targetId } }`
- Add ticker message: "Someone whispered to TargetName" (anonymized)

- [ ] **Step 5: Implement replyTo on SEND_MSG**

Modify existing SEND_MSG handler:
- Accept optional `replyTo` field from payload
- If present, validate the referenced messageId exists in chatLog
- Store `replyTo` on the new ChatMessage

- [ ] **Step 6: Register handlers in L3 machine**

In `l3-session.ts`, add the new handlers to the appropriate state/event mapping so L3 routes REACT, NUDGE, WHISPER events to the handlers.

- [ ] **Step 7: Build and test**

Run: `cd apps/game-server && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add apps/game-server/src/machines/
git commit -m "feat(game-server): L3 handlers for reactions, nudge, whisper, replyTo"
```

### Task 4: SYNC Builder Changes

**Files:**
- Modify: `apps/game-server/src/sync.ts`
- Modify: `apps/game-server/src/demo/demo-sync.ts`

- [ ] **Step 1: Read buildSyncPayload**

Read `sync.ts` to understand how the SYNC payload is assembled per-player. The payload already does per-player filtering (e.g., DM channels only include members).

- [ ] **Step 2: Add reactions to ChatMessage in SYNC**

Reactions are already stored on ChatMessage objects in L3 context. Ensure they're included in the SYNC payload — the `reactions` field should pass through to the client in each message. No filtering needed (reactions are public).

- [ ] **Step 3: Add whisper visibility projection**

In `buildSyncPayload(playerId, ...)`:
- When building the chatLog array, for each message with `whisperTarget`:
  - If `playerId === senderId || playerId === whisperTarget` → include full message
  - Otherwise → replace with redacted version: `{ ...msg, text: '', whisperTarget: msg.whisperTarget, redacted: true }`
- The client renders redacted whispers as "🤫 Someone whispered to [Name]"

- [ ] **Step 4: Mirror changes in DemoServer**

Apply the same reactions passthrough and whisper projection logic to `buildDemoSyncPayload()` in `demo/demo-sync.ts`.

- [ ] **Step 5: Build and verify**

Run: `cd apps/game-server && npx tsc --noEmit && npx vitest run`

- [ ] **Step 6: Commit**

```bash
git add apps/game-server/src/sync.ts apps/game-server/src/demo/
git commit -m "feat(game-server): SYNC builder — reactions on messages, whisper projection"
```

---

## Group B: Shell Scaffold

### Task 5: Shell Registration and Theme

**Files:**
- Create: `apps/client/src/shells/pulse/pulse-theme.css`
- Create: `apps/client/src/shells/pulse/springs.ts`
- Create: `apps/client/src/shells/pulse/colors.ts`
- Modify: `apps/client/src/shells/registry.ts`

- [ ] **Step 1: Create pulse-theme.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

.pulse-shell {
  /* Pulse palette */
  --pulse-bg: #0a0a0e;
  --pulse-surface: #13131a;
  --pulse-surface-2: #1a1a24;
  --pulse-surface-3: #1e1e2a;
  --pulse-text-1: #f0f0f0;
  --pulse-text-2: #999;
  --pulse-text-3: #555;
  --pulse-text-4: #333;
  --pulse-accent: #ff3b6f;
  --pulse-accent-glow: rgba(255, 59, 111, 0.15);
  --pulse-gold: #ffd700;
  --pulse-gold-glow: rgba(255, 215, 0, 0.12);
  --pulse-nudge: #ffa500;
  --pulse-whisper: #9b59b6;
  --pulse-border: rgba(255, 255, 255, 0.04);

  /* --po-* skin contract for cartridges */
  --po-bg-deep: var(--pulse-bg);
  --po-bg-panel: var(--pulse-surface);
  --po-bg-input: var(--pulse-surface-2);
  --po-bg-bubble: var(--pulse-surface-3);
  --po-text: var(--pulse-text-1);
  --po-text-dim: var(--pulse-text-3);
  --po-gold: var(--pulse-gold);
  --po-pink: var(--pulse-accent);
  --po-border: var(--pulse-border);
  --po-font-display: 'Outfit', sans-serif;
  --po-font-body: 'Outfit', sans-serif;

  font-family: 'Outfit', sans-serif;
  background: var(--pulse-bg);
  color: var(--pulse-text-1);
}

.pulse-shell[data-theme="light"] {
  --pulse-bg: #f2f2f6;
  --pulse-surface: #f0f0f4;
  --pulse-surface-2: #e8e8ee;
  --pulse-surface-3: #e0e0e8;
  --pulse-text-1: #1a1a22;
  --pulse-text-2: #666;
  --pulse-text-3: #999;
  --pulse-text-4: #ccc;
  --pulse-border: rgba(0, 0, 0, 0.06);
}
```

- [ ] **Step 2: Create springs.ts**

```typescript
export const PULSE_SPRING = {
  bouncy: { stiffness: 400, damping: 25 },
  snappy: { stiffness: 500, damping: 30 },
  gentle: { stiffness: 150, damping: 20 },
  page: { stiffness: 300, damping: 28, mass: 0.8 },
  pop: { stiffness: 600, damping: 15 }, // for reaction feedback
} as const;

export const PULSE_TAP = {
  button: { scale: 0.95 },
  card: { scale: 0.97 },
  pill: { scale: 0.98 },
} as const;
```

- [ ] **Step 3: Create colors.ts**

```typescript
export const PLAYER_COLORS = [
  '#e8a87c', '#7ec8a0', '#e85d75', '#8b9dc3', '#b19cd9',
  '#e0a060', '#6ec6c8', '#c97ab5', '#a0c878', '#d4a76a',
] as const;

export function getPlayerColor(index: number): string {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}
```

- [ ] **Step 4: Register shell**

In `registry.ts`, add:
```typescript
{
  id: 'pulse',
  name: 'Pulse',
  load: () => import('./pulse/PulseShell'),
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/ apps/client/src/shells/registry.ts
git commit -m "feat(client): register Pulse shell with theme, springs, colors"
```

### Task 6: PulseShell Layout

**Files:**
- Create: `apps/client/src/shells/pulse/PulseShell.tsx`
- Create: `apps/client/src/shells/pulse/components/TabBar.tsx`
- Create: `apps/client/src/shells/pulse/components/AmbientBackground.tsx`

- [ ] **Step 1: Create PulseShell**

Main layout component. Imports `pulse-theme.css`. Structure:

```typescript
import './pulse-theme.css';
import type { ShellProps } from '../types';

export default function PulseShell({ playerId, engine, token }: ShellProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'cast'>('chat');
  const phase = useGameStore(s => s.phase);

  return (
    <div className="pulse-shell" style={{
      display: 'flex', flexDirection: 'column', height: '100dvh',
      position: 'relative', overflow: 'hidden',
    }}>
      <AmbientBackground />
      <Ticker />
      <PulseBar />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'chat' ? <ChatView /> : <CastGrid />}
      </div>
      <PulseInput />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Overlays */}
      <EliminationReveal />
      <WinnerReveal />
      <PhaseTransition />
    </div>
  );
}
```

- [ ] **Step 2: Create TabBar**

Two tabs: Chat (💬) and Cast (👥). Active tab gets accent color.

- [ ] **Step 3: Create AmbientBackground**

Subtle radial gradient overlay:
```typescript
export function AmbientBackground() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      background: 'radial-gradient(ellipse at center, rgba(255,59,111,0.015) 0%, transparent 70%)',
    }} />
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/
git commit -m "feat(client): PulseShell layout with tabs and ambient background"
```

### Task 7: Engine and Store Wiring

**Files:**
- Modify: `apps/client/src/shells/pulse/PulseShell.tsx`

- [ ] **Step 1: Wire store and engine**

PulseShell receives `engine` via ShellProps. Wire up:
- `useGameStore` for all state (roster, chatLog, onlinePlayers, tickerMessages, phase, etc.)
- Engine methods passed down via React context or prop drilling to child components
- Check `phase` to disable interactions during non-social phases (nightSummary etc.)

Create a `PulseContext` that provides engine + playerId to all children:
```typescript
export const PulseContext = createContext<{
  engine: GameEngine;
  playerId: string;
}>(null!);
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/
git commit -m "feat(client): PulseContext for engine and playerId"
```

---

## Group C: Broadcast Ticker + Pulse Bar

### Task 8: Broadcast Ticker

**Files:**
- Create: `apps/client/src/shells/pulse/components/Ticker.tsx`
- Create: `apps/client/src/shells/pulse/hooks/useTickerRetention.ts`

- [ ] **Step 1: Create useTickerRetention hook**

Filters `tickerMessages` from store to last 60 minutes:
```typescript
export function useTickerRetention() {
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const cutoff = Date.now() - 60 * 60 * 1000;
  return useMemo(
    () => tickerMessages.filter(m => new Date(m.timestamp).getTime() > cutoff),
    [tickerMessages, cutoff]
  );
}
```

- [ ] **Step 2: Create Ticker component**

Horizontally scrolling strip. CSS `animation: scroll` with dynamic duration based on content length.

Key features:
- Player names in accent color with 18x18 headshot avatars
- Event-reactive: when a new message arrives (detect via `useRef` comparing prev length), briefly flash the ticker background — gold sweep for silver events, coral for social
- Tapping a ticker item calls `requestNavigation` to navigate to relevant context
- Height: ~30px, border-bottom subtle

Use persona image URLs from `roster[playerId].avatarUrl` in the store.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/
git commit -m "feat(client): Pulse broadcast ticker with event-reactive flashes"
```

### Task 9: Pulse Bar + Pills

**Files:**
- Create: `apps/client/src/shells/pulse/components/PulseBar.tsx`
- Create: `apps/client/src/shells/pulse/components/Pill.tsx`
- Create: `apps/client/src/shells/pulse/hooks/usePillStates.ts`

- [ ] **Step 1: Create usePillStates hook**

Derives pill data from store fields:
```typescript
export function usePillStates(): PillState[] {
  const voting = useGameStore(s => s.activeVotingCartridge);
  const game = useGameStore(s => s.activeGameCartridge);
  const prompt = useGameStore(s => s.activePromptCartridge);
  const dilemma = useGameStore(s => s.activeDilemmaCartridge);
  const completed = useGameStore(s => s.completedCartridges);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  // Derive: active → lifecycle state, upcoming from manifest timeline, completed
  // Return array sorted chronologically
}
```

`PillState` type:
```typescript
type PillLifecycle = 'upcoming' | 'starting' | 'just-started' | 'needs-action' | 'urgent' | 'in-progress' | 'completed';
interface PillState {
  id: string;
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  label: string;
  lifecycle: PillLifecycle;
  timeRemaining?: number; // seconds
  progress?: string; // e.g., "5/7"
  playerActed?: boolean;
}
```

- [ ] **Step 2: Create Pill component**

Renders a single pill. Key features:
- Visual treatment per lifecycle state (see spec table)
- Breathing dot (CSS animation, speed increases with urgency)
- Color shift: accent → gold → danger as `timeRemaining` decreases
- Under 30s: gentle whole-pill scale pulse (1.0 → 1.02 at 1Hz)
- Tappable: opens cartridge takeover or splash

- [ ] **Step 3: Create PulseBar**

Horizontal scrollable strip of `<Pill>` components. When a cartridge is expanded:
- Shrinks to mini-bar (smaller pills, icon + timer only)
- Active pill highlighted
- Other pills still tappable

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/
git commit -m "feat(client): Pulse bar with pill lifecycle states and urgency escalation"
```

---

## Group D: Chat View + Messages

### Task 10: ChatView

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/ChatView.tsx`

- [ ] **Step 1: Create ChatView**

Main chat container. Uses `useTimeline` or `selectMainChat` from store.

Features:
- Message grouping: same sender within 2min → grouped (no repeated avatar/name)
- Time separators: 5min gap → show timestamp
- Scroll management: auto-scroll on new messages, "Jump to latest" pill when scrolled up
- Optimistic messages: local-echo with 5s timeout
- Phase-aware: show "Chat opens at dawn" when phase is non-social

Renders `<MessageCard>` for each message, `<BroadcastCard>` for social events, `<WhisperCard>` for redacted whispers.

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/
git commit -m "feat(client): Pulse ChatView with message grouping and scroll management"
```

### Task 11: MessageCard

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/MessageCard.tsx`

- [ ] **Step 1: Create MessageCard**

Persona-first layout:
- 48x48 rectangular portrait (`borderRadius: 12px`, `objectFit: 'cover'`)
- Avatar has `StatusRing` overlay (online presence)
- Avatar is tappable → opens `AvatarPopover`
- Name plate: bold name (per-player color from `colors.ts`) + stereotype in muted text
- Message text: 14px, `--pulse-text-2` color
- No bubble background on incoming (text floats next to portrait)
- Self messages: right-aligned, tinted background bubble
- If `replyTo` is present: show reply indicator (colored bar + "Replying to [Name]" + quoted snippet)
- Contains `<ReactionTrigger>` and `<ReactionChips>`

Avatar image: `roster[senderId].avatarUrl` from store. Stereotype: `roster[senderId].personaName` or similar field.

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/
git commit -m "feat(client): Pulse MessageCard with persona-first layout"
```

### Task 12: BroadcastCard + WhisperCard

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/BroadcastCard.tsx`
- Create: `apps/client/src/shells/pulse/components/chat/WhisperCard.tsx`

- [ ] **Step 1: Create BroadcastCard**

Inline card for silver transfers, nudges, perk uses:
- Overlapping 24x24 headshots of sender/recipient
- Descriptive text: "Brenda sent Brick 💰 10 silver"
- Entrance animation: slide-in from left with spring overshoot
- Gold shimmer on silver events (background-position animation on linear gradient)
- Framer Motion `motion.div` with `initial/animate` and `PULSE_SPRING.bouncy`

- [ ] **Step 2: Create WhisperCard**

Redacted whisper card:
- Purple-tinted background (`--pulse-whisper` glow)
- "🤫 Someone whispered to [Name]"
- Name in accent color, tappable (opens avatar popover)

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/
git commit -m "feat(client): BroadcastCard and WhisperCard with entrance animations"
```

---

## Group E: Reaction System

### Task 13: ReactionTrigger

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/ReactionTrigger.tsx`

- [ ] **Step 1: Create ReactionTrigger**

The `☺` button. Positioned absolute top-right of message text:
- 28x28px, border-radius 50%, subtle muted color
- Desktop: opacity 0, visible on message hover
- Mobile (`@media (hover: none)`): always 45% opacity
- Tap opens `<ReactionBar>` floating above the message
- When bar is open: accent-tinted background, full opacity
- First message: CSS `hint-pulse` animation (3 cycles of coral glow)

State management: parent ChatView tracks which messageId has the bar open (only one at a time).

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/
git commit -m "feat(client): ReactionTrigger — visible tap target for reactions"
```

### Task 14: ReactionBar

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/ReactionBar.tsx`

- [ ] **Step 1: Create ReactionBar**

Floating bar that appears above a message when ☺ is tapped:
- Spring entrance: `PULSE_SPRING.pop` with scale 0.9→1, translateY 8→0
- Content: `😂 👀 🔥 💀 ❤️ | ↩ Reply`
- Emojis: 36x36 tap targets, scale 1.2 on hover, scale 0.9 on press
- Divider: 1px vertical line
- Reply button: `↩` icon + "Reply" micro-label below
- Click-outside dismisses (invisible full-screen overlay behind)

On emoji tap:
- Call `engine.send(Events.Social.REACT, { messageId, emoji })`
- Micro-feedback: tapped emoji scales 1.0 → 1.4 → 1.0 with `PULSE_SPRING.pop`
- Close bar

On reply tap:
- Set reply mode in PulseInput (show ReplyBar with quoted message)
- Close bar, focus input

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/
git commit -m "feat(client): ReactionBar with emoji reactions and reply button"
```

### Task 15: ReactionChips

**Files:**
- Create: `apps/client/src/shells/pulse/components/chat/ReactionChips.tsx`

- [ ] **Step 1: Create ReactionChips**

Row below message text showing emoji chips + mechanic chips + `+` button:
- Emoji chip: pill with emoji + count. Own reactions get accent border. Tap to toggle (+1/-1).
- Mechanic chips: gold-tinted (silver), coral (DM), orange (nudge) with tiny avatar of the actor
- `+` button (22x22, circle): opens ReactionBar same as ☺ trigger
- New chips pop in with spring animation
- Count increments with brief flip animation

Reads `message.reactions` from the chatLog in store.

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/chat/
git commit -m "feat(client): ReactionChips with emoji and mechanic chip rendering"
```

---

## Group F: Avatar Popover + Player Actions

### Task 16: AvatarPopover

**Files:**
- Create: `apps/client/src/shells/pulse/components/popover/AvatarPopover.tsx`

- [ ] **Step 1: Create AvatarPopover**

Floating popover near the tapped avatar:
- Positioned dynamically based on avatar's bounding rect
- Player image (40x40, rounded rect) with subtle parallax shift on appear
- Name (in player color) + stereotype
- Faint border in player's name color
- Three action buttons in a row, staggered entrance (50ms each):
  - 💰 Silver (gold) → opens SendSilverSheet
  - 💬 DM (coral) → navigates to DM view
  - 👋 Nudge (orange) → sends nudge immediately, shows toast
- Spring entrance with `PULSE_SPRING.bouncy`
- Click-outside dismisses

Phase-aware: disable all buttons during non-social phases.

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/popover/
git commit -m "feat(client): AvatarPopover with player actions"
```

### Task 17: SendSilverSheet + NudgeConfirmation

**Files:**
- Create: `apps/client/src/shells/pulse/components/popover/SendSilverSheet.tsx`
- Create: `apps/client/src/shells/pulse/components/popover/NudgeConfirmation.tsx`

- [ ] **Step 1: Create SendSilverSheet**

Bottom sheet (use `vaul` Drawer or custom):
- Recipient's medium persona image, name, stereotype
- Amount chips: 5, 10, 25, 50 (gold-bordered)
- Optional message field
- Gold gradient send button
- Your balance at bottom
- On send: `engine.sendSilver(targetId, amount, message)`

- [ ] **Step 2: Create NudgeConfirmation**

Full-screen confirmation overlay:
- Wave emoji, portrait, name, stereotype
- "You nudged [Name]!"
- Two buttons: "Done" (dismiss) + "Send DM →"
- On nudge: `engine.send(Events.Social.NUDGE, { targetId })`

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/popover/
git commit -m "feat(client): SendSilverSheet and NudgeConfirmation"
```

---

## Group G: Slash Commands + @Mentions + Whisper

### Task 18: PulseInput + HintChips

**Files:**
- Create: `apps/client/src/shells/pulse/components/input/PulseInput.tsx`
- Create: `apps/client/src/shells/pulse/components/input/HintChips.tsx`
- Create: `apps/client/src/shells/pulse/hooks/useCommandBuilder.ts`

- [ ] **Step 1: Create useCommandBuilder hook**

State machine for the command builder flow:
```typescript
type CommandMode =
  | { mode: 'idle' }
  | { mode: 'command-picker' }
  | { mode: 'player-picker'; command: Command; context: string }
  | { mode: 'amount-picker'; command: 'silver'; player: SocialPlayer }
  | { mode: 'preview'; command: 'silver'; player: SocialPlayer; amount: number }
  | { mode: 'whisper'; player: SocialPlayer }
  | { mode: 'reply'; replyTo: ChatMessage };

type Command = 'silver' | 'dm' | 'nudge' | 'whisper';
```

Hook returns `{ mode, dispatch }` where dispatch handles transitions:
- `openCommandPicker()`, `selectCommand(cmd)`, `selectPlayer(player)`, `selectAmount(amt)`, `cancel()`, `startReply(msg)`

- [ ] **Step 2: Create PulseInput**

The input area. Switches between modes:
- `idle`: text input + send button, HintChips above
- `command-picker`: CommandPicker overlay
- `player-picker`: PlayerPicker overlay
- `amount-picker`: AmountPicker overlay
- `preview`: CommandPreview replaces text input
- `whisper`: WhisperMode replaces text input
- `reply`: ReplyBar appears above input

Text input: on typing `/` → dispatch `openCommandPicker()`. On typing `@` → dispatch `selectCommand('mention')`.

- [ ] **Step 3: Create HintChips**

Row of tappable chips: `/silver`, `/dm`, `/nudge`, `/whisper`, `@mention`. Color-coded per action type. Visible when input is idle/empty.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/components/input/ apps/client/src/shells/pulse/hooks/
git commit -m "feat(client): PulseInput with command builder state machine and hint chips"
```

### Task 19: CommandPicker + PlayerPicker + AmountPicker

**Files:**
- Create: `apps/client/src/shells/pulse/components/input/CommandPicker.tsx`
- Create: `apps/client/src/shells/pulse/components/input/PlayerPicker.tsx`
- Create: `apps/client/src/shells/pulse/components/input/AmountPicker.tsx`

- [ ] **Step 1: Create CommandPicker**

Four action cards in a horizontal row:
- 💰 Silver, 💬 DM, 👋 Nudge, 🤫 Whisper
- Each card: icon, name, one-line description
- Color-coded backgrounds on hover
- Tap → dispatch `selectCommand(cmd)` → transitions to PlayerPicker

- [ ] **Step 2: Create PlayerPicker**

3-column portrait grid:
- Uses medium persona images (not headshots) — `avatarUrl` with `/medium.png` suffix
- Images fill the card area (`objectFit: 'cover'`, ~72px height)
- Player name below (in player color)
- Back arrow + breadcrumb header (e.g., "💰 Silver — pick a player")
- Portraits cascade in (30ms stagger via Framer Motion)
- Tap → execute action or transition to next step

- [ ] **Step 3: Create AmountPicker**

For `/silver` only. Four amount buttons: 5, 10, 25, 50.
- Gold-bordered, gold text
- Back arrow + breadcrumb ("💰 Silver → Daisy — amount")
- Tap → dispatch `selectAmount(amt)` → transitions to CommandPreview

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/components/input/
git commit -m "feat(client): CommandPicker, PlayerPicker, AmountPicker for slash commands"
```

### Task 20: CommandPreview + WhisperMode + ReplyBar

**Files:**
- Create: `apps/client/src/shells/pulse/components/input/CommandPreview.tsx`
- Create: `apps/client/src/shells/pulse/components/input/WhisperMode.tsx`
- Create: `apps/client/src/shells/pulse/components/input/ReplyBar.tsx`

- [ ] **Step 1: Create CommandPreview**

Replaces the text input when a command is fully built:
- Shows: `💰 [avatar] → Daisy · 10 silver`
- Gold send button (replaces normal accent send)
- ✕ cancel button
- On send: execute the action (`engine.sendSilver(...)`) and reset to idle

- [ ] **Step 2: Create WhisperMode**

Replaces the text input when whisper target is selected:
- Lock icon (🔒) on left
- Purple-tinted input field with "Whisper to [Name]..." placeholder
- Purple send button
- ✕ cancel
- Faint purple vignette at phone edges (CSS box-shadow: inset on shell root)
- On send: `engine.send(Events.Social.WHISPER, { targetId, text })`

- [ ] **Step 3: Create ReplyBar**

Appears above the input when replying:
- Colored bar (player's color) + "Replying to [Name]" + quoted text snippet
- ✕ close button
- On send: include `replyTo: messageId` in the sendMessage payload

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/components/input/
git commit -m "feat(client): CommandPreview, WhisperMode, ReplyBar"
```

### Task 21: @Mentions + MentionRenderer

**Files:**
- Create: `apps/client/src/shells/pulse/components/input/MentionRenderer.tsx`

- [ ] **Step 1: Implement @mention in PlayerPicker**

When the command context is `'mention'`:
- PlayerPicker header: "@ Mention a player"
- On player select: insert `@FirstName` text into the input field (styled as inline mention)
- Return to idle mode, focus input

- [ ] **Step 2: Create MentionRenderer**

Renders `@Name` tokens in message text:
- Parse message text for `@PlayerName` patterns
- Render as styled spans with player's color, bold weight
- Tappable → opens AvatarPopover for that player

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/input/
git commit -m "feat(client): @mentions with PlayerPicker and MentionRenderer"
```

---

## Group H: DM Views

### Task 22: DMView + GroupDMView

**Files:**
- Create: `apps/client/src/shells/pulse/components/dm/DMView.tsx`
- Create: `apps/client/src/shells/pulse/components/dm/GroupDMView.tsx`

- [ ] **Step 1: Create DMView**

Full-screen conversation overlay:
- Header: 44x44 rounded-rect portrait, name + stereotype + online status, Silver + Nudge quick buttons
- Messages: same MessageCard component as main chat
- Self messages right-aligned with tinted bubble
- "🔒 Private conversation" subtle indicator below header
- Back button → return to chat
- Uses `engine.sendToChannel(channelId, text)` or `engine.sendFirstMessage(targetId, text)`

- [ ] **Step 2: Create GroupDMView**

Same as DMView but:
- Overlapping portrait stack in header (3 portraits, stacked with offset)
- Shows group name and member list
- Uses `engine.sendToChannel(channelId, text)`

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/dm/
git commit -m "feat(client): DMView and GroupDMView for Pulse shell"
```

### Task 23: Cast Grid (Phase 1 basic version)

**Files:**
- Create: `apps/client/src/shells/pulse/components/cast/CastGrid.tsx`
- Create: `apps/client/src/shells/pulse/components/cast/CastCard.tsx`

- [ ] **Step 1: Create CastCard**

Portrait card for one player:
- Medium persona image as card header (130px height, `objectFit: 'cover'`)
- `StatusRing` on the image
- Name (bold, player color), stereotype (uppercase muted)
- Stats row: silver balance, online/offline
- Action buttons: DM, Silver, Nudge (one tap each)
- Eliminated players: grayscale filter, 60% opacity, scale 0.95, DM disabled

- [ ] **Step 2: Create CastGrid**

2-column grid of CastCards. Uses `selectSortedPlayers` selector (alive sorted by silver desc, then eliminated).

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/cast/
git commit -m "feat(client): CastGrid and CastCard for Pulse shell"
```

---

## Group I: Status Rings + Motion Polish

### Task 24: StatusRing

**Files:**
- Create: `apps/client/src/shells/pulse/components/StatusRing.tsx`

- [ ] **Step 1: Create StatusRing**

Thin animated ring around avatars:
- Wraps any avatar image as a parent container
- State derived from `onlinePlayers` store field:
  - Online: soft breathing pulse (opacity oscillation on box-shadow, 2s cycle)
  - Offline: no ring
- Phase-aware: brighter/faster pulse during active game phase
- CSS-only animations for performance

```typescript
interface StatusRingProps {
  playerId: string;
  size: number; // avatar size
  children: React.ReactNode; // the avatar image
}
```

- [ ] **Step 2: Apply to MessageCard and CastCard avatars**

Wrap avatar images in `<StatusRing>` in both components.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/
git commit -m "feat(client): StatusRing with breathing presence animation"
```

### Task 25: Motion Polish Pass

**Files:**
- Modify: various Pulse components

- [ ] **Step 1: Broadcast card entrance**

In `BroadcastCard.tsx`: ensure Framer Motion `motion.div` with `initial={{ opacity: 0, x: -20, scale: 0.95 }}`, `animate={{ opacity: 1, x: 0, scale: 1 }}`, `transition={PULSE_SPRING.bouncy}`.

Gold shimmer on silver events:
```css
background: linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.08) 50%, transparent 100%);
background-size: 200% 100%;
animation: shimmer 1.5s ease forwards;
```

- [ ] **Step 2: Reaction chip pop-in**

In `ReactionChips.tsx`: new chips animate with `initial={{ scale: 0 }}`, `animate={{ scale: 1 }}`, `transition={PULSE_SPRING.pop}`.

- [ ] **Step 3: Player picker cascade**

In `PlayerPicker.tsx`: each card gets `transition={{ delay: index * 0.03 }}` for staggered entrance.

- [ ] **Step 4: Pill urgency animations**

In `Pill.tsx`: CSS keyframes for breathing dot speed increase. Under 30s: `animation: pill-pulse 1s ease-in-out infinite`.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/shells/pulse/
git commit -m "feat(client): motion polish — entrances, cascades, urgency, shimmer"
```

---

## Group J: Dramatic Reveals + Phase Transitions

### Task 26: EliminationReveal + WinnerReveal

**Files:**
- Create: `apps/client/src/shells/pulse/components/reveals/EliminationReveal.tsx`
- Create: `apps/client/src/shells/pulse/components/reveals/WinnerReveal.tsx`

- [ ] **Step 1: Create EliminationReveal**

Full-screen overlay (z-index 60). Triggered by store state (eliminated player appears).
- Eliminated player's large persona image, centered
- Image desaturates with CSS `filter: grayscale(1)` transition (500ms)
- Screen edges pulse red (box-shadow: inset)
- Player name + "Eliminated" text
- Tap to dismiss
- Persist "seen" state in localStorage to avoid re-showing

Build from scratch — do NOT reference Vivid's DramaticReveal.

- [ ] **Step 2: Create WinnerReveal**

Full-screen overlay (z-index 60). Triggered by winner in store.
- Winner's large persona image with gold glow
- Crown emoji, "Winner!" text
- `canvas-confetti` burst on appear
- Tap to dismiss

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/pulse/components/reveals/
git commit -m "feat(client): EliminationReveal and WinnerReveal for Pulse shell"
```

### Task 27: PhaseTransition

**Files:**
- Create: `apps/client/src/shells/pulse/components/reveals/PhaseTransition.tsx`

- [ ] **Step 1: Create PhaseTransition**

Full-screen interstitial on phase changes (z-index 70):
- Detect phase changes via store `phase` field (compare with prev via useRef)
- Phase-specific: icon, title, subtitle (e.g., "☀️ Morning" / "🗳️ Voting Time" / "🌙 Night")
- Brief display (3s auto-dismiss or tap to dismiss)
- Spring entrance (scale 0.95 → 1.0)
- Pulse palette colors throughout

Build from scratch — do NOT reference Vivid's PhaseTransitionSplash.

- [ ] **Step 2: Commit**

```bash
git add apps/client/src/shells/pulse/components/reveals/
git commit -m "feat(client): PhaseTransition splash for Pulse shell"
```

---

## Final Integration

### Task 28: Wiring + Smoke Test

- [ ] **Step 1: Wire all components into PulseShell**

Ensure PulseShell imports and renders all components. Verify:
- Ticker → PulseBar → ChatView/CastGrid → PulseInput → TabBar
- Overlays: AvatarPopover, SendSilverSheet, NudgeConfirmation, DMView, GroupDMView
- Reveals: EliminationReveal, WinnerReveal, PhaseTransition

- [ ] **Step 2: Build the client**

Run: `cd apps/client && npm run build`
Fix any TypeScript or build errors.

- [ ] **Step 3: Smoke test locally**

Run: `npm run dev` (all apps)
- Open `http://localhost:5173` in browser
- Switch shell to Pulse (localStorage `po_shell` = `pulse` or shell picker if available)
- Verify: layout renders, ticker scrolls, pills show, messages display, reactions work, slash commands open, whisper mode activates

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/shells/pulse/
git commit -m "feat(client): Pulse shell Phase 1 integration and wiring"
```

---

## Phase 2–4 Briefs

These briefs capture enough context for a future agent to write detailed implementation plans.

### Phase 2: Roster Redesign

**Goal:** Transform the Cast tab from a basic grid into a social dashboard with relationship context, elimination animations, and silver economy polish.

**Dependencies:** Phase 1 Cast grid + status rings are the foundation.

**Scope:**
1. **Cast card enhancement** — relationship hints ("You've DM'd 8 times", "Sent you 5 silver"), activity indicators, enhanced stats
2. **Elimination animations** — red vignette flash, photo desaturates (500ms), card shrinks (scale 0.95, opacity 0.6), one-time "shatter" CSS animation
3. **Silver economy feel** — coin/sparkle particle trail on send, silver counter pulses gold on receive, gold gradient sweep on transfer cards
4. **Avatar status rings (enhanced)** — power holder gold ring, "just voted" coral flash, in-live-game faster pulse

**Key store fields:** `roster` (silver, gold, status), `onlinePlayers`, `playerActivity`, `completedCartridges` (for relationship derivation)

**Files to modify:**
- `shells/pulse/components/cast/CastCard.tsx` — add hints, enhanced stats, elimination animation
- `shells/pulse/components/cast/CastGrid.tsx` — add filtering, sorting controls
- `shells/pulse/components/StatusRing.tsx` — add power/voted/eliminated states
- `shells/pulse/components/popover/SendSilverSheet.tsx` — add particle trail

**Server changes:** None — all data is already in SYNC.

---

### Phase 3: Game Master Intelligence

**Goal:** Server-side observation module that generates contextual hints for each player based on social graph analysis.

**Dependencies:** Phase 1 reactions/nudge/whisper provide the fact stream. Phase 2 Cast cards provide the rendering surface.

**Scope:**
1. **`social-intelligence.ts` module** — implements `ObservationModule<TState>` alongside existing `inactivity.ts`
2. **Fact processing** — tracks DM frequency, silver patterns, voting patterns, reaction patterns, activity levels, nudge patterns
3. **Hint generation** — deterministic rules producing `GameMasterAction` items of type `HINT`
4. **HINT delivery** — included in SYNC payload, rendered on Cast cards. High-priority hints delivered as GM DMs via `INJECT_PROMPT`
5. **shared-types changes** — new `GameMasterActionTypes.HINT`, hint schema

**Key architectural notes (from spec review):**
- The game-master machine has NO plugin architecture — `inactivityModule` is a hardcoded singleton with manual delegation at 4 points (init, onResolveDay in pregame+tournament, DAY_ENDED, FACT.RECORD)
- `GameMasterActionTypes` currently only has `ELIMINATE` — adding `HINT` requires shared-types changes + L2 orchestrator handler
- The `onResolveDay` arrays from both modules need merging

**Files to create:**
- `apps/game-server/src/machines/observations/social-intelligence.ts`

**Files to modify:**
- `apps/game-server/src/machines/game-master.ts` — integrate new module
- `packages/shared-types/src/index.ts` — add HINT action type + schema
- `apps/game-server/src/sync.ts` — include hints in SYNC
- `apps/client/src/shells/pulse/components/cast/CastCard.tsx` — render hints

**Data available for hint generation:**
- `CHAT_MSG`, `DM_SENT`, `SILVER_TRANSFER`, `VOTE_CAST`, `PERK_USED`, `REACTION` (new), `NUDGE` (new), `WHISPER` (new)
- Player bios/Q&A: `SocialPlayer.qaAnswers` in roster

---

### Phase 4: Catch-up & Deep Linking

**Goal:** Push notification deep-linking and "what you missed" awareness system.

**Dependencies:** Phase 1 pulse bar catch-up states. Phase 1 push notification infrastructure.

**Scope:**
1. **Deep-link routing** — each push notification includes `target` field. Shell checks on mount and navigates: vote → expanded vote pill, DM → DM view, game → game pill, nudge → nudger's cast card, elimination → reveal
2. **"What you missed" indicators** — pulse bar pills show count badges for unseen events, completed events with results. Ticker shows recent events (not just live). Chat has "jump to new messages" pill. Cast tab shows updated context ("Brenda sent Brick 10 silver while you were away")
3. **Push notification enhancement** — include `target` field in push payload. Nudge worker formats per notification type.
4. **Session persistence** — track `lastSeenTimestamp` per section (chat, pills, cast) to determine what's "new"

**Files to modify:**
- `apps/client/src/shells/pulse/PulseShell.tsx` — deep-link routing on mount
- `apps/client/src/shells/pulse/hooks/usePillStates.ts` — catch-up badge logic
- `apps/client/src/shells/pulse/components/Ticker.tsx` — show recent events for returning players
- `apps/client/src/shells/pulse/components/chat/ChatView.tsx` — "jump to new" pill
- `apps/nudge-worker/` — add target field to push payloads
- `apps/client/src/hooks/usePushNotifications.ts` — handle deep-link targets

**Store fields used:** `lastSeenFeedTimestamp`, `dashboardSeenForDay`, `tickerMessages`, `completedCartridges`

---

*End of plan. Phases 2–4 briefs provide goals, dependencies, scope, architectural notes, and file maps — enough for a future agent to expand into detailed task-level plans without re-reading the full spec.*
