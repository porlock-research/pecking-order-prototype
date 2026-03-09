# Vivid Shell v2 — "Live Broadcast" Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the Vivid shell as a "live broadcast" reality TV experience with 3-tab navigation, talk-show-panel message cards, phase-reactive theming, and broadcast chrome.

**Architecture:** Tab-based navigation (Stage/Whispers/Cast) replaces the hidden space-navigation system. All components consume `useGameStore` for state and receive an `engine` prop for actions. Phase-reactive CSS custom properties drive app-wide color shifts. Cartridges render inline in the chat timeline. Player interactions happen via bottom sheets (vaul drawer).

**Tech Stack:** React 18, Framer Motion, Zustand (useGameStore), Vaul (bottom sheets), Solar Icons (BoldDuotone), Sonner (toasts), Google Fonts (Quicksand, DM Sans, JetBrains Mono), CSS custom properties for theming.

**Design doc:** `docs/plans/2026-03-09-vivid-shell-v2-design.md`

---

## Task 1: Foundation — CSS Theme + Player Colors + Fonts

**Files:**
- Modify: `apps/client/src/shells/vivid/vivid.css`
- Create: `apps/client/src/shells/vivid/colors.ts`

### Step 1: Rewrite vivid.css

Replace the entire file with phase-reactive theme system. Key changes:
- Swap Nunito → Quicksand for display font
- Add JetBrains Mono for monospace numbers
- Expand phase classes to modify ALL surface/accent variables (not just background)
- Add tab-bar, broadcast-bar, and phase-line utility classes
- Remove `.persona-rail` styles (deleted component)

```css
/* Vivid Shell v2 — "Live Broadcast" Theme */
@import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

.vivid-shell {
  /* Backgrounds — base palette (shifts per phase) */
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
  --vivid-font-display: 'Quicksand', sans-serif;
  --vivid-font-body: 'DM Sans', sans-serif;
  --vivid-font-mono: 'JetBrains Mono', monospace;

  /* Phase accent — used by broadcast bar, phase line, etc. */
  --vivid-phase-accent: var(--vivid-teal);
  --vivid-phase-glow: rgba(78, 205, 196, 0.15);

  font-family: var(--vivid-font-body);
  color: var(--vivid-text);
  background: var(--vivid-bg-deep);
}

/* ---- Phase-reactive themes ---- */
/* Each phase overrides background gradients + phase accent + surface tints */

.vivid-phase-pregame {
  --vivid-bg-deep: #1a1530;
  --vivid-bg-surface: #231e42;
  --vivid-bg-elevated: #2c2652;
  --vivid-phase-accent: var(--vivid-lavender);
  --vivid-phase-glow: rgba(167, 139, 250, 0.15);
}

.vivid-phase-social {
  --vivid-bg-deep: #1f1a2e;
  --vivid-bg-surface: #2a2445;
  --vivid-bg-elevated: #342e55;
  --vivid-phase-accent: var(--vivid-teal);
  --vivid-phase-glow: rgba(78, 205, 196, 0.12);
}

.vivid-phase-game {
  --vivid-bg-deep: #0f1f2e;
  --vivid-bg-surface: #152a3d;
  --vivid-bg-elevated: #1c344a;
  --vivid-phase-accent: var(--vivid-teal);
  --vivid-phase-glow: rgba(78, 205, 196, 0.2);
}

.vivid-phase-voting {
  --vivid-bg-deep: #2a1520;
  --vivid-bg-surface: #351a2a;
  --vivid-bg-elevated: #401f34;
  --vivid-phase-accent: var(--vivid-gold);
  --vivid-phase-glow: rgba(255, 217, 61, 0.15);
}

.vivid-phase-elimination {
  --vivid-bg-deep: #1a0a0f;
  --vivid-bg-surface: #250f18;
  --vivid-bg-elevated: #301420;
  --vivid-phase-accent: var(--vivid-pink);
  --vivid-phase-glow: rgba(255, 46, 99, 0.2);
}

.vivid-phase-default {
  background: var(--vivid-bg-deep);
}

/* ---- Phase background with smooth transition ---- */
.vivid-phase-bg {
  transition: background 2.5s ease,
              --vivid-bg-deep 2.5s ease,
              --vivid-bg-surface 2.5s ease,
              --vivid-bg-elevated 2.5s ease;
}

/* ---- Phase gradient line (above tab bar) ---- */
@keyframes vivid-phase-line-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.vivid-phase-line {
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--vivid-phase-accent), transparent);
  background-size: 200% 100%;
  animation: vivid-phase-line-shift 3s ease infinite;
}

/* ---- LIVE dot pulse ---- */
@keyframes vivid-live-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
}

.vivid-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: vivid-live-pulse 2s ease-in-out infinite;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
}

/* ---- Scrollbar hiding ---- */
.vivid-hide-scrollbar::-webkit-scrollbar { display: none; }
.vivid-hide-scrollbar { scrollbar-width: none; }
```

