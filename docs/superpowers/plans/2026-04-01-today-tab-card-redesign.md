# Today Tab Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `ActivityCard` abstraction with direct cartridge panel rendering so cartridges render themselves through their full lifecycle (live interaction + results) inline in the Today tab.

**Architecture:** TodayTab renders VotingPanel/PromptPanel/DilemmaPanel inline for both live and completed activities. Games get fullscreen takeover only for active gameplay; completed games render GamePanel inline with dismiss suppressed. Upcoming activities use a lightweight UpcomingPreview. ActivityCard is deleted.

**Tech Stack:** React 19, Zustand, framer-motion, XState v5 (via SYNC), @solar-icons/react (Bold weight), vivid shell CSS variables (`--vivid-*`), `VIVID_SPRING`/`VIVID_TAP` from `shells/vivid/springs.ts`.

**Key design decisions:**
- Voting results shown immediately after close (no delay to night summary)
- Panels read from `activeXxxCartridge` store fields — result hold (ADR-124) keeps data populated after completion
- `CelebrationSequence.onDismiss` is already optional — passing `undefined` hides the "Done" button
- Upcoming cards at full opacity, not dimmed

**Worktree:** `.worktrees/activities-tab` (branch `feature/activities-tab`)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| CREATE | `apps/client/src/hooks/useActivityCountdown.ts` | Live-ticking countdown hook for upcoming activities |
| CREATE | `apps/client/src/shells/vivid/components/today/UpcomingPreview.tsx` | Preview card for not-yet-started activities |
| MODIFY | `apps/client/src/components/panels/GamePanel.tsx` | Add `inline` prop to suppress dismiss behavior |
| REWRITE | `apps/client/src/shells/vivid/components/TodayTab.tsx` | Render panels directly instead of ActivityCard |
| MODIFY | `apps/client/src/shells/vivid/VividShell.tsx` | Pass `engine` to TodayTab, games-only takeover |
| MODIFY | `apps/client/src/shells/vivid/components/today/CartridgeTakeover.tsx` | Remove voting/prompt/dilemma panels, games only |
| DELETE | `apps/client/src/shells/vivid/components/today/ActivityCard.tsx` | Replaced by direct panel rendering |
| MODIFY | `e2e/tests/today-tab.spec.ts` | Update selectors for inline panels |
| MODIFY | `apps/client/src/cartridges/games/shared/Leaderboard.tsx` | Add game-specific stat column |
| MODIFY | `apps/client/src/cartridges/games/wrappers/ArcadeGameWrapper.tsx` | Pass `gameType` to Leaderboard |
| MODIFY | `apps/client/src/cartridges/prompts/HotTakePrompt.tsx` | Show individual player stances |
| MODIFY | `apps/client/src/cartridges/prompts/WouldYouRatherPrompt.tsx` | Show individual player choices |
| MODIFY | `apps/client/src/cartridges/prompts/PlayerPickPrompt.tsx` | Show all individual picks |
| MODIFY | `apps/client/src/cartridges/prompts/PredictionPrompt.tsx` | Show all individual predictions |
| MODIFY | `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx` | Show individual decisions for all 3 types |

---

### Task 1: Create `useActivityCountdown` hook

**Files:**
- Create: `apps/client/src/hooks/useActivityCountdown.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/client/src/hooks/useActivityCountdown.ts
import { useState, useEffect } from 'react';

/**
 * Returns a live-ticking formatted countdown string for an upcoming activity.
 * Returns null if the target time has passed or is undefined.
 */
export function useActivityCountdown(startsAt: number | undefined): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!startsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startsAt]);

  if (!startsAt) return null;
  const ms = startsAt - now;
  if (ms <= 0) return null;

  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hours > 0) return `Starts in ${hours}h ${mins}m`;
  if (mins > 0) return `Starts in ${mins}m ${secs}s`;
  return `Starts in ${secs}s`;
}
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `useActivityCountdown.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/hooks/useActivityCountdown.ts
git commit -m "feat(client): add useActivityCountdown hook with live-ticking countdown"
```

---

### Task 2: Create `UpcomingPreview` component

**Files:**
- Create: `apps/client/src/shells/vivid/components/today/UpcomingPreview.tsx`

**Reference:**
- `VOTE_TYPE_INFO`, `GAME_TYPE_INFO`, `ACTIVITY_TYPE_INFO`, `DILEMMA_TYPE_INFO` from `@pecking-order/shared-types`
- Icons: `Scale`, `Gamepad`, `MagicStick3`, `HandMoney`, `CupStar` from `@solar-icons/react` (weight="Bold")
- Springs: `VIVID_SPRING` from `../../springs`

- [ ] **Step 1: Create the component**

```tsx
// apps/client/src/shells/vivid/components/today/UpcomingPreview.tsx
import { motion } from 'framer-motion';
import { Scale, Gamepad, MagicStick3, HandMoney, CupStar } from '@solar-icons/react';
import { VOTE_TYPE_INFO, GAME_TYPE_INFO, ACTIVITY_TYPE_INFO, DILEMMA_TYPE_INFO } from '@pecking-order/shared-types';
import type { VoteType, GameType, PromptType, DilemmaType } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../springs';
import { useActivityCountdown } from '../../../../hooks/useActivityCountdown';

interface UpcomingPreviewProps {
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  typeKey: string;
  startsAt?: number;
}

const KIND_LABELS: Record<string, string> = {
  voting: 'Vote', game: 'Mini-Game', prompt: 'Activity', dilemma: 'Dilemma',
};

const KIND_COLORS: Record<string, string> = {
  voting: '#E89B3A', game: '#3BA99C', prompt: '#8B6CC1', dilemma: '#CF864B',
};

function getIcon(kind: string, typeKey: string) {
  if (kind === 'voting' && typeKey === 'FINALS') return CupStar;
  switch (kind) {
    case 'voting': return Scale;
    case 'game': return Gamepad;
    case 'prompt': return MagicStick3;
    case 'dilemma': return HandMoney;
    default: return Scale;
  }
}

function getTypeInfo(kind: string, typeKey: string): { name: string; description: string } {
  const map =
    kind === 'voting' ? VOTE_TYPE_INFO :
    kind === 'game' ? GAME_TYPE_INFO :
    kind === 'prompt' ? ACTIVITY_TYPE_INFO :
    DILEMMA_TYPE_INFO;
  const info = (map as Record<string, { name: string; oneLiner?: string; description?: string }>)[typeKey];
  return {
    name: info?.name || typeKey,
    description: info?.oneLiner || info?.description || '',
  };
}

