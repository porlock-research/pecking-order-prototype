# Dashboard Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an ephemeral overlay panel to the Vivid shell that shows the day's schedule, mechanic explainers, and completed phase results — replacing scattered game-state surfaces with a unified dashboard.

**Architecture:** Global Zustand state controls open/close. A Framer Motion `motion.div` slides down from behind the BroadcastBar with backdrop blur. Timeline events from the manifest are rendered as "living cards" that transition through upcoming → active → completed states. PhaseTransitionSplash crossfades into the dashboard on first view per day.

**Tech Stack:** React 19, Zustand, Framer Motion, @solar-icons/react, @use-gesture/react, shared-types (VOTE_TYPE_INFO, TimelineEvent, VoteType, GameType, PromptType)

---

### Task 1: Dashboard State Slice

Add dashboard open/close state and auto-open tracking to the Zustand store.

**Files:**
- Modify: `apps/client/src/store/useGameStore.ts`

**Step 1: Add state fields and actions to GameState interface**

Add these fields to the `GameState` interface (after line 46, before `// Actions`):

```typescript
// Dashboard
dashboardOpen: boolean;
dashboardSeenForDay: number | null;
welcomeSeen: boolean;
```

Add these actions (after `clearTyping`):

```typescript
openDashboard: () => void;
closeDashboard: () => void;
toggleDashboard: () => void;
markDashboardSeen: (dayIndex: number) => void;
markWelcomeSeen: () => void;
```

**Step 2: Add initial state values**

Add to the `create<GameState>` initial state block (after `debugTicker: null`):

```typescript
dashboardOpen: false,
dashboardSeenForDay: null,
welcomeSeen: false,
```

**Step 3: Add action implementations**

Add after the `clearTyping` action:

```typescript
openDashboard: () => set({ dashboardOpen: true }),
closeDashboard: () => set({ dashboardOpen: false }),
toggleDashboard: () => set((state) => ({ dashboardOpen: !state.dashboardOpen })),
markDashboardSeen: (dayIndex) => set({ dashboardSeenForDay: dayIndex }),
markWelcomeSeen: () => set({ welcomeSeen: true }),
```

**Step 4: Add selector for dashboard auto-open check**

Add after `selectPlayerActivity`:

```typescript
export const selectShouldAutoOpenDashboard = (state: GameState): boolean => {
  return state.dayIndex > 0 && state.dashboardSeenForDay !== state.dayIndex;
};
```

**Step 5: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 6: Commit**

```bash
git add apps/client/src/store/useGameStore.ts
git commit -m "feat(dashboard): add dashboard state slice to Zustand store"
```

---

### Task 2: Timeline Event Card State Logic

Create a pure-logic utility that determines card state (upcoming/active/completed) and merges result data. This is the core data transformation the dashboard relies on.

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/dashboardUtils.ts`

**Step 1: Create the utility file**

```typescript
import type { CompletedCartridge } from '../../../../store/useGameStore';

/** Visual state for a timeline event card */
export type CardState = 'upcoming' | 'active' | 'completed';

/** A timeline event enriched with display state and optional result data */
export interface DashboardEvent {
  /** Original manifest time string ("09:00" or ISO) */
  time: string;
  /** Manifest action (OPEN_VOTING, START_GAME, etc.) */
  action: string;
  /** Visual card state */
  state: CardState;
  /** Human-readable label */
  label: string;
  /** Event category for styling/icons */
  category: 'voting' | 'game' | 'prompt' | 'social' | 'day';
  /** Completed cartridge snapshot (only when state === 'completed') */
  result?: CompletedCartridge['snapshot'];
  /** Optional payload from manifest */
  payload?: any;
}

/** Map manifest action to human label and category */
const ACTION_META: Record<string, { label: string; category: DashboardEvent['category'] }> = {
  OPEN_GROUP_CHAT: { label: 'Group Chat Opens', category: 'social' },
  CLOSE_GROUP_CHAT: { label: 'Group Chat Closes', category: 'social' },
  OPEN_DMS: { label: 'DMs Open', category: 'social' },
  CLOSE_DMS: { label: 'DMs Close', category: 'social' },
  OPEN_VOTING: { label: 'Voting Opens', category: 'voting' },
  CLOSE_VOTING: { label: 'Voting Closes', category: 'voting' },
  START_GAME: { label: 'Mini-Game', category: 'game' },
  END_GAME: { label: 'Game Ends', category: 'game' },
  START_ACTIVITY: { label: 'Activity', category: 'prompt' },
  END_ACTIVITY: { label: 'Activity Ends', category: 'prompt' },
  END_DAY: { label: 'Day Ends', category: 'day' },
};

/**
 * Pairs that represent a single logical event (open/close, start/end).
 * We collapse these into one card keyed by the "open" action.
 */