### Step 2: Create colors.ts — Player accent color system

```ts
// apps/client/src/shells/vivid/colors.ts

/**
 * Curated palette of 10 high-contrast colors for player identification.
 * Designed to be distinguishable on dark backgrounds and from each other.
 */
const PLAYER_COLORS = [
  '#FF6B6B', // coral red
  '#4ECDC4', // teal
  '#FFD93D', // gold
  '#A78BFA', // lavender
  '#F472B6', // pink
  '#34D399', // emerald
  '#FB923C', // orange
  '#60A5FA', // sky blue
  '#E879F9', // fuchsia
  '#FBBF24', // amber
] as const;

/**
 * Deterministically assigns a color to a player based on their index in the roster.
 * The playerIndex should be stable (derived from roster key order, excluding GAME_MASTER_ID).
 */
export function getPlayerColor(playerIndex: number): string {
  return PLAYER_COLORS[playerIndex % PLAYER_COLORS.length];
}

/**
 * Hook-friendly: builds a map of playerId → color from the roster.
 * Call with Object.keys(roster).filter(id => id !== GAME_MASTER_ID).
 */
export function buildPlayerColorMap(playerIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  playerIds.forEach((id, i) => {
    map[id] = PLAYER_COLORS[i % PLAYER_COLORS.length];
  });
  return map;
}
```

### Step 3: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`
Expected: Build succeeds (CSS/TS changes are additive, no existing imports broken yet)

### Step 4: Commit

```bash
git add apps/client/src/shells/vivid/vivid.css apps/client/src/shells/vivid/colors.ts
git commit -m "feat(vivid): rewrite CSS theme system + add player accent colors"
```

---

## Task 2: Shell Skeleton — VividShell + TabBar + BroadcastBar

**Files:**
- Rewrite: `apps/client/src/shells/vivid/VividShell.tsx`
- Create: `apps/client/src/shells/vivid/components/TabBar.tsx`
- Create: `apps/client/src/shells/vivid/components/BroadcastBar.tsx`

This task creates the shell structure. The tab content areas will initially render placeholder `<div>`s — subsequent tasks fill them in.

### Step 1: Create BroadcastBar

The top bar with LIVE dot, phase label, and currency.

```tsx
// apps/client/src/shells/vivid/components/BroadcastBar.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Dollar, CupStar } from '@solar-icons/react';
import { useGameStore } from '../../../store/useGameStore';

function getPhaseLabel(serverState: string | null, dayIndex: number): string {
  if (!serverState) return 'WAITING';
  const s = serverState.toLowerCase();
  const day = `DAY ${dayIndex}`;
  if (s.includes('pregame') || s.includes('preGame')) return 'PRE-GAME';
  if (s.includes('morningbriefing') || s.includes('morningBriefing')) return `${day} — MORNING`;
  if (s.includes('socialperiod') || s.includes('socialPeriod') || s.includes('dmperiod') || s.includes('dmPeriod')) return `${day} — SOCIAL HOUR`;
  if (s.includes('game') || s.includes('Game')) return `${day} — GAME TIME`;
  if (s.includes('prompt') || s.includes('activity')) return `${day} — ACTIVITY`;
  if (s.includes('voting')) return `${day} — VOTING`;
  if (s.includes('nightsummary') || s.includes('nightSummary')) return `${day} — ELIMINATION`;
  if (s.includes('gamesummary') || s.includes('gameSummary') || s.includes('gameover') || s.includes('gameOver')) return 'FINALE';
  return `${day} — LIVE`;
}

export function BroadcastBar() {
  const dayIndex = useGameStore(s => s.dayIndex);
  const serverState = useGameStore(s => s.serverState);
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const goldPool = useGameStore(s => s.goldPool);

  const mySilver = playerId ? (roster[playerId]?.silver ?? 0) : 0;
  const phaseLabel = getPhaseLabel(serverState, dayIndex);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'color-mix(in srgb, var(--vivid-bg-surface) 80%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Left: LIVE dot + phase label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="vivid-live-dot" />
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.06em',
            color: 'var(--vivid-phase-accent)',
            textTransform: 'uppercase',
          }}
        >
          {phaseLabel}
        </span>
      </div>

      {/* Right: currency */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Dollar size={14} weight="BoldDuotone" color="var(--vivid-gold)" />
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--vivid-gold)',
            }}
          >
            {mySilver}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CupStar size={14} weight="BoldDuotone" color="var(--vivid-lavender)" />
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--vivid-lavender)',
            }}
          >
            {goldPool}
          </span>
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Create TabBar

Bottom 3-tab navigation bar.

```tsx
// apps/client/src/shells/vivid/components/TabBar.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { ChatRoundDots, UsersGroupRounded, LetterUnread } from '@solar-icons/react';
import { VIVID_TAP, VIVID_SPRING } from '../springs';

export type VividTab = 'stage' | 'whispers' | 'cast';

interface TabBarProps {
  activeTab: VividTab;
  onTabChange: (tab: VividTab) => void;
  unreadWhispers?: number;
}