export function UpcomingPreview({ kind, typeKey, startsAt }: UpcomingPreviewProps) {
  const countdown = useActivityCountdown(startsAt);
  const Icon = getIcon(kind, typeKey);
  const color = KIND_COLORS[kind] || '#888';
  const { name, description } = getTypeInfo(kind, typeKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
      style={{
        background: 'var(--vivid-bg-surface)',
        borderRadius: 14,
        border: '1px solid var(--vivid-border)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '12px 14px', gap: 8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} weight="Bold" style={{ color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: 0.5, color: 'var(--vivid-text-muted)',
            }}>
              {KIND_LABELS[kind]}
            </span>
            <span style={{
              fontSize: 14, fontWeight: 600, color: 'var(--vivid-text)',
            }}>
              {name}
            </span>
          </div>
          {countdown && (
            <span style={{
              fontSize: 12, color, fontWeight: 600,
              fontFamily: 'var(--vivid-font-mono)',
            }}>
              {countdown}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: 0.5, color: 'var(--vivid-text-muted)',
          background: 'var(--vivid-bg-inset)',
          padding: '3px 8px', borderRadius: 6,
        }}>
          Upcoming
        </span>
      </div>

      {/* Description */}
      {description && (
        <div style={{
          padding: '0 14px 14px',
          fontSize: 13, lineHeight: 1.5,
          color: 'var(--vivid-text-muted)',
        }}>
          {description}
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/today/UpcomingPreview.tsx
git commit -m "feat(client): add UpcomingPreview component for upcoming activities"
```

---

### Task 3: Add `inline` mode to GamePanel

**Files:**
- Modify: `apps/client/src/components/panels/GamePanel.tsx`

**Context:** GamePanel tracks a `dismissed` state. When the player clicks "Done" in CelebrationSequence, `dismissed` becomes true and the panel returns null. For inline rendering in TodayTab, we need to suppress this — `CelebrationSequence.onDismiss` is already optional (it conditionally renders the "Done" button).

- [ ] **Step 1: Add `inline` prop and suppress dismiss when inline**

In `apps/client/src/components/panels/GamePanel.tsx`, change the props interface and component logic:

```tsx
// BEFORE (line 24-28):
interface GamePanelProps {
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
}

// AFTER:
interface GamePanelProps {
  engine: {
    sendGameAction: (type: string, payload?: Record<string, any>) => void;
  };
  inline?: boolean;
}
```

Update the function signature and logic:

```tsx
// BEFORE (line 30):
export default function GamePanel({ engine }: GamePanelProps) {

// AFTER:
export default function GamePanel({ engine, inline }: GamePanelProps) {
```

```tsx
// BEFORE (line 38 — dismiss check):
  if (!activeGameCartridge || dismissed) return null;

// AFTER:
  if (!activeGameCartridge || (!inline && dismissed)) return null;
```

```tsx
// BEFORE (line 40 — common props):
  const common = { cartridge, playerId, roster, engine, onDismiss: () => setDismissed(true) };

// AFTER:
  const common = { cartridge, playerId, roster, engine, onDismiss: inline ? undefined : () => setDismissed(true) };
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/components/panels/GamePanel.tsx
git commit -m "feat(client): add inline mode to GamePanel to suppress dismiss"
```

---

### Task 4: Rewrite TodayTab to render panels directly

**Files:**
- Rewrite: `apps/client/src/shells/vivid/components/TodayTab.tsx`

**This is the core change.** The TodayTab builds a sorted activity list and renders each activity using its actual cartridge panel (VotingPanel, PromptPanel, DilemmaPanel, GamePanel) instead of ActivityCard.

- [ ] **Step 1: Write the new TodayTab**

Replace the entire contents of `apps/client/src/shells/vivid/components/TodayTab.tsx`:

```tsx
import React, { useMemo, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import {
  VotingPhases, ArcadePhases, PromptPhases, DilemmaPhases,
  VOTE_TYPE_INFO, GAME_TYPE_INFO, ACTIVITY_TYPE_INFO, DILEMMA_TYPE_INFO,
} from '@pecking-order/shared-types';
import type { VoteType, GameType, PromptType, DilemmaType } from '@pecking-order/shared-types';
import { UpcomingPreview } from './today/UpcomingPreview';
import { Scale, Gamepad, MagicStick3, HandMoney, CupStar, PlayCircle, CheckCircle } from '@solar-icons/react';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

// Lazy-load panels — these are large component trees
const VotingPanel = React.lazy(() => import('../../../components/panels/VotingPanel'));
const GamePanel = React.lazy(() => import('../../../components/panels/GamePanel'));
const PromptPanel = React.lazy(() => import('../../../components/panels/PromptPanel'));
const DilemmaPanel = React.lazy(() => import('../../../components/panels/DilemmaPanel'));

/* ── types ─────────────────────────────────────────── */

interface TodayTabProps {
  engine: any;
  onPlayGame: (cartridge: any) => void;
}

interface ActivityEntry {
  kind: 'voting' | 'game' | 'prompt' | 'dilemma';
  typeKey: string;
  state: 'upcoming' | 'live' | 'completed';
  startsAt?: number;
  sortKey: number;
}

/* ── constants ─────────────────────────────────────── */

const ACTION_TO_KIND: Record<string, ActivityEntry['kind']> = {
  OPEN_VOTING: 'voting', CLOSE_VOTING: 'voting',
  START_GAME: 'game', END_GAME: 'game', START_CARTRIDGE: 'game',
  START_ACTIVITY: 'prompt', END_ACTIVITY: 'prompt', INJECT_PROMPT: 'prompt',
  START_DILEMMA: 'dilemma', END_DILEMMA: 'dilemma',
};

const START_ACTIONS = new Set([
  'OPEN_VOTING', 'START_GAME', 'START_CARTRIDGE',
  'START_ACTIVITY', 'INJECT_PROMPT', 'START_DILEMMA',
]);

const KIND_LABELS: Record<string, string> = {
  voting: 'Vote', game: 'Mini-Game', prompt: 'Activity', dilemma: 'Dilemma',
};

const KIND_COLORS: Record<string, string> = {
  voting: '#E89B3A', game: '#3BA99C', prompt: '#8B6CC1', dilemma: '#CF864B',
};

/* ── helpers ───────────────────────────────────────── */

function getKindIcon(kind: string, typeKey?: string) {
  if (kind === 'voting' && typeKey === 'FINALS') return CupStar;
  switch (kind) {
    case 'voting': return Scale;
    case 'game': return Gamepad;
    case 'prompt': return MagicStick3;
    case 'dilemma': return HandMoney;
    default: return Scale;
  }
}

function getTypeName(kind: string, typeKey: string): string {
  const map =
    kind === 'voting' ? VOTE_TYPE_INFO :
    kind === 'game' ? GAME_TYPE_INFO :
    kind === 'prompt' ? ACTIVITY_TYPE_INFO :
    DILEMMA_TYPE_INFO;
  return (map as Record<string, { name: string }>)[typeKey]?.name || typeKey;
}

function resolveVotingState(c: any): 'live' | 'completed' {
  return c.phase === VotingPhases.REVEAL || c.phase === 'WINNER' ? 'completed' : 'live';
}

function resolveGameState(c: any): 'live' | 'completed' {
  if (c.status === ArcadePhases.COMPLETED) return 'completed';
  if (c.allPlayerResults) return 'completed';
  if (c.phase === 'REVEAL' || c.phase === 'SCOREBOARD') return 'completed';
  return 'live';
}

function resolvePromptState(c: any): 'live' | 'completed' {
  return c.phase === PromptPhases.RESULTS ? 'completed' : 'live';
}

function resolveDilemmaState(c: any): 'live' | 'completed' {
  return c.phase === DilemmaPhases.REVEAL ? 'completed' : 'live';
}

function resolveTimelineTypeKey(kind: string, event: any, day: any): string {
  if (event.payload?.voteType) return event.payload.voteType;
  if (event.payload?.gameType) return event.payload.gameType;
  if (event.payload?.promptType) return event.payload.promptType;
  if (event.payload?.dilemmaType) return event.payload.dilemmaType;
  switch (kind) {
    case 'voting': return day?.voteType || 'MAJORITY';
    case 'game': return day?.gameType || 'TRIVIA';
    case 'prompt': return day?.activityType || 'HOT_TAKE';
    case 'dilemma': return day?.dilemmaType || 'SILVER_GAMBIT';
    default: return 'UNKNOWN';
  }
}

/* ── section sub-components ────────────────────────── */

function LiveBadge({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.5, color,
      background: `${color}18`, padding: '3px 8px', borderRadius: 6,
    }}>
      <span className="vivid-live-dot" style={{
        width: 6, height: 6, borderRadius: '50%', background: color,
      }} />
      Live
    </span>
  );
}

function DoneBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 0.5, color: '#6B9E6E',
      background: 'rgba(107,158,110,0.12)', padding: '3px 8px', borderRadius: 6,
    }}>
      <CheckCircle size={12} weight="Bold" />
      Done
    </span>
  );
}

function SectionHeader({ kind, typeKey, state }: { kind: string; typeKey: string; state: string }) {
  const Icon = getKindIcon(kind, typeKey);
  const color = KIND_COLORS[kind] || '#888';
  const typeName = getTypeName(kind, typeKey);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 14px', gap: 8,
      borderBottom: '1px solid var(--vivid-border)',
    }}>
      <Icon size={18} weight="Bold" style={{ color }} />
      <span style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 0.5, color: 'var(--vivid-text-muted)',
      }}>
        {KIND_LABELS[kind]}
      </span>
      <span style={{
        fontSize: 14, fontWeight: 600, color: 'var(--vivid-text)',
      }}>
        {typeName}
      </span>
      <span style={{ marginLeft: 'auto' }}>
        {state === 'live' ? <LiveBadge color={color} /> : <DoneBadge />}
      </span>
    </div>
  );
}

