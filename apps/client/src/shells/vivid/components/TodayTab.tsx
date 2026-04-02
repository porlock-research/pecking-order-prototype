import React, { useMemo, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import {
  VotingPhases, ArcadePhases, PromptPhases, DilemmaPhases,
  VOTE_TYPE_INFO, GAME_TYPE_INFO, ACTIVITY_TYPE_INFO, DILEMMA_TYPE_INFO,
} from '@pecking-order/shared-types';
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
  /** true when data lives in an active cartridge slot (panels can render) */
  hasActiveData?: boolean;
  /** snapshot from completedCartridges (fallback when active slot is empty) */
  snapshot?: any;
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
  return c.phase === VotingPhases.REVEAL || c.phase === VotingPhases.WINNER ? 'completed' : 'live';
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
      entries.push({ kind: 'voting', typeKey: activeVotingCartridge.voteType, state, sortKey: state === 'completed' ? 0 : 1, hasActiveData: true });
      seenKinds.add('voting');
    }
    if (activeGameCartridge) {
      const state = resolveGameState(activeGameCartridge);
      entries.push({ kind: 'game', typeKey: activeGameCartridge.gameType, state, sortKey: state === 'completed' ? 0 : 1, hasActiveData: true });
      seenKinds.add('game');
    }
    if (activePromptCartridge) {
      const state = resolvePromptState(activePromptCartridge);
      entries.push({ kind: 'prompt', typeKey: activePromptCartridge.promptType, state, sortKey: state === 'completed' ? 0 : 1, hasActiveData: true });
      seenKinds.add('prompt');
    }
    if (activeDilemma) {
      const state = resolveDilemmaState(activeDilemma);
      entries.push({ kind: 'dilemma', typeKey: activeDilemma.dilemmaType, state, sortKey: state === 'completed' ? 0 : 1, hasActiveData: true });
      seenKinds.add('dilemma');
    }

    // 2. Completed cartridges not in active slots (replaced by newer cartridge of same kind)
    for (const c of completedCartridges) {
      if (c.snapshot?.dayIndex !== dayIndex) continue;
      if (seenKinds.has(c.kind)) continue;
      const typeKey = c.snapshot?.mechanism || c.snapshot?.gameType || c.snapshot?.promptType || c.snapshot?.dilemmaType || 'UNKNOWN';
      entries.push({ kind: c.kind, typeKey, state: 'completed', sortKey: 0, hasActiveData: false, snapshot: c.snapshot });
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
  const { kind, typeKey, state, hasActiveData, snapshot } = activity;
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
        onPlay={() => onPlayGame(activeGameCartridge)}
      />
    );
  }

  // Completed but active slot cleaned up — render compact summary from snapshot
  if (state === 'completed' && !hasActiveData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={VIVID_SPRING.gentle}
        style={{
          background: 'var(--vivid-bg-surface)',
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid var(--vivid-border)',
        }}
      >
        <SectionHeader kind={kind} typeKey={typeKey} state={state} />
        {snapshot && <CompletedSummary kind={kind} snapshot={snapshot} />}
      </motion.div>
    );
  }

  // Live or completed with active data: render the actual cartridge panel inline
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

/* ── compact summary for completed cartridges without active data ── */

function CompletedSummary({ kind, snapshot }: { kind: string; snapshot: any }) {
  const roster = useGameStore(s => s.roster);

  const name = (id: string) => roster[id]?.personaName || id;

  let content: React.ReactNode = null;

  if (kind === 'voting') {
    const eliminatedId = snapshot.eliminatedId ?? snapshot.results?.eliminatedId;
    const winnerId = snapshot.winnerId ?? snapshot.results?.winnerId;
    const tallies = snapshot.tallies ?? snapshot.results?.tallies ?? {};
    const sorted = Object.entries(tallies).sort(([, a], [, b]) => (b as number) - (a as number));
    content = (
      <>
        {eliminatedId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(157,23,77,0.06)', border: '1px solid rgba(157,23,77,0.15)' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#9D174D', fontFamily: 'var(--vivid-font-body)' }}>{name(eliminatedId)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#9D174D', fontFamily: 'var(--vivid-font-mono)' }}>Eliminated</span>
          </div>
        )}
        {winnerId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(184,132,10,0.06)', border: '1px solid rgba(184,132,10,0.15)' }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#B8840A', fontFamily: 'var(--vivid-font-body)' }}>{name(winnerId)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#B8840A', fontFamily: 'var(--vivid-font-mono)' }}>Winner</span>
          </div>
        )}
        {sorted.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {sorted.map(([pid, count]) => (
              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
                <span style={{ flex: 1, fontSize: 12, color: pid === eliminatedId ? '#9D174D' : 'var(--vivid-text-base)', fontFamily: 'var(--vivid-font-body)' }}>{name(pid)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--vivid-text-muted)', fontFamily: 'var(--vivid-font-mono)' }}>{count as number}</span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  } else if (kind === 'game') {
    const rewards = snapshot.silverRewards ?? {};
    const sorted = Object.entries(rewards).sort(([, a], [, b]) => (b as number) - (a as number));
    content = sorted.length > 0 ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sorted.map(([pid, silver], i) => (
          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px' }}>
            <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: i === 0 ? '#B8840A' : 'var(--vivid-text-muted)', fontFamily: 'var(--vivid-font-mono)' }}>{i + 1}</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: i === 0 ? 700 : 400, color: 'var(--vivid-text-base)', fontFamily: 'var(--vivid-font-body)' }}>{name(pid)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#B8840A', fontFamily: 'var(--vivid-font-mono)' }}>+{silver as number}</span>
          </div>
        ))}
      </div>
    ) : <CompletedLabel text="Completed" />;
  } else if (kind === 'prompt') {
    const count = snapshot.participantCount ?? snapshot.responses ? Object.keys(snapshot.responses ?? {}).length : 0;
    content = <CompletedLabel text={`${count} response${count === 1 ? '' : 's'}`} />;
  } else if (kind === 'dilemma') {
    const timedOut = snapshot.summary?.timedOut;
    content = <CompletedLabel text={timedOut ? "Time's up" : 'Resolved'} />;
  }

  return (
    <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {content}
    </div>
  );
}

function CompletedLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--vivid-text-muted)', fontFamily: 'var(--vivid-font-body)', textAlign: 'center', padding: '8px 0' }}>
      {text}
    </div>
  );
}