const TABS: Array<{ id: VividTab; label: string; Icon: React.ComponentType<any> }> = [
  { id: 'stage', label: 'Stage', Icon: ChatRoundDots },
  { id: 'whispers', label: 'Whispers', Icon: LetterUnread },
  { id: 'cast', label: 'Cast', Icon: UsersGroupRounded },
];

export function TabBar({ activeTab, onTabChange, unreadWhispers }: TabBarProps) {
  return (
    <div style={{ flexShrink: 0 }}>
      {/* Phase gradient line */}
      <div className="vivid-phase-line" />

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          padding: '8px 0 env(safe-area-inset-bottom, 8px)',
          background: 'color-mix(in srgb, var(--vivid-bg-surface) 90%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <motion.button
              key={id}
              onClick={() => onTabChange(id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '6px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                WebkitTapHighlightColor: 'transparent',
              }}
              whileTap={VIVID_TAP.button}
              transition={VIVID_SPRING.snappy}
            >
              <div style={{ position: 'relative' }}>
                <Icon
                  size={22}
                  weight={isActive ? 'BoldDuotone' : 'Linear'}
                  color={isActive ? 'var(--vivid-phase-accent)' : 'var(--vivid-text-dim)'}
                />
                {/* Unread badge for whispers */}
                {id === 'whispers' && unreadWhispers && unreadWhispers > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      background: 'var(--vivid-coral)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--vivid-font-mono)',
                      color: '#fff',
                      padding: '0 4px',
                    }}
                  >
                    {unreadWhispers}
                  </div>
                ) : null}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'var(--vivid-font-display)',
                  color: isActive ? 'var(--vivid-phase-accent)' : 'var(--vivid-text-dim)',
                  letterSpacing: '0.02em',
                }}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

**Note:** The icon names above (`ChatRoundDots`, `LetterUnread`, `UsersGroupRounded`) are from Solar Icons. If exact names differ, check `@solar-icons/react` exports and pick the closest match for: a chat bubble (Stage), an envelope/letter (Whispers), and a group of people (Cast). The weight `"Linear"` gives an outline look for inactive tabs; `"BoldDuotone"` gives a filled look for active.

### Step 3: Rewrite VividShell.tsx

New tab-based orchestrator. Initially renders placeholder divs for tab content.

```tsx
// apps/client/src/shells/vivid/VividShell.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';
import './vivid.css';
import type { ShellProps } from '../types';
import { useGameStore } from '../../store/useGameStore';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import { BroadcastBar } from './components/BroadcastBar';
import { TabBar, type VividTab } from './components/TabBar';
import { buildPlayerColorMap } from './colors';
import { PwaGate } from '../../components/PwaGate';
import { VIVID_SPRING } from './springs';

/* Placeholder components — replaced in subsequent tasks */
function StagePlaceholder() {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vivid-text-dim)' }}>Stage — coming soon</div>;
}
function WhispersPlaceholder() {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vivid-text-dim)' }}>Whispers — coming soon</div>;
}
function CastPlaceholder() {
  return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vivid-text-dim)' }}>Cast — coming soon</div>;
}

/* ---- Phase class resolver ---- */
function getPhaseClass(serverState: string | null): string {
  if (!serverState) return 'vivid-phase-default';
  const s = serverState.toLowerCase();
  if (s.includes('pregame') || s.includes('preGame')) return 'vivid-phase-pregame';
  if (s.includes('voting') || s.includes('nightsummary')) return 'vivid-phase-voting';
  if (s.includes('game') || s.includes('Game')) return 'vivid-phase-game';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'vivid-phase-elimination';
  return 'vivid-phase-social';
}

/* ---- VividShell ---- */
function VividShell({ playerId, engine, token }: ShellProps) {
  const [activeTab, setActiveTab] = useState<VividTab>('stage');

  // DM chat navigation state
  const [dmTargetPlayerId, setDmTargetPlayerId] = useState<string | null>(null);
  const [dmChannelId, setDmChannelId] = useState<string | null>(null);

  // Player detail navigation state
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);

  const serverState = useGameStore(s => s.serverState);
  const roster = useGameStore(s => s.roster);
  const phaseClass = getPhaseClass(serverState);

  // Player color map — stable across renders
  const playerColorMap = useMemo(() => {
    const ids = Object.keys(roster).filter(id => id !== GAME_MASTER_ID);
    return buildPlayerColorMap(ids);
  }, [roster]);

  /* ---- Navigation handlers ---- */

  const handleOpenDm = useCallback((pid: string) => {
    setDmTargetPlayerId(pid);
    setDmChannelId(null);
    setActiveTab('whispers');
  }, []);

  const handleOpenGroupDm = useCallback((channelId: string) => {
    setDmChannelId(channelId);
    setDmTargetPlayerId(null);
    setActiveTab('whispers');
  }, []);

  const handleOpenPlayerDetail = useCallback((pid: string) => {
    setDetailPlayerId(pid);
  }, []);

  const handleClosePlayerDetail = useCallback(() => {
    setDetailPlayerId(null);
  }, []);

  const handleTabChange = useCallback((tab: VividTab) => {
    // Clear DM selection when switching tabs
    if (tab !== 'whispers') {
      setDmTargetPlayerId(null);
      setDmChannelId(null);
    }
    setActiveTab(tab);
  }, []);

  return (
    <div
      data-testid="game-shell"
      className={`vivid-shell fixed inset-0 flex flex-col overflow-hidden vivid-phase-bg ${phaseClass}`}
    >
      {/* Broadcast bar — always visible */}
      <BroadcastBar />

      {/* Tab content */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'stage' && (
            <motion.div
              key="stage"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <StagePlaceholder />
            </motion.div>
          )}
          {activeTab === 'whispers' && (
            <motion.div
              key="whispers"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <WhispersPlaceholder />
            </motion.div>
          )}
          {activeTab === 'cast' && (
            <motion.div
              key="cast"
              className="absolute inset-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <CastPlaceholder />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Tab bar — always visible */}
      <TabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* PWA gate */}
      <PwaGate token={token} />

      {/* Toaster */}
      <Toaster
        position="top-center"
        visibleToasts={5}
        gap={6}
        closeButton
        toastOptions={{
          className: 'font-body',
          duration: Infinity,
          style: {
            background: 'var(--vivid-bg-surface)',
            color: 'var(--vivid-text)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'var(--vivid-font-body)',
          },
        }}
        richColors
      />
    </div>
  );
}

export default VividShell;
```