const PAIRED_ACTIONS: Record<string, string> = {
  CLOSE_VOTING: 'OPEN_VOTING',
  END_GAME: 'START_GAME',
  END_ACTIVITY: 'START_ACTIVITY',
  CLOSE_GROUP_CHAT: 'OPEN_GROUP_CHAT',
  CLOSE_DMS: 'OPEN_DMS',
};

interface ManifestEvent {
  time: string;
  action: string;
  payload?: any;
}

interface BuildDashboardEventsInput {
  timeline: ManifestEvent[];
  completedCartridges: CompletedCartridge[];
  serverState: string | null;
  dayIndex: number;
}

/**
 * Transform manifest timeline events into enriched dashboard events.
 * Collapses paired events, determines card state, merges results.
 */
export function buildDashboardEvents(input: BuildDashboardEventsInput): DashboardEvent[] {
  const { timeline, completedCartridges, serverState, dayIndex } = input;

  // Determine what phases are currently active from serverState
  const activePhase = getActivePhase(serverState);

  // Track which "close" actions have fired (they appear in timeline with a time)
  const closedActions = new Set<string>();
  const timelineActions = new Set(timeline.map(e => e.action));

  // Build a set of completed categories for this day
  const completedByKind: Record<string, CompletedCartridge['snapshot']> = {};
  for (const c of completedCartridges) {
    if ((c.snapshot.dayIndex ?? 0) === dayIndex || (c.snapshot.dayIndex ?? 0) === 0) {
      completedByKind[c.kind] = c.snapshot;
    }
  }

  const events: DashboardEvent[] = [];

  for (const event of timeline) {
    // Skip "close" halves — they're merged into the "open" card
    if (PAIRED_ACTIONS[event.action]) continue;

    const meta = ACTION_META[event.action] || { label: event.action, category: 'day' as const };

    // Determine card state
    let state: CardState = 'upcoming';

    if (meta.category === 'voting') {
      if (completedByKind['voting']) {
        state = 'completed';
      } else if (activePhase === 'voting') {
        state = 'active';
      }
    } else if (meta.category === 'game') {
      if (completedByKind['game']) {
        state = 'completed';
      } else if (activePhase === 'game') {
        state = 'active';
      }
    } else if (meta.category === 'prompt') {
      if (completedByKind['prompt']) {
        state = 'completed';
      } else if (activePhase === 'prompt') {
        state = 'active';
      }
    } else if (meta.category === 'social') {
      // Social events are "active" once they've opened (we infer from serverState)
      if (activePhase === 'social' || activePhase === 'voting' || activePhase === 'game' || activePhase === 'prompt') {
        // If a social event's time has presumably passed, mark active
        state = 'active';
      }
    }

    events.push({
      time: event.time,
      action: event.action,
      state,
      label: meta.label,
      category: meta.category,
      result: state === 'completed' ? completedByKind[meta.category] : undefined,
      payload: event.payload,
    });
  }

  return events;
}

/** Infer which phase is active from the server state string */
function getActivePhase(serverState: string | null): string | null {
  if (!serverState) return null;
  const s = serverState.toLowerCase();
  if (s.includes('voting') || s.includes('nightsummary')) return 'voting';
  if (s.includes('game')) return 'game';
  if (s.includes('prompt') || s.includes('activity')) return 'prompt';
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 'social';
  return null;
}

/**
 * Format a time string for display.
 * Handles both "09:00" (clock time) and ISO strings.
 * For speed-run offset times, converts to relative "+Xm".
 */
