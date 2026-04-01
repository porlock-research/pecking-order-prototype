import React, { useMemo } from 'react';
import { useGameStore } from '../../../store/useGameStore';
import type { CompletedCartridge } from '../../../store/useGameStore';
import {
  DayPhases,
  VotingPhases, ArcadePhases, PromptPhases, DilemmaPhases,
} from '@pecking-order/shared-types';
import type { VoteType, GameType, PromptType } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import { ActivityCard } from './today/ActivityCard';
import type { ActivityCardProps } from './today/ActivityCard';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TodayTabProps {
  onOpenCartridge: (kind: string, cartridge: any) => void;
}

/* ------------------------------------------------------------------ */
/*  Timeline action -> card kind mapping                               */
/* ------------------------------------------------------------------ */

const ACTION_TO_KIND: Record<string, ActivityCardProps['kind']> = {
  OPEN_VOTING: 'voting',
  CLOSE_VOTING: 'voting',
  START_GAME: 'game',
  END_GAME: 'game',
  START_CARTRIDGE: 'game',
  START_ACTIVITY: 'prompt',
  END_ACTIVITY: 'prompt',
  INJECT_PROMPT: 'prompt',
  START_DILEMMA: 'dilemma',
  END_DILEMMA: 'dilemma',
};

/** Actions that represent the *start* of a cartridge (not end/close). */
const START_ACTIONS = new Set([
  'OPEN_VOTING', 'START_GAME', 'START_CARTRIDGE', 'START_ACTIVITY', 'INJECT_PROMPT', 'START_DILEMMA',
]);

/* ------------------------------------------------------------------ */
/*  Countdown formatter                                                */
/* ------------------------------------------------------------------ */

function formatCountdown(ms: number): string | null {
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return 'Starting soon';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) {
    return minutes > 0 ? `Starts in ${hours}h ${minutes}m` : `Starts in ${hours}h`;
  }
  return `Starts in ${minutes}m`;
}

/* ------------------------------------------------------------------ */
/*  Card state resolution                                              */
/* ------------------------------------------------------------------ */

interface CardEntry {
  kind: ActivityCardProps['kind'];
  typeKey: string;
  state: ActivityCardProps['state'];
  countdown?: string | null;
  summaryLine?: string;
  sortKey: number; // lower = higher in list
  cartridge?: any;
}

function resolveVotingState(cartridge: any): 'live' | 'completed' {
  const phase = cartridge?.phase;
  if (phase === VotingPhases.REVEAL || phase === VotingPhases.WINNER) return 'completed';
  return 'live';
}

function resolveGameState(cartridge: any): 'live' | 'completed' {
  const status = cartridge?.status;
  if (status === ArcadePhases.COMPLETED) return 'completed';
  // Sync decision games use phase
  const phase = cartridge?.phase;
  if (phase === 'REVEAL' || phase === 'SCOREBOARD') return 'completed';
  return 'live';
}

function resolvePromptState(cartridge: any): 'live' | 'completed' {
  const phase = cartridge?.phase;
  if (phase === PromptPhases.RESULTS) return 'completed';
  return 'live';
}

function resolveDilemmaState(cartridge: any): 'live' | 'completed' {
  const phase = cartridge?.phase;
  if (phase === DilemmaPhases.REVEAL) return 'completed';
  return 'live';
}

/* ------------------------------------------------------------------ */
/*  TodayTab                                                           */
/* ------------------------------------------------------------------ */