### Step 4: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`
Expected: Build succeeds. Old components that were imported (StageChat, Backstage, etc.) are no longer imported so their code is tree-shaken out.

### Step 5: Commit

```bash
git add apps/client/src/shells/vivid/VividShell.tsx apps/client/src/shells/vivid/components/TabBar.tsx apps/client/src/shells/vivid/components/BroadcastBar.tsx
git commit -m "feat(vivid): rewrite shell skeleton with tab navigation + broadcast bar"
```

---

## Task 3: Stage Screen — MessageCard + BroadcastAlert + StageChat

**Files:**
- Create: `apps/client/src/shells/vivid/components/MessageCard.tsx`
- Create: `apps/client/src/shells/vivid/components/BroadcastAlert.tsx`
- Rewrite: `apps/client/src/shells/vivid/components/StageChat.tsx`
- Modify: `apps/client/src/shells/vivid/VividShell.tsx` (replace StagePlaceholder)

### Step 1: Create MessageCard

The "Talk Show Panel" message card. Replaces ChatBubble.

**Props interface:**
```ts
interface MessageCardProps {
  message: ChatMessage;
  isMe: boolean;
  sender?: SocialPlayer;
  showSender: boolean;
  showTimestamp?: boolean;
  isOptimistic?: boolean;
  playerColor: string;
  onTapAvatar?: (playerId: string) => void;
  onTapReply?: (message: ChatMessage) => void;
}
```

**Visual structure:**
- Full-width card with subtle frosted background (`rgba(255,255,255,0.03)` base, `rgba(255,255,255,0.06)` for `isMe`)
- 3px left border bar using `playerColor`
- When `showSender`: avatar (32px) + player name (bold, `playerColor`) + timestamp (right-aligned, dim, mono font)
- Message text below, full width, 14px body font
- When `!showSender`: just the message text with the accent bar continuing, smaller top padding
- `isOptimistic` adds 0.5 opacity
- `onTapAvatar`: clicking avatar/name calls this with the senderId
- Padding: 8px 12px, border-radius: 8px (slight, not bubbly)

**Key detail:** The card should NOT use right-alignment for "me" messages. Same structure for everyone. Only difference is a subtle background tint for `isMe`.

### Step 2: Create BroadcastAlert

Replaces SystemAnnouncement. Breaking-news style banners.

**Props interface:**
```ts
interface BroadcastAlertProps {
  message: TickerMessage;  // from useGameStore tickerMessages
}
```

**Visual logic — determine alert type from `message.category`:**
- Category contains `ELIMINATION`: Red gradient (`linear-gradient(90deg, rgba(255,46,99,0.15), rgba(255,46,99,0.05))`), danger icon, bold text, brief shake entrance
- Category contains `VOTE` or `VOTING`: Gold gradient, scale icon
- Category contains `GAME` or `REWARD`: Gold gradient, trophy/cup icon
- Category contains `WINNER`: Gold gradient + confetti trigger, crown icon
- Default: Teal gradient, info icon

**Structure:**
- Full-width banner, no left accent bar (distinguished from message cards by background gradient)
- Icon (20px) + message text, centered, 12px display font, uppercase, letter-spacing
- `margin: 4px 0`, `border-radius: 10px`, `padding: 10px 16px`
- Entry animation: `initial={{ opacity: 0, scaleX: 0.8 }} animate={{ opacity: 1, scaleX: 1 }}`
- For elimination alerts, add a brief CSS shake (`@keyframes` in vivid.css or inline motion values)