/** Card for live games — shows "Play Now" CTA to open fullscreen takeover. */
function GameLiveCard({ typeKey, onPlay }: { typeKey: string; onPlay: () => void }) {
  const color = KIND_COLORS.game;
  const typeName = getTypeName('game', typeKey);
  const info = (GAME_TYPE_INFO as Record<string, { oneLiner?: string }>)[typeKey];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
      style={{
        background: 'var(--vivid-bg-surface)',
        borderRadius: 14,
        border: `2px solid ${color}`,
        overflow: 'hidden',
      }}
    >
      <SectionHeader kind="game" typeKey={typeKey} state="live" />
      {info?.oneLiner && (
        <div style={{
          padding: '10px 14px 0',
          fontSize: 13, lineHeight: 1.5,
          color: 'var(--vivid-text-muted)',
        }}>
          {info.oneLiner}
        </div>
      )}
      <div style={{ padding: 14 }}>
        <motion.button
          whileTap={VIVID_TAP.button}
          onClick={onPlay}
          style={{
            width: '100%', padding: '12px 0',
            background: color, borderRadius: 10,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 14, fontWeight: 700, color: '#fff',
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}
        >
          Play Now
          <PlayCircle size={18} weight="Bold" />
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ── main component ────────────────────────────────── */

export function TodayTab({ engine, onPlayGame }: TodayTabProps) {
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);
  const activeDilemma = useGameStore(s => s.activeDilemma);
  const completedCartridges = useGameStore(s => s.completedCartridges);

  const activities = useMemo(() => {
    const entries: ActivityEntry[] = [];
    const seenKinds = new Set<string>();
    const currentDay = manifest?.days?.[dayIndex - 1];

    // 1. Active cartridges (live or completed-but-held via result hold)
    if (activeVotingCartridge) {
      const state = resolveVotingState(activeVotingCartridge);
      entries.push({ kind: 'voting', typeKey: activeVotingCartridge.voteType, state, sortKey: state === 'completed' ? 0 : 1 });
      seenKinds.add('voting');
    }
    if (activeGameCartridge) {
      const state = resolveGameState(activeGameCartridge);
      entries.push({ kind: 'game', typeKey: activeGameCartridge.gameType, state, sortKey: state === 'completed' ? 0 : 1 });
      seenKinds.add('game');
    }
    if (activePromptCartridge) {
      const state = resolvePromptState(activePromptCartridge);
      entries.push({ kind: 'prompt', typeKey: activePromptCartridge.promptType, state, sortKey: state === 'completed' ? 0 : 1 });
      seenKinds.add('prompt');
    }
    if (activeDilemma) {
      const state = resolveDilemmaState(activeDilemma);
      entries.push({ kind: 'dilemma', typeKey: activeDilemma.dilemmaType, state, sortKey: state === 'completed' ? 0 : 1 });
      seenKinds.add('dilemma');
    }

    // 2. Completed cartridges not in active slots (replaced by newer cartridge of same kind)
    for (const c of completedCartridges) {
      if (c.snapshot?.dayIndex !== dayIndex) continue;
      if (seenKinds.has(c.kind)) continue;
      const typeKey = c.snapshot?.mechanism || c.snapshot?.gameType || c.snapshot?.promptType || c.snapshot?.dilemmaType || 'UNKNOWN';
      entries.push({ kind: c.kind, typeKey, state: 'completed', sortKey: 0 });
      seenKinds.add(c.kind);
    }

    // 3. Upcoming from timeline
    if (currentDay?.timeline) {
      let upIdx = 0;
      for (const event of currentDay.timeline) {
        if (!START_ACTIONS.has(event.action)) continue;
        const kind = ACTION_TO_KIND[event.action];
        if (!kind || seenKinds.has(kind)) continue;
        const typeKey = resolveTimelineTypeKey(kind, event, currentDay);
        entries.push({ kind, typeKey, state: 'upcoming', startsAt: event.time, sortKey: 2 + upIdx });
        seenKinds.add(kind);
        upIdx++;
      }
    }

    return entries.sort((a, b) => a.sortKey - b.sortKey);
  }, [manifest, dayIndex, activeVotingCartridge, activeGameCartridge, activePromptCartridge, activeDilemma, completedCartridges]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="vivid-hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 32px' }}>
        {/* Day header */}
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
            textTransform: 'uppercase', color: 'var(--vivid-text-muted)',
          }}>
            Day {dayIndex} — Today
          </div>
          <div style={{ fontSize: 12, marginTop: 2, color: 'var(--vivid-text-muted)' }}>
            {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
          </div>
        </div>

        {activities.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 20px',
            color: 'var(--vivid-text-muted)', fontSize: 14,
          }}>
            No activities scheduled yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {activities.map(a => (
              <ActivitySection
                key={`${a.kind}-${a.typeKey}`}
                activity={a}
                engine={engine}
                onPlayGame={onPlayGame}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── activity section renderer ─────────────────────── */

function ActivitySection({ activity, engine, onPlayGame }: {
  activity: ActivityEntry;
  engine: any;
  onPlayGame: (cartridge: any) => void;
}) {
  const { kind, typeKey, state } = activity;
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const color = KIND_COLORS[kind] || '#888';

  // Upcoming: render preview card (no panel exists yet)
  if (state === 'upcoming') {
    return <UpcomingPreview kind={kind} typeKey={typeKey} startsAt={activity.startsAt} />;
  }

  // Live game: render "Play Now" card (games need fullscreen canvas)
  if (kind === 'game' && state === 'live') {
    return (
      <GameLiveCard
        typeKey={typeKey}
        engine={engine}
        onPlay={() => onPlayGame(activeGameCartridge)}
      />
    );
  }

  // Live or completed: render the actual cartridge panel inline
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={VIVID_SPRING.gentle}
      style={{
        background: 'var(--vivid-bg-surface)',
        borderRadius: 14,
        overflow: 'hidden',
        border: state === 'live' ? `2px solid ${color}` : '1px solid var(--vivid-border)',
      }}
    >
      <SectionHeader kind={kind} typeKey={typeKey} state={state} />
      <Suspense fallback={null}>
        {kind === 'voting' && <VotingPanel engine={engine} />}
        {kind === 'game' && <GamePanel engine={engine} inline />}
        {kind === 'prompt' && <PromptPanel engine={engine} />}
        {kind === 'dilemma' && <DilemmaPanel engine={engine} />}
      </Suspense>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. If there are type errors in `GamePanel` import (missing `inline` prop from the default import), ensure Task 3 was applied first.

- [ ] **Step 3: Commit**

```bash
git add apps/client/src/shells/vivid/components/TodayTab.tsx
git commit -m "feat(client): rewrite TodayTab to render cartridge panels directly"
```

---

### Task 5: Update VividShell — pass engine, games-only takeover

**Files:**
- Modify: `apps/client/src/shells/vivid/VividShell.tsx`

**Changes:**
1. Pass `engine` and `onPlayGame` to TodayTab instead of `onOpenCartridge`
2. Takeover only stores game cartridge data (not kind+cartridge)

- [ ] **Step 1: Update TodayTab rendering in VividShell**

In `apps/client/src/shells/vivid/VividShell.tsx`:

Replace the `takeoverCartridge` state type and TodayTab usage:

```tsx
// BEFORE (line 59):
  const [takeoverCartridge, setTakeoverCartridge] = useState<{ kind: string; cartridge: any } | null>(null);

// AFTER:
  const [takeoverGame, setTakeoverGame] = useState<any>(null);
```

```tsx
// BEFORE (line 234):
              <TodayTab onOpenCartridge={(kind, cartridge) => setTakeoverCartridge({ kind, cartridge })} />

// AFTER:
              <TodayTab engine={engine} onPlayGame={(cartridge) => setTakeoverGame(cartridge)} />
```

```tsx
// BEFORE (lines 306-315):
      <AnimatePresence>
        {takeoverCartridge && (
          <CartridgeTakeover
            kind={takeoverCartridge.kind}
            cartridge={takeoverCartridge.cartridge}
            engine={engine}
            onDismiss={() => setTakeoverCartridge(null)}
          />
        )}
      </AnimatePresence>

// AFTER:
      <AnimatePresence>
        {takeoverGame && (
          <CartridgeTakeover
            cartridge={takeoverGame}
            engine={engine}
            onDismiss={() => setTakeoverGame(null)}
          />
        )}
      </AnimatePresence>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Will likely fail until CartridgeTakeover props are updated (Task 6). That's OK — continue to Task 6.

- [ ] **Step 3: Commit (combined with Task 6)**

Hold commit until Task 6 is done (they change the same interface).

---

### Task 6: Simplify CartridgeTakeover — games only

**Files:**
- Modify: `apps/client/src/shells/vivid/components/today/CartridgeTakeover.tsx`

**Changes:** Remove voting/prompt/dilemma panel imports. Only render GamePanel. Simplify props (no `kind` needed).

- [ ] **Step 1: Rewrite CartridgeTakeover**

Replace the entire contents of `apps/client/src/shells/vivid/components/today/CartridgeTakeover.tsx`:

```tsx
import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { GAME_TYPE_INFO } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../springs';

const GamePanel = React.lazy(() => import('../../../../components/panels/GamePanel'));

function getGameName(cartridge: any): string {
  if (!cartridge?.gameType) return 'Game';
  const info = (GAME_TYPE_INFO as Record<string, { name: string }>)[cartridge.gameType];
  return info?.name || cartridge.gameType;
}

interface CartridgeTakeoverProps {
  cartridge: any;
  engine: any;
  onDismiss: () => void;
}

export function CartridgeTakeover({ cartridge, engine, onDismiss }: CartridgeTakeoverProps) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={VIVID_SPRING.page}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        background: 'var(--vivid-bg)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--vivid-border)',
        gap: 12,
      }}>
        <button
          onClick={onDismiss}
          aria-label="Close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, display: 'flex',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="var(--vivid-text)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: 'var(--vivid-text)',
          fontFamily: 'var(--vivid-font-display)',
        }}>
          {getGameName(cartridge)}
        </span>
      </div>

      {/* Game panel */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={null}>
          <GamePanel engine={engine} />
        </Suspense>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors. Both VividShell and CartridgeTakeover now use the new simplified interface.

- [ ] **Step 3: Commit Tasks 5+6 together**

```bash
git add apps/client/src/shells/vivid/VividShell.tsx apps/client/src/shells/vivid/components/today/CartridgeTakeover.tsx
git commit -m "feat(client): restrict CartridgeTakeover to games only, pass engine to TodayTab"
```

---

### Task 7: Delete ActivityCard

**Files:**
- Delete: `apps/client/src/shells/vivid/components/today/ActivityCard.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `cd apps/client && grep -r "ActivityCard" src/ --include="*.tsx" --include="*.ts"`
Expected: Only the file itself. TodayTab no longer imports it (rewritten in Task 4).

- [ ] **Step 2: Delete the file**

```bash
rm apps/client/src/shells/vivid/components/today/ActivityCard.tsx
```

- [ ] **Step 3: Verify TypeScript still compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -u apps/client/src/shells/vivid/components/today/ActivityCard.tsx
git commit -m "chore(client): delete ActivityCard — replaced by direct panel rendering"
```

---

### Task 8: Build and verify

**Files:** None (validation only)

- [ ] **Step 1: Full client build**

Run: `cd apps/client && npm run build 2>&1 | tail -10`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Full TypeScript check across the monorepo**

Run: `cd apps/game-server && npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No errors (server code unchanged).

- [ ] **Step 3: Run existing unit tests**

Run: `cd apps/game-server && npx vitest run 2>&1 | tail -10`
Expected: All tests pass (server tests unchanged).

---

### Task 9: Update e2e tests

**Files:**
- Modify: `e2e/tests/today-tab.spec.ts`

**Context:** The old tests check for `'Cast Your Vote'` CTA buttons, `'Done'` badges, fullscreen takeover with `[data-testid="voting-panel"]`, and clicking `'eliminated'` text to open results. With the new architecture:
- Voting renders inline (no takeover for voting)
- "LIVE" badge still exists in the section header
- Completed voting shows the REVEAL phase inline (tallies + ELIMINATED badge visible directly)
- "Done" badge still exists in the section header
- No "Cast Your Vote" button — the VotingPanel renders the voting UI directly

- [ ] **Step 1: Rewrite the e2e tests**

Replace the entire contents of `e2e/tests/today-tab.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import {
  createTestGame,
  advanceGameState,
  injectTimelineEvent,
  gotoGame,
  waitForGameShell,
  dismissReveal,
  switchToTodayTab,
  dismissSplash,
} from '../fixtures/game-setup';

test.describe('Today Tab', () => {
  test('Today tab shows tab with correct label', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await expect(page.getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: 'Schedule' })).not.toBeVisible();
    } finally {
      await ctx.close();
    }
  });

  test('Today tab shows empty state when no cartridges active', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await switchToTodayTab(page);

      await expect(page.getByText(/Day 1.*Today/)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('0 activities')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Live voting renders inline on Today tab', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await switchToTodayTab(page);

      // Section header shows LIVE badge
      await expect(page.getByText('Live')).toBeVisible({ timeout: 5000 });

      // VotingPanel renders inline — vote buttons are visible directly (no takeover needed)
      await expect(page.locator('[data-testid^="vote-btn-"]').first()).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Vote can be cast inline on Today tab', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await switchToTodayTab(page);

      // Vote for player 3 (p3) directly in the inline panel
      const target = game.players[2].id;
      await page.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page.locator('[data-testid="vote-confirm-btn"]').click();
      await page.waitForTimeout(500);

      // Confirmation shows inline
      await expect(page.locator('[data-testid="vote-confirmed"]')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('Result hold — completed voting shows results inline', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      await gotoGame(page1, game.inviteCode, game.players[0].token);
      await gotoGame(page2, game.inviteCode, game.players[1].token);
      await waitForGameShell(page1);
      await waitForGameShell(page2);
      await dismissSplash(page1);
      await dismissSplash(page2);

      // Both vote for player 3 inline
      await switchToTodayTab(page1);
      await switchToTodayTab(page2);

      const target = game.players[2].id;

      await page1.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page1.locator('[data-testid="vote-confirm-btn"]').click();
      await page1.waitForTimeout(300);

      await page2.locator(`[data-testid="vote-btn-${target}"]`).click();
      await page2.locator('[data-testid="vote-confirm-btn"]').click();
      await page2.waitForTimeout(300);

      // Close voting
      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await new Promise(r => setTimeout(r, 1500));

      await dismissSplash(page1);

      // Vote results should be visible inline (REVEAL phase renders immediately)
      await expect(page1.getByText('VOTE RESULTS')).toBeVisible({ timeout: 10_000 });

      // ELIMINATED badge visible directly on Today tab
      await expect(page1.getByText('ELIMINATED')).toBeVisible({ timeout: 5000 });

      // Section header shows "Done" badge
      await expect(page1.getByText('Done')).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });

  test('BroadcastBar shows live pill during voting', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));
    await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
    await new Promise(r => setTimeout(r, 500));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await expect(page.getByText('Voting').first()).toBeVisible({ timeout: 5000 });
    } finally {
      await ctx.close();
    }
  });

  test('System messages appear in chat for cartridge events', async ({ browser }) => {
    const game = await createTestGame(3, 2);
    await advanceGameState(game.gameId);
    await new Promise(r => setTimeout(r, 500));

    await injectTimelineEvent(game.gameId, 'OPEN_GROUP_CHAT');
    await new Promise(r => setTimeout(r, 300));

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await gotoGame(page, game.inviteCode, game.players[0].token);
      await waitForGameShell(page);
      await dismissSplash(page);

      await injectTimelineEvent(game.gameId, 'OPEN_VOTING');
      await page.waitForTimeout(1000);
      await dismissSplash(page);

      await page.getByRole('button', { name: 'Chat' }).click();
      await page.waitForTimeout(300);
      await expect(page.getByText('Voting has started')).toBeVisible({ timeout: 10_000 });

      await injectTimelineEvent(game.gameId, 'CLOSE_VOTING');
      await page.waitForTimeout(1000);
      await dismissSplash(page);

      await expect(page.getByText(/Voting complete/)).toBeVisible({ timeout: 10_000 });
    } finally {
      await ctx.close();
    }
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/today-tab.spec.ts
git commit -m "test(e2e): update Today tab tests for inline panel rendering"
```

---

### Task 10: Visual inspection with bot-game

**Files:** None (manual verification)

- [ ] **Step 1: Start dev servers**

Run: `npm run dev` from the repo root (starts lobby:3000, client:5173, game-server:8787).

- [ ] **Step 2: Create a SMOKE_TEST game with bots**

Run:
```bash
GAME_SERVER=http://localhost:8787 CLIENT_URL=http://localhost:5173 node e2e/scripts/bot-game.mjs
```
This creates a DYNAMIC/PRE_SCHEDULED/SMOKE_TEST game with 5-minute days and real alarms. Copy the player URL from the output.

- [ ] **Step 3: Open the player URL in a browser and verify**

Open the printed URL. Switch to the Today tab. Verify:
1. **Upcoming activities** render with full opacity, mechanic name, description, live-ticking countdown
2. **Live voting** renders the actual voting ballot inline (vote buttons visible, no fullscreen needed)
3. **Live game** shows "Play Now" card, tapping opens fullscreen takeover
4. **Completed voting** shows VOTE RESULTS with tallies and ELIMINATED badge inline
5. **Completed game** shows celebration + leaderboard inline (no "Done" button)
6. **Live prompt/dilemma** renders interaction inline
7. **Section headers** show correct kind icon, label, mechanic name, and LIVE/Done badges
8. **BroadcastBar** still shows live pills and phase labels correctly

- [ ] **Step 4: Final commit**

If any visual fixes were needed, commit them:
```bash
git add -A
git commit -m "fix(client): Today tab visual polish from inspection"
```

---

## Part 2: Cartridge Result Enhancements

All per-player data is already synced to the client during results/reveal phases. These tasks enhance cartridge components to render it.

---

### Task 11: Enhance Leaderboard with game-specific stats

**Files:**
- Modify: `apps/client/src/cartridges/games/shared/Leaderboard.tsx`
- Modify: `apps/client/src/cartridges/games/wrappers/ArcadeGameWrapper.tsx`

**Context:** The Leaderboard currently shows only `silverReward`. But `allPlayerResults[].result` contains game-specific stats (correct answers, distance, reaction time, etc.). Adding a stat column makes the leaderboard meaningful.

- [ ] **Step 1: Add gameType prop and stat config to Leaderboard**

In `apps/client/src/cartridges/games/shared/Leaderboard.tsx`, add the stat config and update the props:

```tsx
// Add after the existing imports
const GAME_STAT_CONFIG: Record<string, { key: string; label: string; format?: (v: number) => string }> = {
  GAP_RUN: { key: 'distance', label: 'Distance' },
  GRID_PUSH: { key: 'bankedTotal', label: 'Score' },
  SEQUENCE: { key: 'correctRounds', label: 'Rounds' },
  REACTION_TIME: { key: 'avgReactionMs', label: 'Avg', format: v => `${v}ms` },
  COLOR_MATCH: { key: 'correctAnswers', label: 'Correct' },
  STACKER: { key: 'height', label: 'Height' },
  QUICK_MATH: { key: 'correctAnswers', label: 'Correct' },
  SIMON_SAYS: { key: 'roundsCompleted', label: 'Rounds' },
  AIM_TRAINER: { key: 'score', label: 'Score' },
  TRIVIA: { key: 'correctCount', label: 'Correct' },
};
```

Update the interface:

```tsx
// BEFORE:
interface LeaderboardProps {
  allPlayerResults: PlayerResult[];
  currentPlayerId: string;
}

// AFTER:
interface LeaderboardProps {
  allPlayerResults: PlayerResult[];
  currentPlayerId: string;
  gameType?: string;
}
```

Update the component to accept and use `gameType`:

```tsx
// BEFORE:
export function Leaderboard({ allPlayerResults, currentPlayerId }: LeaderboardProps) {

// AFTER:
export function Leaderboard({ allPlayerResults, currentPlayerId, gameType }: LeaderboardProps) {
  const statConfig = gameType ? GAME_STAT_CONFIG[gameType] : undefined;
```

Add the stat column inside each leaderboard entry, between the player name and the silver reward:

```tsx
// Add BEFORE the silver reward span (the one with "+{entry.silverReward}"):
              {statConfig && entry.result?.[statConfig.key] != null && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--vivid-font-mono)',
                }}>
                  {statConfig.format
                    ? statConfig.format(entry.result[statConfig.key])
                    : entry.result[statConfig.key]}{' '}
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                    {statConfig.label}
                  </span>
                </span>
              )}