export function TodayTab({ onOpenCartridge }: TodayTabProps) {
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  const roster = useGameStore(s => s.roster);
  const completedCartridges = useGameStore(s => s.completedCartridges);
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);
  const activeDilemma = useGameStore(s => s.activeDilemma);

  const currentDay = manifest?.days?.[dayIndex - 1];
  const now = Date.now();

  const cards = useMemo(() => {
    const result: CardEntry[] = [];
    const seenKinds = new Set<string>();

    // --- Completed cartridges for this day ---
    const dayCompleted = completedCartridges.filter(
      c => (c.snapshot.dayIndex ?? 0) === dayIndex
    );

    for (const c of dayCompleted) {
      const typeKey = getTypeKeyFromCompleted(c);
      const summary = buildSummaryLine(c, roster);
      result.push({
        kind: c.kind,
        typeKey,
        state: 'completed',
        summaryLine: summary,
        sortKey: 0,
        cartridge: c.snapshot,
      });
      seenKinds.add(c.kind);
    }

    // --- Active cartridges ---
    if (activeVotingCartridge && !seenKinds.has('voting')) {
      const st = resolveVotingState(activeVotingCartridge);
      const typeKey = activeVotingCartridge.voteType ?? currentDay?.voteType ?? 'MAJORITY';
      const summary = st === 'completed'
        ? buildVotingSummary(activeVotingCartridge, roster)
        : undefined;
      result.push({
        kind: 'voting',
        typeKey,
        state: st,
        summaryLine: summary,
        sortKey: st === 'completed' ? 0 : 1,
        cartridge: activeVotingCartridge,
      });
      seenKinds.add('voting');
    }

    if (activeGameCartridge && !seenKinds.has('game')) {
      const st = resolveGameState(activeGameCartridge);
      const typeKey = activeGameCartridge.gameType ?? currentDay?.gameType ?? 'NONE';
      result.push({
        kind: 'game',
        typeKey,
        state: st,
        sortKey: st === 'completed' ? 0 : 1,
        cartridge: activeGameCartridge,
      });
      seenKinds.add('game');
    }

    if (activePromptCartridge && !seenKinds.has('prompt')) {
      const st = resolvePromptState(activePromptCartridge);
      const typeKey = activePromptCartridge.promptType ?? currentDay?.activityType ?? 'HOT_TAKE';
      result.push({
        kind: 'prompt',
        typeKey,
        state: st,
        sortKey: st === 'completed' ? 0 : 1,
        cartridge: activePromptCartridge,
      });
      seenKinds.add('prompt');
    }

    if (activeDilemma && !seenKinds.has('dilemma')) {
      const st = resolveDilemmaState(activeDilemma);
      const typeKey = activeDilemma.dilemmaType ?? currentDay?.dilemmaType ?? 'SILVER_GAMBIT';
      result.push({
        kind: 'dilemma',
        typeKey,
        state: st,
        sortKey: st === 'completed' ? 0 : 1,
        cartridge: activeDilemma,
      });
      seenKinds.add('dilemma');
    }

    // --- Upcoming from timeline ---
    // Show all scheduled activities that don't have an active/completed cartridge yet.
    // Past events are still shown (the activity hasn't started, or is pending injection
    // in ADMIN mode). Future events show a countdown.
    if (currentDay?.timeline) {
      let upcomingIdx = 0;
      for (const event of currentDay.timeline) {
        const kind = ACTION_TO_KIND[event.action];
        if (!kind || !START_ACTIONS.has(event.action)) continue;
        if (seenKinds.has(kind)) continue;

        const eventTime = new Date(event.time).getTime();
        const ms = eventTime - now;

        const typeKey = resolveTimelineTypeKey(kind, event, currentDay);
        result.push({
          kind,
          typeKey,
          state: 'upcoming',
          countdown: ms > 0 ? formatCountdown(ms) : undefined,
          sortKey: 2 + upcomingIdx,
        });
        seenKinds.add(kind);
        upcomingIdx++;
      }
    }

    // Sort: completed (0), live (1), upcoming (2+)
    result.sort((a, b) => a.sortKey - b.sortKey);
    return result;
  }, [
    completedCartridges, dayIndex, activeVotingCartridge, activeGameCartridge,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    activePromptCartridge, activeDilemma, currentDay, roster, phase,
  ]);

  const activityCount = cards.length;
  let upcomingCounter = 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        className="vivid-hide-scrollbar"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '14px 16px 32px',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            marginBottom: 14,
            paddingLeft: 2,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--vivid-text-dim, #9B8E7E)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Day {dayIndex} — Today
          </span>
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--vivid-text-dim, #9B8E7E)',
              opacity: 0.6,
            }}
          >
            {activityCount} {activityCount === 1 ? 'activity' : 'activities'}
          </span>
        </div>

        {/* Card stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cards.map((card) => {
            const idx = card.state === 'upcoming' ? upcomingCounter++ : 0;
            return (
              <ActivityCard
                key={`${card.kind}-${card.typeKey}-${card.state}`}
                kind={card.kind}
                typeKey={card.typeKey}
                state={card.state}
                countdown={card.countdown}
                summaryLine={card.summaryLine}
                upcomingIndex={idx}
                onTap={() => onOpenCartridge(card.kind, card.cartridge)}
              />
            );
          })}
        </div>

        {/* Empty state */}
        {activityCount === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 20px',
              fontFamily: 'var(--vivid-font-body, sans-serif)',
              fontSize: 14,
              color: 'var(--vivid-text-dim, #9B8E7E)',
            }}
          >
            No activities scheduled yet.
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper utils                                                       */
/* ------------------------------------------------------------------ */