### Step 3: Rewrite StageChat

The main chat timeline, now using MessageCard + BroadcastAlert + inline cartridges.

**Reuse from existing StageChat:**
- `useTimeline()` hook — provides ordered timeline entries
- `useGameStore` selectors (playerId, roster, chatLog, onlinePlayers, active cartridges)
- Scroll management logic (userScrolledUp, scrollToBottom, handleScroll)
- Optimistic messages pattern
- Message grouping logic (shouldShowSender, shouldShowTimestamp)
- "Return to Vote/Game" floating pill
- "Jump to latest" floating pill

**Change from existing StageChat:**
- Replace `<ChatBubble>` with `<MessageCard>` — pass `playerColor` from the color map
- Replace `<SystemAnnouncement>` with `<BroadcastAlert>`
- Cartridges (VotingPanel, GamePanel, PromptPanel) render inline as before (this pattern is already correct)
- Remove PersonaRail dependency
- Add `onTapAvatar` prop (passed down to MessageCard) for opening quick sheet
- Add `playerColorMap` as a prop (from VividShell)

**Props interface:**
```ts
interface StageChatProps {
  engine: any;
  playerColorMap: Record<string, string>;
  onTapAvatar?: (playerId: string) => void;
}
```

**Empty state:** Keep the existing pattern (centered "The stage is set..." text).

### Step 4: Wire into VividShell

Replace `StagePlaceholder` with the actual StageChat component. Import and pass `playerColorMap` and `onTapAvatar` (which opens the PlayerQuickSheet — for now, just a no-op callback or console.log).

Also import and pass `engine` to StageChat.

### Step 5: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`
Expected: Build succeeds.

### Step 6: Commit

```bash
git add apps/client/src/shells/vivid/components/MessageCard.tsx apps/client/src/shells/vivid/components/BroadcastAlert.tsx apps/client/src/shells/vivid/components/StageChat.tsx apps/client/src/shells/vivid/VividShell.tsx
git commit -m "feat(vivid): add MessageCard + BroadcastAlert + rewrite StageChat"
```

---

## Task 4: Chat Input — Simplify + Phase-Aware Placeholders

**Files:**
- Modify: `apps/client/src/shells/vivid/components/ChatInput.tsx`

### Step 1: Simplify ChatInput

The existing ChatInput has silver transfer UI and complex context handling. Simplify:

**Remove:**
- Silver transfer state + UI (`showSilverTransfer`, `silverAmount`, silver buttons)
- The `Dollar` icon import (silver transfer moves to PlayerQuickSheet)

**Keep:**
- Text input + send button
- Typing indicator (TypingIndicator sub-component)
- Reply preview (replyTarget)
- Disabled state for closed chat/DMs
- `sendTyping` / `stopTyping` calls

**Modify:**
- `getPlaceholder` function — add phase-aware placeholders:
  - Read `serverState` from `useGameStore` inside the function or pass it as param
  - During voting: "Quick, before votes close..."
  - During game: "Talk strategy..."
  - During social: "Plot your next move..."
  - During DM: `Whisper to ${targetName}...` (keep existing)
  - Default: "Say something..."
  - Disabled: keep existing ("Chat closed..." / "DMs closed...")

**Style changes:**
- Send button: keep coral background, but use `var(--vivid-phase-accent)` for glow/shadow
- Input background: `var(--vivid-bg-elevated)` (keep)
- Focus ring: use `var(--vivid-phase-accent)` instead of hardcoded coral

### Step 2: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`

### Step 3: Commit

```bash
git add apps/client/src/shells/vivid/components/ChatInput.tsx
git commit -m "feat(vivid): simplify ChatInput + add phase-aware placeholders"
```

---

## Task 5: Whispers Screen — WhispersTab + DMChat Restyle

**Files:**
- Create: `apps/client/src/shells/vivid/components/WhispersTab.tsx`
- Modify: `apps/client/src/shells/vivid/components/DMChat.tsx`
- Modify: `apps/client/src/shells/vivid/VividShell.tsx` (replace WhispersPlaceholder)

### Step 1: Create WhispersTab

Conversation list sorted by recency. Combines functionality of old Backstage + ConversationCard into one component.

**Props interface:**
```ts
interface WhispersTabProps {
  engine: any;
  playerColorMap: Record<string, string>;
  activeDmPlayerId?: string | null;
  activeChannelId?: string | null;
  onSelectDm: (playerId: string) => void;
  onSelectGroup: (channelId: string) => void;
  onNewDm: () => void;
  onNewGroup: () => void;
  onBack: () => void;  // back from DM view to list
  onTapAvatar?: (playerId: string) => void;
}
```

**Behavior:**
- If `activeDmPlayerId` or `activeChannelId` is set → render `<DMChat>` for that conversation
- Otherwise → render the conversation list