```

- [ ] **Step 2: Pass gameType from ArcadeGameWrapper to Leaderboard**

In `apps/client/src/cartridges/games/wrappers/ArcadeGameWrapper.tsx`, update the Leaderboard usage (around line 172):

```tsx
// BEFORE:
            <Leaderboard
              allPlayerResults={cartridge.allPlayerResults}
              currentPlayerId={playerId}
            />

// AFTER:
            <Leaderboard
              allPlayerResults={cartridge.allPlayerResults}
              currentPlayerId={playerId}
              gameType={gameType}
            />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/cartridges/games/shared/Leaderboard.tsx apps/client/src/cartridges/games/wrappers/ArcadeGameWrapper.tsx
git commit -m "feat(client): show game-specific stats in Leaderboard (correct answers, distance, etc.)"
```

---

### Task 12: Enhance HotTake + WYR results with individual choices

**Files:**
- Modify: `apps/client/src/cartridges/prompts/HotTakePrompt.tsx`
- Modify: `apps/client/src/cartridges/prompts/WouldYouRatherPrompt.tsx`

**Context:** Both components already have per-player data (`stances` for HotTake, `choices` for WYR) and `roster` in their props — they just don't render it. Add a player list below the split bar showing who chose what.

- [ ] **Step 1: Add PersonaAvatar import and individual stances to HotTakePrompt**

In `apps/client/src/cartridges/prompts/HotTakePrompt.tsx`:

Add import:
```tsx
import { PersonaAvatar } from '../../components/PersonaAvatar';
```

Add the individual stances section after the minority bonus text (after the closing `})()}` of the split bar IIFE, before the "You Earned" section). Insert between the `</div>` that closes `<div className="space-y-2">` and `{results.silverRewards[playerId] != null && (`:

```tsx
          {/* Individual stances */}
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest text-center mb-2">
              Who said what
            </p>
            {Object.entries(stances).map(([pid, stance]) => {
              const player = roster[pid];
              const isMe = pid === playerId;
              return (
                <div
                  key={pid}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isMe ? 'bg-skin-gold/5 border border-skin-gold/15' : ''}`}
                >
                  <PersonaAvatar
                    avatarUrl={player?.avatarUrl}
                    personaName={player?.personaName}
                    size={20}
                  />
                  <span className={`text-xs flex-1 ${isMe ? 'font-bold text-skin-gold' : 'text-skin-dim'}`}>
                    {isMe ? 'You' : (player?.personaName || pid)}
                  </span>
                  <span className={`text-xs font-mono font-bold ${stance === 'AGREE' ? 'text-skin-green' : 'text-skin-pink'}`}>
                    {stance}
                  </span>
                </div>
              );
            })}
          </div>
```

- [ ] **Step 2: Add PersonaAvatar import and individual choices to WouldYouRatherPrompt**

In `apps/client/src/cartridges/prompts/WouldYouRatherPrompt.tsx`:

Add import:
```tsx
import { PersonaAvatar } from '../../components/PersonaAvatar';
```

Add the individual choices section after the minority bonus text, before the "You Earned" section. Same insertion point as HotTake — between `</div>` closing the split bar and `{results.silverRewards[playerId]`:

```tsx
          {/* Individual choices */}
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest text-center mb-2">
              Who chose what
            </p>
            {Object.entries(choices).map(([pid, choice]) => {
              const player = roster[pid];
              const isMe = pid === playerId;
              return (
                <div
                  key={pid}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isMe ? 'bg-skin-gold/5 border border-skin-gold/15' : ''}`}
                >
                  <PersonaAvatar
                    avatarUrl={player?.avatarUrl}
                    personaName={player?.personaName}
                    size={20}
                  />
                  <span className={`text-xs flex-1 ${isMe ? 'font-bold text-skin-gold' : 'text-skin-dim'}`}>
                    {isMe ? 'You' : (player?.personaName || pid)}
                  </span>
                  <span className="text-xs font-mono font-bold text-skin-pink">
                    {choice === 'A' ? results.optionA : results.optionB}
                  </span>
                </div>
              );
            })}
          </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/cartridges/prompts/HotTakePrompt.tsx apps/client/src/cartridges/prompts/WouldYouRatherPrompt.tsx