function getTypeKeyFromCompleted(c: CompletedCartridge): string {
  switch (c.kind) {
    case 'voting': return c.snapshot.mechanism ?? 'MAJORITY';
    case 'game': return c.snapshot.gameType ?? 'NONE';
    case 'prompt': return c.snapshot.promptType ?? 'HOT_TAKE';
    case 'dilemma': return c.snapshot.dilemmaType ?? 'SILVER_GAMBIT';
  }
}

function resolveTimelineTypeKey(
  kind: ActivityCardProps['kind'],
  event: any,
  currentDay: any,
): string {
  // Payload may carry the type directly
  if (event.payload?.voteType) return event.payload.voteType;
  if (event.payload?.gameType) return event.payload.gameType;
  if (event.payload?.promptType) return event.payload.promptType;
  if (event.payload?.activityType) return event.payload.activityType;
  if (event.payload?.dilemmaType) return event.payload.dilemmaType;

  // Fall back to the day's manifest
  switch (kind) {
    case 'voting': return currentDay?.voteType ?? 'MAJORITY';
    case 'game': return currentDay?.gameType ?? 'NONE';
    case 'prompt': return currentDay?.activityType ?? 'HOT_TAKE';
    case 'dilemma': return currentDay?.dilemmaType ?? 'SILVER_GAMBIT';
  }
}

function buildSummaryLine(c: CompletedCartridge, roster: Record<string, any>): string {
  switch (c.kind) {
    case 'voting':
      return buildVotingSummary(c.snapshot, roster);
    case 'game': {
      const rewards = c.snapshot.silverRewards ?? {};
      const topEntry = Object.entries(rewards).sort(([, a], [, b]) => (b as number) - (a as number))[0];
      if (topEntry) {
        const name = roster[topEntry[0]]?.personaName ?? topEntry[0];
        return `${name} won`;
      }
      return 'Game completed';
    }
    case 'prompt':
      return `${c.snapshot.participantCount ?? 0} responses`;
    case 'dilemma':
      return c.snapshot.summary?.timedOut ? "Time's up" : 'Dilemma resolved';
  }
}

function buildVotingSummary(snapshot: any, roster: Record<string, any>): string {
  const eliminatedId = snapshot.eliminatedId ?? snapshot.results?.eliminatedId;
  if (eliminatedId) {
    const name = roster[eliminatedId]?.personaName ?? eliminatedId;
    return `${name} eliminated`;
  }
  const winnerId = snapshot.winnerId ?? snapshot.results?.winnerId;
  if (winnerId) {
    const name = roster[winnerId]?.personaName ?? winnerId;
    return `${name} won`;
  }
  return 'Vote completed';
}