**Conversation list structure:**
- Header: "Whispers" title + compact pill buttons for "+ DM" and "+ Group"
- Game Master DM (pinned at top, gold left accent bar, crown icon)
- Group DMs (stacked avatar cluster, member names)
- 1:1 DMs (single avatar, player name in accent color)
- Each item: left accent bar (player color or gold for GM), avatar, name, last message preview, relative timestamp

**Reuse patterns from old Backstage.tsx:**
- `useMemo` for deriving `gmDm`, `groupThreads`, `dmThreads` from store
- Sort by lastTimestamp descending
- Stagger entrance animations (0.04s delay per item)

**Card styling (inline, not a separate component):**
- Full width, padding 12px 16px
- 3px left border using player's accent color
- Background: transparent, hover: `rgba(255,255,255,0.04)`
- Tap: `whileTap={{ scale: 0.98 }}`

### Step 2: Restyle DMChat

Modify existing DMChat.tsx to use MessageCard instead of ChatBubble:

**Changes:**
- Import and use `MessageCard` instead of `ChatBubble`
- Add `playerColorMap` prop
- Pass `playerColor` to each MessageCard
- Keep all existing logic: typing indicators, rejection toasts, auto-scroll, header
- Style the header to match broadcast bar aesthetic (compact, frosted glass)
- Add `onTapAvatar` prop and pass it to MessageCard

**Props addition:**
```ts
// Add to existing DMChatProps:
playerColorMap: Record<string, string>;
onTapAvatar?: (playerId: string) => void;
```

### Step 3: Wire into VividShell

Replace `WhispersPlaceholder` with `<WhispersTab>`. Pass the DM navigation state:
- `activeDmPlayerId={dmTargetPlayerId}`
- `activeChannelId={dmChannelId}`
- `onSelectDm={handleOpenDm}` (sets dmTargetPlayerId, stays on whispers tab)
- `onBack` clears dmTargetPlayerId/dmChannelId

Also add `<NewDmPicker>` and `<NewGroupPicker>` overlays (reuse from classic shell, shown conditionally via state flags).

### Step 4: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`

### Step 5: Commit

```bash
git add apps/client/src/shells/vivid/components/WhispersTab.tsx apps/client/src/shells/vivid/components/DMChat.tsx apps/client/src/shells/vivid/VividShell.tsx
git commit -m "feat(vivid): add WhispersTab + restyle DMChat with MessageCards"
```

---

## Task 6: Cast Screen — Leaderboard + Roster

**Files:**
- Create: `apps/client/src/shells/vivid/components/CastTab.tsx`
- Modify: `apps/client/src/shells/vivid/VividShell.tsx` (replace CastPlaceholder)

### Step 1: Create CastTab

**Props interface:**
```ts
interface CastTabProps {
  playerColorMap: Record<string, string>;
  onSelectPlayer: (playerId: string) => void;    // tap → open DM
  onViewProfile: (playerId: string) => void;      // info icon → detail screen
}
```

**State reads:**
- `playerId`, `roster`, `onlinePlayers` from useGameStore

**Derived data (memoized):**
- `rankedPlayers`: all players (excluding GAME_MASTER_ID), sorted by silver descending, then alive before eliminated
- `alivePlayers`: filtered alive subset
- `eliminatedPlayers`: filtered eliminated subset

**Layout:**
- Scrollable container, full height
- Header: "THE CAST" in display font, with alive count badge ("4 remaining")

**Leaderboard section (top):**
- Top 3 players get special "podium" cards:
  - Rank badge (1st: gold, 2nd: silver/light gray, 3rd: bronze/amber)
  - Larger avatar (48px) with accent color ring
  - Name in accent color, silver count in mono font
  - Subtle background glow using accent color
- Remaining alive players: compact rows
  - Rank number + avatar (32px) + name + silver count
  - 3px left accent bar (player color)

**Eliminated section:**
- Collapsible, starts open
- Header: "ELIMINATED" with count
- Players shown with grayscale avatar + strikethrough name + "ELIMINATED" badge
- Dimmed (opacity 0.5)

**Interaction:**
- Tap player row → `onSelectPlayer(pid)` (navigates to DM)
- Small info icon button on each row → `onViewProfile(pid)` (opens detail screen)
- Online indicator: green dot next to avatar for online players

### Step 2: Wire into VividShell

Replace `CastPlaceholder`. Wire `onSelectPlayer` to `handleOpenDm` and `onViewProfile` to `handleOpenPlayerDetail`.

### Step 3: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`

### Step 4: Commit

```bash
git add apps/client/src/shells/vivid/components/CastTab.tsx apps/client/src/shells/vivid/VividShell.tsx
git commit -m "feat(vivid): add CastTab with leaderboard + roster"
```

---

## Task 7: Player Interaction — QuickSheet + Detail Screen

**Files:**
- Create: `apps/client/src/shells/vivid/components/PlayerQuickSheet.tsx`
- Create: `apps/client/src/shells/vivid/components/PlayerDetail.tsx`
- Modify: `apps/client/src/shells/vivid/VividShell.tsx` (wire up)