git commit -m "feat(client): show individual player choices in HotTake and WYR results"
```

---

### Task 13: Enhance PlayerPick + Prediction results with all picks

**Files:**
- Modify: `apps/client/src/cartridges/prompts/PlayerPickPrompt.tsx`
- Modify: `apps/client/src/cartridges/prompts/PredictionPrompt.tsx`

**Context:** Both components have `responses: Record<string, string>` (pickerId → targetId) in their props. They currently show only aggregate results (mostPicked, mutualPicks, consensus). Add an "All Picks" section showing each player's individual pick.

- [ ] **Step 1: Add all-picks section to PlayerPickPrompt**

In `apps/client/src/cartridges/prompts/PlayerPickPrompt.tsx`, in the RESULTS rendering section, add after the mutual picks section and before the "You Earned" section:

```tsx
          {/* All picks */}
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest text-center mb-2">
              All picks
            </p>
            {Object.entries(responses).map(([pickerId, targetId]) => {
              const picker = roster[pickerId];
              const target = roster[targetId];
              const isMe = pickerId === playerId;
              return (
                <div
                  key={pickerId}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isMe ? 'bg-skin-gold/5 border border-skin-gold/15' : ''}`}
                >
                  <PersonaAvatar
                    avatarUrl={picker?.avatarUrl}
                    personaName={picker?.personaName}
                    size={20}
                  />
                  <span className={`text-xs ${isMe ? 'font-bold text-skin-gold' : 'text-skin-dim'}`}>
                    {isMe ? 'You' : (picker?.personaName || pickerId)}
                  </span>
                  <span className="text-xs text-skin-dim/40 mx-1">&rarr;</span>
                  <PersonaAvatar
                    avatarUrl={target?.avatarUrl}
                    personaName={target?.personaName}
                    size={20}
                  />
                  <span className="text-xs text-skin-dim">
                    {target?.personaName || targetId}
                  </span>
                </div>
              );
            })}
          </div>
```

- [ ] **Step 2: Add all-predictions section to PredictionPrompt**

In `apps/client/src/cartridges/prompts/PredictionPrompt.tsx`, same pattern — add after the consensus voters section, before "You Earned":

```tsx
          {/* All predictions */}
          <div className="space-y-1 pt-1">
            <p className="text-[10px] font-mono text-skin-dim/50 uppercase tracking-widest text-center mb-2">
              All predictions
            </p>
            {Object.entries(responses).map(([voterId, targetId]) => {
              const voter = roster[voterId];
              const target = roster[targetId];
              const isMe = voterId === playerId;
              return (
                <div
                  key={voterId}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${isMe ? 'bg-skin-gold/5 border border-skin-gold/15' : ''}`}
                >
                  <PersonaAvatar
                    avatarUrl={voter?.avatarUrl}
                    personaName={voter?.personaName}
                    size={20}
                  />
                  <span className={`text-xs ${isMe ? 'font-bold text-skin-gold' : 'text-skin-dim'}`}>
                    {isMe ? 'You' : (voter?.personaName || voterId)}
                  </span>
                  <span className="text-xs text-skin-dim/40 mx-1">&rarr;</span>
                  <PersonaAvatar
                    avatarUrl={target?.avatarUrl}
                    personaName={target?.personaName}
                    size={20}
                  />
                  <span className="text-xs text-skin-dim">
                    {target?.personaName || targetId}
                  </span>
                </div>
              );
            })}
          </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors. Both components already import `PersonaAvatar`.