export function formatEventTime(time: string): string {
  // ISO string
  if (time.includes('T')) {
    try {
      const d = new Date(time);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return time;
    }
  }
  // "HH:MM" clock time
  if (/^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return m === 0 ? `${hour12} ${period}` : `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
  }
  return time;
}
```

**Step 2: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/dashboardUtils.ts
git commit -m "feat(dashboard): add timeline event state logic and utilities"
```

---

### Task 3: TimelineEventCard Component

The individual card that renders an event in its current state (upcoming/active/completed) with collapsible explainer.

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/TimelineEventCard.tsx`

**Step 1: Create the component**

```typescript
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import type { DashboardEvent } from './dashboardUtils';
import { formatEventTime } from './dashboardUtils';
import { VIVID_SPRING, VIVID_TAP } from '../../springs';
import {
  ChatDots, Scale, Gamepad, PlayCircle, ClockCircle, CheckCircle,
} from '@solar-icons/react';

interface TimelineEventCardProps {
  event: DashboardEvent;
  voteType?: string;
  gameType?: string;
  promptType?: string;
  roster?: Record<string, { personaName: string }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  voting: '#E89B3A',
  game: '#3BA99C',
  prompt: '#8B6CC1',
  social: '#6B9E6E',
  day: '#9B8E7E',
};

const CATEGORY_ICONS: Record<string, React.FC<any>> = {
  voting: Scale,
  game: Gamepad,
  prompt: PlayCircle,
  social: ChatDots,
  day: ClockCircle,
};

export function TimelineEventCard({ event, voteType, gameType, promptType, roster }: TimelineEventCardProps) {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[event.category] || '#9B8E7E';
  const Icon = CATEGORY_ICONS[event.category] || ClockCircle;

  const explainer = getExplainer(event, voteType);
  const hasExpandable = !!explainer || event.state === 'completed';

  return (
    <motion.div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 0',
        opacity: event.state === 'upcoming' ? 0.6 : 1,
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: event.state === 'upcoming' ? 0.6 : 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
    >
      {/* Time column */}
      <div
        style={{
          width: 52,
          flexShrink: 0,
          fontFamily: 'var(--vivid-font-mono)',
          fontSize: 12,
          fontWeight: 600,
          color: event.state === 'active' ? color : 'var(--vivid-text-dim)',
          textAlign: 'right',
          paddingTop: 2,
        }}
      >
        {formatEventTime(event.time)}
      </div>

      {/* Timeline dot + line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div
          style={{
            width: event.state === 'active' ? 12 : 8,
            height: event.state === 'active' ? 12 : 8,
            borderRadius: '50%',
            background: event.state === 'completed' ? color : event.state === 'active' ? color : 'rgba(155,142,126,0.3)',
            border: event.state === 'active' ? `2px solid ${color}` : 'none',
            boxShadow: event.state === 'active' ? `0 0 8px ${color}50` : 'none',
            transition: 'all 0.3s ease',
            marginTop: 4,
          }}
        />
        <div
          style={{
            flex: 1,
            width: 1,
            background: 'rgba(155,142,126,0.15)',
            marginTop: 4,
          }}
        />
      </div>

      {/* Card content */}
      <div
        onClick={hasExpandable ? () => setExpanded(!expanded) : undefined}
        style={{
          flex: 1,
          cursor: hasExpandable ? 'pointer' : 'default',
          background: event.state === 'active'
            ? `${color}10`
            : event.state === 'completed'
              ? 'rgba(155,142,126,0.06)'
              : 'transparent',
          borderRadius: 12,
          padding: hasExpandable ? '10px 12px' : '4px 0',
          border: event.state === 'active' ? `1px solid ${color}30` : '1px solid transparent',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={16} weight="Bold" color={color} />
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--vivid-text)',
              flex: 1,
            }}
          >
            {event.label}
          </span>
          {event.state === 'active' && (
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 10,
                fontWeight: 800,
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '2px 8px',
                borderRadius: 9999,
                background: `${color}20`,
              }}
            >
              LIVE
            </span>
          )}
          {event.state === 'completed' && (
            <CheckCircle size={16} weight="Bold" color={color} />
          )}
        </div>

        {/* Expandable content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ paddingTop: 8 }}>
                {event.state === 'completed' && event.result ? (
                  <CompletedContent event={event} roster={roster} />
                ) : explainer ? (
                  <p
                    style={{
                      fontFamily: 'var(--vivid-font-body)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--vivid-text-dim)',
                      margin: 0,
                    }}
                  >
                    {explainer}
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/** Get explainer text for an event */
function getExplainer(event: DashboardEvent, voteType?: string): string | null {
  if (event.category === 'voting' && voteType) {
    const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
    if (info) return info.howItWorks;
  }
  if (event.category === 'social') {
    if (event.action === 'OPEN_DMS') return 'Send private messages to other players. Each message costs 1 silver.';
    if (event.action === 'OPEN_GROUP_CHAT') return 'The main group chat is open. Everyone can see these messages.';
  }
  return null;
}

/** Render completed results inline */
function CompletedContent({ event, roster }: { event: DashboardEvent; roster?: Record<string, { personaName: string }> }) {
  const result = event.result;
  if (!result) return null;

  const getName = (pid: string) => roster?.[pid]?.personaName ?? pid;

  if (event.category === 'voting') {
    const tally: Record<string, number> = result.summary?.tallies ?? {};
    const eliminatedId: string | null = result.eliminatedId ?? null;
    const winnerId: string | null = result.winnerId ?? null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Tally */}
        {Object.entries(tally)
          .sort(([, a], [, b]) => b - a)
          .map(([pid, votes]) => (
            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--vivid-font-body)', fontSize: 13, color: 'var(--vivid-text)',
                fontWeight: pid === eliminatedId ? 700 : 400,
                textDecoration: pid === eliminatedId ? 'line-through' : 'none',
              }}>
                {getName(pid)}
              </span>
              <span style={{
                fontFamily: 'var(--vivid-font-mono)', fontSize: 12, color: '#E89B3A',
              }}>
                {votes} vote{votes !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        {/* Outcome */}
        {eliminatedId && (
          <div style={{
            marginTop: 4, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(232,97,77,0.1)', border: '1px solid rgba(232,97,77,0.2)',
            fontFamily: 'var(--vivid-font-display)', fontSize: 12, fontWeight: 700,
            color: '#E8614D', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {getName(eliminatedId)} eliminated
          </div>
        )}
        {winnerId && (
          <div style={{
            marginTop: 4, padding: '6px 10px', borderRadius: 8,
            background: 'rgba(255,217,61,0.1)', border: '1px solid rgba(255,217,61,0.3)',
            fontFamily: 'var(--vivid-font-display)', fontSize: 12, fontWeight: 700,
            color: '#D4960A', textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {getName(winnerId)} wins!
          </div>
        )}
      </div>
    );
  }

  if (event.category === 'game') {
    const rewards: Record<string, number> = result.silverRewards ?? {};
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(rewards)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([pid, amount]) => (
            <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 13, color: 'var(--vivid-text)' }}>
                {getName(pid)}
              </span>
              <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 12, color: '#D4960A' }}>
                +{amount} silver
              </span>
            </div>
          ))}
      </div>
    );
  }

  return null;
}
```

**Step 2: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/TimelineEventCard.tsx
git commit -m "feat(dashboard): add TimelineEventCard with living card states"
```

---

### Task 4: DayBriefing Component

Contextual day summary that renders at the top of the dashboard.

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/DayBriefing.tsx`

**Step 1: Create the component**

```typescript
import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../springs';

export function DayBriefing() {
  const dayIndex = useGameStore(s => s.dayIndex);
  const manifest = useGameStore(s => s.manifest);
  const roster = useGameStore(s => s.roster);

  if (!manifest || dayIndex === 0) return null;

  const totalDays = manifest.days?.length ?? 0;
  const aliveCount = Object.values(roster).filter((p: any) => p.status === 'ALIVE').length;
  const currentDay = manifest.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType;
  const voteName = voteType ? VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO]?.name : null;

  const parts: string[] = [];
  parts.push(`Day ${dayIndex}${totalDays > 0 ? ` of ${totalDays}` : ''}.`);
  parts.push(`${aliveCount} player${aliveCount !== 1 ? 's' : ''} remain.`);
  if (voteName) parts.push(`Today: ${voteName}.`);

  return (
    <motion.div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid rgba(155,142,126,0.1)',
      }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
    >
      <p
        style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 15,
          lineHeight: 1.5,
          color: 'var(--vivid-text)',
          margin: 0,
        }}
      >
        {parts.join(' ')}
      </p>
    </motion.div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/DayBriefing.tsx
git commit -m "feat(dashboard): add DayBriefing contextual summary component"
```

---

### Task 5: DayTimeline Component

Composes the timeline event cards using data from the store and the `buildDashboardEvents` utility.

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/DayTimeline.tsx`

**Step 1: Create the component**

```typescript
import React, { useMemo } from 'react';
import { useGameStore, selectDayTimeline } from '../../../../store/useGameStore';
import { buildDashboardEvents } from './dashboardUtils';
import { TimelineEventCard } from './TimelineEventCard';

export function DayTimeline() {
  const timeline = useGameStore(selectDayTimeline);
  const completedCartridges = useGameStore(s => s.completedCartridges);
  const serverState = useGameStore(s => s.serverState);
  const dayIndex = useGameStore(s => s.dayIndex);
  const manifest = useGameStore(s => s.manifest);
  const roster = useGameStore(s => s.roster);

  const currentDay = manifest?.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType;
  const gameType = currentDay?.gameType;
  const promptType = currentDay?.activityType;

  const events = useMemo(
    () => buildDashboardEvents({ timeline, completedCartridges, serverState, dayIndex }),
    [timeline, completedCartridges, serverState, dayIndex],
  );

  if (events.length === 0) {
    return (
      <div style={{ padding: '24px 20px', textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--vivid-font-body)',
          fontSize: 14,
          color: 'var(--vivid-text-dim)',
          margin: 0,
        }}>
          No events scheduled yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 16px 24px' }}>
      {events.map((event, i) => (
        <TimelineEventCard
          key={`${event.action}-${event.time}-${i}`}
          event={event}
          voteType={voteType}
          gameType={gameType}
          promptType={promptType}
          roster={roster}
        />
      ))}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/DayTimeline.tsx
git commit -m "feat(dashboard): add DayTimeline component"
```

---

### Task 6: DashboardOverlay Container

The main overlay — backdrop blur, motion sheet, scroll container, swipe-to-dismiss gesture.

**Files:**
- Create: `apps/client/src/shells/vivid/components/dashboard/DashboardOverlay.tsx`

**Step 1: Create the component**

```typescript
import React, { useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useGameStore, selectPendingChannels } from '../../../../store/useGameStore';
import { DayBriefing } from './DayBriefing';
import { DayTimeline } from './DayTimeline';
import { VIVID_SPRING } from '../../springs';
import { ClockCircle, Letter } from '@solar-icons/react';

const DISMISS_THRESHOLD = -80; // px upward drag to dismiss

export function DashboardOverlay() {
  const dashboardOpen = useGameStore(s => s.dashboardOpen);
  const closeDashboard = useGameStore(s => s.closeDashboard);
  const welcomeSeen = useGameStore(s => s.welcomeSeen);
  const markWelcomeSeen = useGameStore(s => s.markWelcomeSeen);
  const dayIndex = useGameStore(s => s.dayIndex);
  const pendingChannels = useGameStore(selectPendingChannels);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragY = useMotionValue(0);
  const backdropOpacity = useTransform(dragY, [-200, 0], [0.2, 0.6]);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    if (info.offset.y < DISMISS_THRESHOLD) {
      closeDashboard();
    }
  }, [closeDashboard]);

  const showWelcome = dayIndex <= 1 && !welcomeSeen;
  const pendingCount = pendingChannels.length;

  return (
    <AnimatePresence>
      {dashboardOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 45,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeDashboard}
          />

          {/* Overlay panel */}
          <motion.div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              maxHeight: '85vh',
              zIndex: 46,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--vivid-bg-base)',
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              y: dragY,
            }}
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={VIVID_SPRING.page}
            drag="y"
            dragConstraints={{ top: -200, bottom: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '12px 0 4px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(155,142,126,0.3)',
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 20px 12px',
                borderBottom: '1px solid rgba(155,142,126,0.1)',
                flexShrink: 0,
              }}
            >
              <ClockCircle size={18} weight="Bold" color="var(--vivid-phase-accent)" />
              <span
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--vivid-text)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  flex: 1,
                }}
              >
                Today
              </span>
            </div>

            {/* Scrollable content */}
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                WebkitOverflowScrolling: 'touch',
              }}
              onTouchStart={(e) => {
                // Prevent drag gesture when scrolling content
                if (scrollRef.current && scrollRef.current.scrollTop > 0) {
                  e.stopPropagation();
                }
              }}
            >
              {/* Welcome card (first launch) */}
              {showWelcome && (
                <motion.div
                  style={{
                    margin: '16px 16px 0',
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(139,108,193,0.08)',
                    border: '1px solid rgba(139,108,193,0.15)',
                  }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={VIVID_SPRING.gentle}
                >
                  <h3 style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 16,
                    fontWeight: 800,
                    color: '#8B6CC1',
                    margin: '0 0 8px',
                  }}>
                    Welcome to Pecking Order
                  </h3>
                  <p style={{
                    fontFamily: 'var(--vivid-font-body)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: 'var(--vivid-text)',
                    margin: 0,
                  }}>
                    Survive elimination votes. Earn silver through games and activities.
                    Use DMs to form alliances — but every message costs silver.
                    The last player standing wins.
                  </p>
                  <button
                    onClick={() => markWelcomeSeen()}
                    style={{
                      marginTop: 12,
                      padding: '6px 14px',
                      borderRadius: 9999,
                      background: 'rgba(139,108,193,0.15)',
                      border: '1px solid rgba(139,108,193,0.2)',
                      color: '#8B6CC1',
                      fontFamily: 'var(--vivid-font-display)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Got it
                  </button>
                </motion.div>
              )}

              {/* Pending invites badge */}
              {pendingCount > 0 && (
                <motion.div
                  style={{
                    margin: '12px 16px 0',
                    padding: '10px 16px',
                    borderRadius: 12,
                    background: 'rgba(59,169,156,0.08)',
                    border: '1px solid rgba(59,169,156,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={VIVID_SPRING.gentle}
                  onClick={() => {
                    closeDashboard();
                    // Navigate to whispers via store — the shell will pick this up
                  }}
                >
                  <Letter size={18} weight="Bold" color="#3BA99C" />
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#3BA99C',
                  }}>
                    {pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}
                  </span>
                </motion.div>
              )}

              {/* Day briefing */}
              <DayBriefing />

              {/* Day timeline */}
              <DayTimeline />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/dashboard/DashboardOverlay.tsx
git commit -m "feat(dashboard): add DashboardOverlay container with backdrop blur and gestures"
```

---

### Task 7: Wire DashboardOverlay into VividShell

Mount the overlay in the shell and add the BroadcastBar tap handler.

**Files:**
- Modify: `apps/client/src/shells/vivid/VividShell.tsx`
- Modify: `apps/client/src/shells/vivid/components/BroadcastBar.tsx`

**Step 1: Add DashboardOverlay to VividShell**

Add import at the top of `VividShell.tsx` (after line 20):

```typescript
import { DashboardOverlay } from './components/dashboard/DashboardOverlay';
```

Add the component in the render, between `<TabBar>` and `<PlayerQuickSheet>` (after line 210):

```tsx
{/* Dashboard overlay */}
<DashboardOverlay />
```

**Step 2: Add onClick to BroadcastBar**

Modify `BroadcastBar.tsx` to accept and use an `onClick` prop.

Change the function signature (line 20):

```typescript
export function BroadcastBar({ onClick }: { onClick?: () => void }) {
```

Add `onClick` and a cursor to the outer div (line 48):

```typescript
<div
  onClick={onClick}
  style={{
    display: 'flex',
    alignItems: 'center',
    padding: '10px 0',
    paddingLeft: 16,
    background: 'var(--vivid-bg-surface)',
    borderBottom: '2px solid rgba(139, 115, 85, 0.08)',
    flexShrink: 0,
    zIndex: 20,
    overflow: 'hidden',
    gap: 10,
    cursor: onClick ? 'pointer' : undefined,
  }}
>
```

**Step 3: Wire toggleDashboard in VividShell**

In `VividShell.tsx`, import `useGameStore` toggle (it's already imported). Add the toggle call to BroadcastBar:

```tsx
<BroadcastBar onClick={useGameStore.getState().toggleDashboard} />
```

Actually, better to get it as a stable reference. Add to the store reads near line 55:

```typescript
const toggleDashboard = useGameStore(s => s.toggleDashboard);
```

Then update the BroadcastBar line:

```tsx
<BroadcastBar onClick={toggleDashboard} />
```

**Step 4: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/client/src/shells/vivid/VividShell.tsx apps/client/src/shells/vivid/components/BroadcastBar.tsx
git commit -m "feat(dashboard): wire DashboardOverlay into VividShell, add BroadcastBar tap"
```

---

### Task 8: PhaseTransitionSplash Enhancement

Add contextual subtitle and splash-to-dashboard crossfade on first view per day.

**Files:**
- Modify: `apps/client/src/shells/vivid/components/PhaseTransitionSplash.tsx`

**Step 1: Add dashboard awareness and subtitles**

Replace the full component with an enhanced version. Key changes:
- Import `useGameStore` dashboard actions
- Add `selectShouldAutoOpenDashboard` check
- Add contextual subtitle text per phase
- On exit animation complete, call `openDashboard()` if first view of day

Updated component (replace entire file):

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, selectShouldAutoOpenDashboard } from '../../../store/useGameStore';
import { VOTE_TYPE_INFO } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../springs';

function getPhaseDisplayName(serverState: unknown): string | null {
  if (!serverState || typeof serverState !== 'string') return null;
  const s = serverState.toLowerCase();
  if (s.includes('morningbriefing')) return 'MORNING BRIEFING';
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 'SOCIAL HOUR';
  if (s.includes('game')) return 'GAME TIME';
  if (s.includes('prompt') || s.includes('activity')) return 'ACTIVITY';
  if (s.includes('voting')) return 'VOTING';
  if (s.includes('nightsummary')) return 'ELIMINATION';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'FINALE';
  return null;
}

function getPhaseSubtitle(serverState: unknown, manifest: any, dayIndex: number): string | null {
  if (!serverState || typeof serverState !== 'string') return null;
  const s = serverState.toLowerCase();
  const currentDay = manifest?.days?.[dayIndex - 1];
  const voteType = currentDay?.voteType;

  if (s.includes('morningbriefing') || s.includes('socialperiod')) {
    if (voteType) {
      const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
      if (info) return `Today's vote: ${info.name}`;
    }
    return 'A new day begins';
  }
  if (s.includes('voting')) {
    if (voteType) {
      const info = VOTE_TYPE_INFO[voteType as keyof typeof VOTE_TYPE_INFO];
      if (info) return info.description;
    }
    return 'Choose wisely';
  }
  if (s.includes('game')) return 'Time to earn some silver';
  if (s.includes('prompt') || s.includes('activity')) return 'Show them who you are';
  if (s.includes('nightsummary')) return 'The votes have been counted';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'The game is over';
  return null;
}

function getPhaseBackgroundColor(serverState: unknown): string {
  if (!serverState || typeof serverState !== 'string') return 'rgba(253, 248, 240, 0.95)';
  const s = serverState.toLowerCase();
  if (s.includes('morningbriefing')) return 'rgba(253, 246, 238, 0.95)';
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 'rgba(245, 250, 242, 0.95)';
  if (s.includes('game')) return 'rgba(240, 247, 250, 0.95)';
  if (s.includes('voting')) return 'rgba(255, 248, 237, 0.95)';
  if (s.includes('nightsummary')) return 'rgba(253, 242, 240, 0.95)';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'rgba(255, 248, 225, 0.95)';
  return 'rgba(253, 248, 240, 0.95)';
}

export function PhaseTransitionSplash() {
  const serverState = useGameStore(s => s.serverState);
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const shouldAutoOpen = useGameStore(selectShouldAutoOpenDashboard);
  const openDashboard = useGameStore(s => s.openDashboard);
  const markDashboardSeen = useGameStore(s => s.markDashboardSeen);

  const [visible, setVisible] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const prevStateRef = useRef<unknown>(serverState);
  const hasInitialized = useRef(false);
  const shouldOpenDashboardRef = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevStateRef.current = serverState;
      return;
    }

    if (serverState !== prevStateRef.current) {
      prevStateRef.current = serverState;
      const name = getPhaseDisplayName(serverState);
      if (name) {
        setDisplayName(name);
        setSubtitle(getPhaseSubtitle(serverState, manifest, dayIndex));
        // Check if we should open dashboard after this splash
        shouldOpenDashboardRef.current = shouldAutoOpen;
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [serverState, manifest, dayIndex, shouldAutoOpen]);

  const handleExitComplete = () => {
    if (shouldOpenDashboardRef.current) {
      shouldOpenDashboardRef.current = false;
      openDashboard();
      markDashboardSeen(dayIndex);
    }
  };

  const bgColor = getPhaseBackgroundColor(serverState);

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && displayName && (
        <motion.div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: bgColor,
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Decorative bar */}
          <motion.div
            style={{
              width: 60,
              height: 4,
              borderRadius: 2,
              background: 'var(--vivid-phase-accent)',
              marginBottom: 16,
              opacity: 0.5,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...VIVID_SPRING.bouncy, delay: 0.1 }}
          />

          <motion.span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 36,
              fontWeight: 800,
              color: 'var(--vivid-phase-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textAlign: 'center',
            }}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={VIVID_SPRING.dramatic}
          >
            {displayName}
          </motion.span>

          {/* Contextual subtitle */}
          {subtitle && (
            <motion.span
              style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 16,
                fontWeight: 500,
                color: 'var(--vivid-text-dim)',
                textAlign: 'center',
                marginTop: 8,
                maxWidth: '80%',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {subtitle}
            </motion.span>
          )}

          {/* Decorative bar below */}
          <motion.div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--vivid-phase-accent)',
              marginTop: 16,
              opacity: 0.3,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ ...VIVID_SPRING.bouncy, delay: 0.2 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