### Step 1: Create PlayerQuickSheet

Bottom sheet (using Vaul `<Drawer>`) for quick player actions. Triggered by tapping avatars in Stage chat.

**Props interface:**
```ts
interface PlayerQuickSheetProps {
  targetPlayerId: string | null;
  onClose: () => void;
  onWhisper: (playerId: string) => void;
  onViewProfile: (playerId: string) => void;
  engine: {
    sendSilver: (amount: number, targetId: string) => void;
  };
  playerColorMap: Record<string, string>;
}
```

**Content when open (targetPlayerId !== null):**
- Player avatar (64px) with accent color ring
- Player name in display font + accent color
- Status badge (ALIVE/ELIMINATED)
- Stats row: silver count, gold count (mono font)
- Three action buttons in a row:
  - "Whisper" — teal, chat icon → calls `onWhisper`
  - "Send Silver" — gold, dollar icon → shows inline amount picker (input + send button)
  - "Profile" — lavender, user icon → calls `onViewProfile`
- Drawer handle at top (4px × 48px rounded bar)

**Uses Vaul pattern:**
```tsx
<Drawer.Root open={!!targetPlayerId} onOpenChange={(open) => !open && onClose()}>
  <Drawer.Portal>
    <Drawer.Overlay ... />
    <Drawer.Content ... >
      {/* sheet content */}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

### Step 2: Create PlayerDetail

Full-page player detail screen. Overlays the current tab.

**Props interface:**
```ts
interface PlayerDetailProps {
  targetPlayerId: string;
  playerColor: string;
  engine: {
    sendSilver: (amount: number, targetId: string) => void;
  };
  onBack: () => void;
  onWhisper: (playerId: string) => void;
}
```

**Layout:**
- Full screen, fixed position, z-index 40
- Back button (top left)
- Hero section: large avatar (96px) with accent color glow ring, name in display font, status badge
- Stats grid (2×2): silver, gold, online status, DM count (count of DMs between you and them)
- Action buttons: "Whisper" (full width, teal), "Send Silver" (full width, gold, with amount picker)
- Empty section below with subtle label: "More coming soon..." (placeholder for future features)
- Entry animation: `initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }}`

**State reads:**
- `roster[targetPlayerId]` for player data
- `playerId` for DM count calculation
- `onlinePlayers` for online status
- `chatLog` for DM message count with this player

### Step 3: Wire into VividShell

Add state for quick sheet: `const [quickSheetPlayerId, setQuickSheetPlayerId] = useState<string | null>(null);`

Pass `onTapAvatar={setQuickSheetPlayerId}` to StageChat.

Render `<PlayerQuickSheet>` and `<PlayerDetail>` in VividShell:
- QuickSheet is always mounted, shown when `quickSheetPlayerId` is set
- PlayerDetail is shown when `detailPlayerId` is set (already have this state)

Wire the navigation:
- QuickSheet "Whisper" → `handleOpenDm`
- QuickSheet "Profile" → `handleOpenPlayerDetail` + close sheet
- PlayerDetail "Whisper" → `handleOpenDm` + close detail
- PlayerDetail "Back" → `handleClosePlayerDetail`

### Step 4: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`

### Step 5: Commit

```bash
git add apps/client/src/shells/vivid/components/PlayerQuickSheet.tsx apps/client/src/shells/vivid/components/PlayerDetail.tsx apps/client/src/shells/vivid/VividShell.tsx
git commit -m "feat(vivid): add PlayerQuickSheet + PlayerDetail screens"
```

---

## Task 8: Broadcast Chrome — Phase Transition Splash + Perk FAB + DramaticReveal

**Files:**
- Create: `apps/client/src/shells/vivid/components/PhaseTransitionSplash.tsx`
- Modify: `apps/client/src/shells/vivid/components/DramaticReveal.tsx` (restyle)
- Modify: `apps/client/src/shells/vivid/components/VividPerkFAB.tsx` (adjust position for tab bar)
- Modify: `apps/client/src/shells/vivid/VividShell.tsx` (integrate)

### Step 1: Create PhaseTransitionSplash

Full-screen overlay that appears briefly when the game phase changes.

**Logic:**
- Track `serverState` from useGameStore
- Use `useEffect` + `useRef` to detect when serverState changes
- On change: set `visible = true`, auto-dismiss after 1500ms
- Skip the splash on initial render (useRef flag)

**Visual:**
- Full-screen fixed overlay, z-index 60
- Phase-colored background (gradient matching the new phase)
- Large phase name in display font (e.g. "VOTING", "SOCIAL HOUR", "GAME TIME")
- Entry: scale 0.5 → 1, opacity 0 → 1, spring animation
- Exit: opacity 1 → 0, quick fade