- [ ] **Step 4: Commit**

```bash
git add apps/client/src/cartridges/prompts/PlayerPickPrompt.tsx apps/client/src/cartridges/prompts/PredictionPrompt.tsx
git commit -m "feat(client): show all individual picks in PlayerPick and Prediction results"
```

---

### Task 14: Enhance dilemma reveals with individual decisions

**Files:**
- Modify: `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx`

**Context:** `DilemmaReveal` receives `decisions: Record<string, any>` but never passes it to the sub-components. The per-player decision data is:
- SILVER_GAMBIT: `decisions[pid].action` → `'DONATE'` or `'KEEP'`
- SPOTLIGHT: `decisions[pid].targetId` → who they picked
- GIFT_OR_GRIEF: `decisions[pid].targetId` → who they nominated (currently shows tallies but not individual nominators)

- [ ] **Step 1: Import PersonaAvatar**

In `apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx`, add import:

```tsx
import { PersonaAvatar } from '../../components/PersonaAvatar';
```

- [ ] **Step 2: Pass decisions and roster to SilverGambitReveal and SpotlightReveal**

Update the function calls in the main render (around lines 65-72):

```tsx
// BEFORE:
      {!summary.timedOut && dilemmaType === 'SILVER_GAMBIT' && (
        <SilverGambitReveal summary={summary} name={firstName} />
      )}
      {!summary.timedOut && dilemmaType === 'SPOTLIGHT' && (
        <SpotlightReveal summary={summary} name={firstName} />
      )}

// AFTER:
      {!summary.timedOut && dilemmaType === 'SILVER_GAMBIT' && (
        <SilverGambitReveal summary={summary} name={firstName} decisions={decisions} roster={roster} />
      )}
      {!summary.timedOut && dilemmaType === 'SPOTLIGHT' && (
        <SpotlightReveal summary={summary} name={firstName} decisions={decisions} roster={roster} />
      )}
```