**Step 2: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/PhaseTransitionSplash.tsx
git commit -m "feat(dashboard): enhance splash with contextual subtitles and dashboard crossfade"
```

---

### Task 9: Clean Up StageChat

Remove completed cartridge entries from the chat timeline since they now live in the dashboard.

**Files:**
- Modify: `apps/client/src/hooks/useTimeline.ts`

**Step 1: Remove completed cartridge entries from useTimeline**

In `useTimeline.ts`, remove lines 26-34 (the completed cartridge loop):

```typescript
// Remove this block:
    // Include completed cartridges as timeline entries
    for (const c of completedCartridges) {
      entries.push({
        kind: 'completed-cartridge',
        key: c.key,
        timestamp: c.completedAt,
        data: { kind: c.kind, snapshot: c.snapshot },
      });
    }
```

Also remove `completedCartridges` from the store read (line 11) and the `useMemo` dependency array (line 51).

The resulting file should be:

```typescript
import { useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { TimelineEntry } from '../types/timeline';

export function useTimeline(): TimelineEntry[] {
  const chatLog = useGameStore(s => s.chatLog);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);

  return useMemo(() => {
    const entries: TimelineEntry[] = [];

    const mainChat = chatLog.filter(m => m.channelId === 'MAIN' || (!m.channelId && m.channel === 'MAIN'));
    for (const msg of mainChat) {
      entries.push({ kind: 'chat', key: `chat-${msg.id}`, timestamp: msg.timestamp, data: msg });
    }

    for (const t of tickerMessages) {
      if (t.category.startsWith('GATE.')) continue;
      entries.push({ kind: 'system', key: `sys-${t.id}`, timestamp: t.timestamp, data: t });
    }

    // Sort chronologically
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Append active cartridges at the end (always last)
    if (activeVotingCartridge) {
      entries.push({ kind: 'voting', key: 'active-voting', timestamp: Number.MAX_SAFE_INTEGER });
    }
    if (activeGameCartridge) {
      entries.push({ kind: 'game', key: 'active-game', timestamp: Number.MAX_SAFE_INTEGER });
    }
    if (activePromptCartridge) {
      entries.push({ kind: 'prompt', key: 'active-prompt', timestamp: Number.MAX_SAFE_INTEGER });
    }

    return entries;
  }, [chatLog, tickerMessages, activeVotingCartridge, activeGameCartridge, activePromptCartridge]);
}
```

**Step 2: Remove the completed-cartridge case from StageChat**

In `apps/client/src/shells/vivid/components/StageChat.tsx`, remove lines 347-348:

```typescript
// Remove:
              case 'completed-cartridge':
                return null;