```tsx
// Key structure:
<AnimatePresence>
  {visible && (
    <motion.div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(circle, var(--vivid-phase-glow) 0%, var(--vivid-bg-deep) 100%)`,
        pointerEvents: 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 32,
          fontWeight: 700,
          color: 'var(--vivid-phase-accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textShadow: '0 0 40px var(--vivid-phase-glow)',
        }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={VIVID_SPRING.dramatic}
      >
        {phaseDisplayName}
      </motion.span>
    </motion.div>
  )}
</AnimatePresence>
```

### Step 2: Restyle DramaticReveal

The existing DramaticReveal already works well. Minor changes:
- Use `var(--vivid-font-display)` (now Quicksand) for the reveal text
- Keep all existing logic (localStorage tracking, queue, confetti)
- No structural changes needed — it's already phase-independent

### Step 3: Adjust VividPerkFAB position

The FAB is positioned `bottom: 96` which was above the old chat input. With the tab bar, adjust:
- `bottom: 140` (above tab bar + input)
- Or calculate dynamically based on tab bar height

### Step 4: Integrate in VividShell

Add to VividShell render:
- `<PhaseTransitionSplash />` (always mounted)
- `<DramaticReveal />` (always mounted, as before)
- `<VividPerkFAB engine={engine} />` (on Stage tab only)

### Step 5: Verify build

Run: `cd apps/client && npx vite build 2>&1 | tail -20`

### Step 6: Commit

```bash
git add apps/client/src/shells/vivid/components/PhaseTransitionSplash.tsx apps/client/src/shells/vivid/components/DramaticReveal.tsx apps/client/src/shells/vivid/components/VividPerkFAB.tsx apps/client/src/shells/vivid/VividShell.tsx
git commit -m "feat(vivid): add PhaseTransitionSplash + adjust broadcast chrome"
```

---

## Task 9: Cleanup — Delete Old Files + Final Verification

**Files:**
- Delete: `apps/client/src/shells/vivid/components/PersonaRail.tsx`
- Delete: `apps/client/src/shells/vivid/components/CartridgeOverlay.tsx`
- Delete: `apps/client/src/shells/vivid/components/ChatPeek.tsx`
- Delete: `apps/client/src/shells/vivid/components/ChatBubble.tsx`
- Delete: `apps/client/src/shells/vivid/components/ConversationCard.tsx`
- Delete: `apps/client/src/shells/vivid/components/SystemAnnouncement.tsx`
- Delete: `apps/client/src/shells/vivid/components/GameHUD.tsx`
- Delete: `apps/client/src/shells/vivid/components/Spotlight.tsx`
- Delete: `apps/client/src/shells/vivid/components/QuickActions.tsx`
- Delete: `apps/client/src/shells/vivid/components/Backstage.tsx`

### Step 1: Delete old files

Remove all files listed above. These are replaced by new components and should have no remaining imports.

### Step 2: Verify no broken imports

Run: `cd apps/client && npx vite build 2>&1 | tail -30`

If any import errors appear, they indicate a file that's still being imported somewhere. Fix the import to point to the replacement component.

**Expected mapping if issues arise:**
- `ChatBubble` → `MessageCard`
- `SystemAnnouncement` → `BroadcastAlert`
- `GameHUD` → `BroadcastBar`
- `Backstage` → `WhispersTab`
- `Spotlight` → `PlayerDetail`
- `QuickActions` → `PlayerQuickSheet`
- `PersonaRail` → deleted, no replacement
- `CartridgeOverlay` → deleted, cartridges now inline in StageChat
- `ChatPeek` → deleted, no replacement
- `ConversationCard` → inlined into WhispersTab

### Step 3: Full build verification

Run: `cd apps/client && npx vite build 2>&1 | tail -30`
Expected: Clean build with no errors.

### Step 4: Commit

```bash
git add -u apps/client/src/shells/vivid/
git commit -m "chore(vivid): delete old components replaced by v2 redesign"
```

---

## Verification Checklist

After all tasks are complete, verify on staging:

1. **Shell loads** — No blank screen or crash
2. **Tab navigation** — Stage, Whispers, Cast all render and switch smoothly
3. **BroadcastBar** — Shows LIVE dot, phase label, currency counts
4. **Stage chat** — Messages appear as full-width cards with player colors
5. **System events** — Show as broadcast alert banners (not chat messages)
6. **Inline cartridges** — Voting/game/prompt panels appear in the chat timeline
7. **Chat input** — Can type and send messages, phase-aware placeholder
8. **Whispers** — DM list shows, tapping opens DM chat
9. **DM chat** — Messages use MessageCard style, can send/receive
10. **Cast** — Leaderboard shows ranked players, tap navigates to DM
11. **Player quick sheet** — Tap avatar in Stage → sheet opens with actions
12. **Player detail** — Accessible from quick sheet "Profile" or Cast info icon
13. **Phase transitions** — Background colors shift when phase changes
14. **Phase splash** — Brief overlay when phase changes
15. **Perk FAB** — Accessible on Stage tab
16. **DramaticReveal** — Elimination/winner reveals still work