- [ ] **Step 3: Add individual decisions to SilverGambitReveal**

Update the `SilverGambitReveal` function signature and add a player decision list after the outcome callout:

```tsx
// BEFORE:
function SilverGambitReveal({ summary, name }: { summary: Record<string, any>; name: (id: string) => string }) {

// AFTER:
function SilverGambitReveal({ summary, name, decisions, roster }: {
  summary: Record<string, any>;
  name: (id: string) => string;
  decisions: Record<string, any>;
  roster: Record<string, SocialPlayer>;
}) {
```

Add the decision list inside the function, after the existing `return` blocks (both the `allDonated` and the defected blocks). The cleanest approach is to add it as a separate `motion.div` rendered after the outcome callout. Wrap both returns and the decision list in a fragment:

Replace the entire `SilverGambitReveal` function with:

```tsx
function SilverGambitReveal({ summary, name, decisions, roster }: {
  summary: Record<string, any>;
  name: (id: string) => string;
  decisions: Record<string, any>;
  roster: Record<string, SocialPlayer>;
}) {
  return (
    <>
      {summary.allDonated ? (
        <motion.div
          variants={staggerItem}
          transition={VIVID_SPRING.bouncy}
          style={{
            textAlign: 'center', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(45, 106, 79, 0.06)', border: '1px solid rgba(45, 106, 79, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <WadOfMoney size={28} weight="Bold" />
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-display)', fontSize: 14, fontWeight: 700, color: '#2D6A4F', lineHeight: 1.4 }}>
            Everyone donated!
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 13, color: '#3D2E1F', marginTop: 4 }}>
            <strong style={{ color: '#B8840A' }}>{name(summary.winnerId)}</strong> wins the jackpot of{' '}
            <strong style={{ color: '#B8840A' }}>{summary.jackpot} silver</strong>!
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerItem}
          transition={VIVID_SPRING.bouncy}
          style={{
            textAlign: 'center', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(157, 23, 77, 0.06)', border: '1px solid rgba(157, 23, 77, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <HeartBroken size={28} weight="Bold" />
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-display)', fontSize: 14, fontWeight: 700, color: '#9D174D', lineHeight: 1.4 }}>
            Someone defected...
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#9B8E7E', marginTop: 4 }}>
            {summary.donorCount} donated, {summary.keeperCount} kept. Donations lost!
          </div>
        </motion.div>
      )}
      {/* Individual decisions */}
      <motion.div variants={staggerItem} transition={VIVID_SPRING.bouncy} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(decisions).map(([pid, dec]) => {
          const action = (dec as any).action;
          const isDonate = action === 'DONATE';
          const player = roster[pid];
          return (
            <div key={pid} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 8,
              background: isDonate ? 'rgba(45,106,79,0.04)' : 'rgba(157,23,77,0.04)',
            }}>
              <PersonaAvatar avatarUrl={player?.avatarUrl} personaName={player?.personaName} size={22} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--vivid-text-base)', fontFamily: 'var(--vivid-font-body)' }}>
                {player?.personaName || pid}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                color: isDonate ? '#2D6A4F' : '#9D174D',
                fontFamily: 'var(--vivid-font-mono)',
              }}>
                {action}
              </span>
            </div>
          );
        })}
      </motion.div>
    </>
  );
}
```