```

**Step 3: Verify build**

Run: `cd /Users/manu/Projects/pecking-order && npx tsc --noEmit -p apps/client/tsconfig.json`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/client/src/hooks/useTimeline.ts apps/client/src/shells/vivid/components/StageChat.tsx
git commit -m "refactor(stage): remove completed cartridges from chat timeline — now in dashboard"
```

---

### Task 10: Update Issue Tracker

Mark addressed issues and add ADR entry.

**Files:**
- Modify: `plans/issues/client-bugs.md`
- Modify: `plans/issues/playtest-feedback.md`
- Modify: `plans/DECISIONS.md`

**Step 1: Update client-bugs.md**

Update BUG-005 status:
```
**Status**: ✅ FIXED (`feature/user-friendliness`, ADR-098) — completed phase results render as living cards in the Dashboard Overlay
```

Update BUG-015a status:
```
**Status**: ✅ FIXED (`feature/user-friendliness`, ADR-098) — VOTE_TYPE_INFO explainers shown on timeline event cards in Dashboard Overlay
```

Update BUG-015c status:
```
**Status**: Deferred — player activity data available via ticker/marquee (existing infrastructure)
```

**Step 2: Update playtest-feedback.md**

Update PT1-UX-004 status:
```
**Status**: ✅ FIXED (`feature/user-friendliness`, ADR-098) — VOTE_TYPE_INFO explainers shown in Dashboard Overlay timeline cards
```