- [ ] **Step 4: Add individual picks to SpotlightReveal**

Replace the entire `SpotlightReveal` function with:

```tsx
function SpotlightReveal({ summary, name, decisions, roster }: {
  summary: Record<string, any>;
  name: (id: string) => string;
  decisions: Record<string, any>;
  roster: Record<string, SocialPlayer>;
}) {
  return (
    <>
      {summary.unanimous && summary.targetId ? (
        <motion.div
          variants={staggerItem}
          transition={VIVID_SPRING.bouncy}
          style={{
            textAlign: 'center', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(184, 132, 10, 0.06)', border: '1px solid rgba(184, 132, 10, 0.15)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <StarShine size={28} weight="Bold" />
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-display)', fontSize: 14, fontWeight: 700, color: '#B8840A', lineHeight: 1.4 }}>
            Unanimous!
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 13, color: '#3D2E1F', marginTop: 4 }}>
            <strong style={{ color: '#B8840A' }}>{name(summary.targetId)}</strong> gets 20 silver!
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerItem}
          transition={VIVID_SPRING.bouncy}
          style={{
            textAlign: 'center', padding: '14px 16px', borderRadius: 12,
            background: 'rgba(139, 115, 85, 0.06)', border: '1px solid rgba(139, 115, 85, 0.12)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <Danger size={28} weight="Bold" />
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-display)', fontSize: 14, fontWeight: 700, color: '#9B8E7E', lineHeight: 1.4 }}>
            No consensus
          </div>
          <div style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 12, color: '#9B8E7E', marginTop: 4 }}>
            Picks were split — no bonus this time.
          </div>
        </motion.div>
      )}
      {/* Individual picks */}
      <motion.div variants={staggerItem} transition={VIVID_SPRING.bouncy} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(decisions).map(([pid, dec]) => {
          const targetId = (dec as any).targetId;
          const picker = roster[pid];
          const target = roster[targetId];
          return (
            <div key={pid} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 8,
              background: 'rgba(139,115,85,0.04)',
            }}>
              <PersonaAvatar avatarUrl={picker?.avatarUrl} personaName={picker?.personaName} size={22} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--vivid-text-base)', fontFamily: 'var(--vivid-font-body)' }}>
                {picker?.personaName || pid}
              </span>
              <span style={{ fontSize: 11, color: '#9B8E7E', margin: '0 2px' }}>&rarr;</span>
              <PersonaAvatar avatarUrl={target?.avatarUrl} personaName={target?.personaName} size={22} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#B8840A', fontFamily: 'var(--vivid-font-body)' }}>
                {target?.personaName || targetId}
              </span>
            </div>
          );
        })}
      </motion.div>
    </>
  );
}
```

- [ ] **Step 5: Enhance GiftOrGriefReveal to show individual nominators**

The GiftOrGrief reveal already shows nomination counts per target. Add "nominated by" detail below each target entry. Update the function to accept `decisions`:

Update the call site (around line 71):
```tsx
// BEFORE:
        <GiftOrGriefReveal summary={summary} name={firstName} roster={roster} />
// AFTER:
        <GiftOrGriefReveal summary={summary} name={firstName} roster={roster} decisions={decisions} />
```

Update the function signature:
```tsx
// BEFORE:
function GiftOrGriefReveal({
  summary, name, roster,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  roster: Record<string, SocialPlayer>;
}) {

// AFTER:
function GiftOrGriefReveal({
  summary, name, roster, decisions,
}: {
  summary: Record<string, any>;
  name: (id: string) => string;
  roster: Record<string, SocialPlayer>;
  decisions: Record<string, any>;
}) {
```

Add "nominated by" text below each target's name in the sorted list. Inside the `.map()`, after the vote count span:

```tsx
              {/* Show who nominated this person */}
              <div style={{ fontSize: 10, color: '#9B8E7E', marginTop: 2, fontFamily: 'var(--vivid-font-body)' }}>
                {Object.entries(decisions)
                  .filter(([, dec]) => (dec as any).targetId === pid)
                  .map(([nomId]) => name(nomId))
                  .join(', ')}
              </div>
```

Add this inside the existing `sorted.map()` entry, after the flex row's closing `</div>`. Wrap the entry in a parent div that has flexDirection column:

```tsx
// Replace each entry in sorted.map with:
            <div key={pid} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 10,
                background: isGifted ? 'rgba(45, 106, 79, 0.06)' : isGrieved ? 'rgba(157, 23, 77, 0.06)' : 'rgba(139, 115, 85, 0.04)',
                border: `1px solid ${isGifted ? 'rgba(45, 106, 79, 0.15)' : isGrieved ? 'rgba(157, 23, 77, 0.15)' : 'rgba(139, 115, 85, 0.08)'}`,
              }}>
                {/* existing content: name, badges, vote count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--vivid-font-body)', fontSize: 13, fontWeight: 600, color: isGifted ? '#2D6A4F' : isGrieved ? '#9D174D' : '#3D2E1F' }}>
                    {name(pid)}
                  </span>
                  {isGifted && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#2D6A4F' }}><Gift size={14} weight="Bold" /><span style={{ fontSize: 12, fontWeight: 700 }}>+10</span></span>}
                  {isGrieved && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#9D174D' }}><Danger size={14} weight="Bold" /><span style={{ fontSize: 12, fontWeight: 700 }}>-10</span></span>}
                </div>
                <span style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 12, fontWeight: 700, color: '#9B8E7E' }}>
                  {count} {count === 1 ? 'vote' : 'votes'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#9B8E7E', padding: '0 12px', fontFamily: 'var(--vivid-font-body)' }}>
                from {Object.entries(decisions).filter(([, dec]) => (dec as any).targetId === pid).map(([nomId]) => name(nomId)).join(', ')}
              </div>
            </div>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd apps/client && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/client/src/cartridges/dilemmas/DilemmaReveal.tsx
git commit -m "feat(client): show individual decisions in all dilemma reveals"
```

---

### Task 15: Final build + visual verification

- [ ] **Step 1: Full client build**

Run: `cd apps/client && npm run build 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 2: Visual test with bot-game**

Run:
```bash
GAME_SERVER=http://localhost:8787 CLIENT_URL=http://localhost:5173 node e2e/scripts/bot-game.mjs
```

Open the player URL. Verify:
1. **Leaderboard** shows game-specific stats (correct answers, distance, etc.) alongside silver
2. **HotTake results** show individual player stances (Agree/Disagree per player)
3. **WYR results** show individual player choices (Option A/B per player)
4. **PlayerPick results** show all individual picks with arrows
5. **Prediction results** show all individual predictions with arrows
6. **SilverGambit reveal** shows DONATE/KEEP per player
7. **Spotlight reveal** shows who picked whom
8. **GiftOrGrief reveal** shows "from Player A, Player B" below each nomination

- [ ] **Step 3: Final commit if needed**

```bash
git add -A
git commit -m "fix(client): visual polish for cartridge result enhancements"
```