Update PT1-UX-007 status:
```
**Status**: Partially addressed (`feature/user-friendliness`, ADR-098) — Welcome card + contextual explainers in Dashboard Overlay. Full onboarding/tutorial strategy still needed.
```

Update PT1-UX-010 status:
```
**Status**: ✅ FIXED (`feature/user-friendliness`, ADR-098) — Day schedule visible in Dashboard Overlay with event times
```

**Step 3: Add ADR-098 to DECISIONS.md**

Append:

```markdown
### ADR-098 — Dashboard Overlay (Vivid Shell)

**Context**: Multiple issues required surfacing game state information that was either missing or scattered: schedule visibility (PT1-UX-010), voting explainers (BUG-015a), completed phase results (BUG-005), and basic onboarding (PT1-UX-007).

**Decision**: Add an ephemeral overlay panel ("Dashboard") to the Vivid shell that slides down from behind the BroadcastBar. Global Zustand state (`dashboardOpen`) makes it accessible from anywhere. Content is a single scrollable page with living timeline cards that evolve from upcoming → active → completed. PhaseTransitionSplash crossfades into the dashboard on first view per day.

**Key choices**:
- Framer Motion sheet (not Vaul) — stays in shell DOM tree, CSS variables resolve naturally
- `buildDashboardEvents()` pure function maps manifest timeline + completed cartridges → enriched display events
- Completed cartridges removed from chat timeline (`useTimeline`), now dashboard-only
- Welcome card for first launch, day briefing for each day, notification badges for pending invites
- Swipe-to-dismiss with scroll-aware threshold (only triggers when scrolled to top)

**Consequence**: Stage tab becomes a clean chat surface. Game state awareness moves to an always-accessible overlay. Future economy explainer, full onboarding, and deeper dashboard features have a natural home.
```

**Step 4: Commit**

```bash
git add plans/issues/client-bugs.md plans/issues/playtest-feedback.md plans/DECISIONS.md
git commit -m "docs: add ADR-098 Dashboard Overlay, update issue tracker"
```

---

### Task 11: Build Verification & Visual Test

Final build check and visual verification via Playwright.

**Step 1: Full build**

Run: `cd /Users/manu/Projects/pecking-order && npm run build`
Expected: All 8 tasks succeed

**Step 2: Visual verification**

Use the `/create-game` skill to create a test game, then use the `/test demo` skill or Playwright MCP to:
1. Open the game in a browser tab
2. Tap the BroadcastBar → verify dashboard overlay slides down with backdrop blur
3. Verify day briefing text, timeline cards
4. Dismiss by swiping up or tapping backdrop
5. Verify the Stage tab is clean (no completed cartridge entries in chat)

**Step 3: Screenshot the dashboard open state for review**
