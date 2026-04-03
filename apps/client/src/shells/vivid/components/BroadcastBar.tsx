import React, { useMemo } from 'react';
import { useGameStore, selectUnreadFeedCount } from '../../../store/useGameStore';
import { DayPhases, VotingPhases, ArcadePhases, PromptPhases, DilemmaPhases } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';

/* ------------------------------------------------------------------ */
/*  Phase label map                                                    */
/* ------------------------------------------------------------------ */

const PHASE_LABELS: Record<string, string> = {
  [DayPhases.PREGAME]: 'Pre-Game',
  [DayPhases.MORNING]: 'Morning',
  [DayPhases.SOCIAL]: 'Social Hour',
  [DayPhases.GAME]: 'Game Time',
  [DayPhases.ACTIVITY]: 'Activity',
  [DayPhases.VOTING]: 'Voting',
  [DayPhases.ELIMINATION]: 'Elimination',
  [DayPhases.FINALE]: 'Finale',
  [DayPhases.GAME_OVER]: 'Finale',
};

/* ------------------------------------------------------------------ */
/*  Timeline action → human label                                      */
/* ------------------------------------------------------------------ */

const ACTION_LABELS: Record<string, string> = {
  OPEN_VOTING: 'Voting',
  START_GAME: 'Game',
  START_ACTIVITY: 'Activity',
  START_DILEMMA: 'Dilemma',
  INJECT_PROMPT: 'Prompt',
  END_DAY: 'Day End',
  CLOSE_DMS: 'DMs Close',
  OPEN_DMS: 'DMs Open',
  OPEN_GROUP_CHAT: 'Chat Opens',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTimeUntil(ms: number): string {
  if (ms <= 0) return 'now';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface LivePill {
  label: string;
  key: string;
}

function isVotingLive(c: any): boolean {
  return c && c.phase !== VotingPhases.REVEAL && c.phase !== VotingPhases.WINNER;
}

function isGameLive(c: any): boolean {
  if (!c) return false;
  if (c.status === ArcadePhases.COMPLETED) return false;
  if (c.allPlayerResults) return false;
  if (c.phase === 'REVEAL' || c.phase === 'SCOREBOARD') return false;
  // Sync-decision machines set winner when done
  if (c.winner !== undefined) return false;
  return true;
}

function isPromptLive(c: any): boolean {
  return c && c.phase !== PromptPhases.RESULTS;
}

function isDilemmaLive(c: any): boolean {
  return c && c.phase !== DilemmaPhases.REVEAL;
}

function buildLivePills(
  activeVoting: any,
  activeGame: any,
  activePrompt: any,
  activeDilemma: any,
): LivePill[] {
  const pills: LivePill[] = [];

  if (isVotingLive(activeVoting)) {
    pills.push({ label: 'Voting', key: 'voting' });
  }
  if (isGameLive(activeGame)) {
    pills.push({ label: 'Game', key: 'game' });
  }
  if (isPromptLive(activePrompt)) {
    pills.push({ label: 'Prompt', key: 'prompt' });
  }
  if (isDilemmaLive(activeDilemma)) {
    pills.push({ label: 'Dilemma', key: 'dilemma' });
  }

  return pills;
}

function useNextUpHint(): string | null {
  const manifest = useGameStore(s => s.manifest);
  const dayIndex = useGameStore(s => s.dayIndex);

  return useMemo(() => {
    if (!manifest?.days) return null;
    const currentDay = manifest.days[dayIndex - 1]; // dayIndex is 1-indexed, array is 0-indexed
    if (!currentDay?.timeline) return null;

    const now = Date.now();
    for (const event of currentDay.timeline) {
      const eventTime = new Date(event.time).getTime();
      if (eventTime <= now) continue;

      const label = ACTION_LABELS[event.action];
      if (!label) continue;

      const diff = eventTime - now;
      return `${label} in ${formatTimeUntil(diff)}`;
    }

    return null;
  }, [manifest, dayIndex]);
}

/* ------------------------------------------------------------------ */
/*  Bell icon SVG                                                      */
/* ------------------------------------------------------------------ */

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={hasUnread ? 'rgba(61,46,31,0.6)' : 'rgba(61,46,31,0.35)'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  BroadcastBar (Activity Status Strip)                               */
/* ------------------------------------------------------------------ */

interface BroadcastBarProps {
  onBellClick?: () => void;
  onStripClick?: () => void;
}

export function BroadcastBar({ onBellClick, onStripClick }: BroadcastBarProps) {
  const dayIndex = useGameStore(s => s.dayIndex);
  const phase = useGameStore(s => s.phase);
  const unreadCount = useGameStore(selectUnreadFeedCount);
  const activeVotingCartridge = useGameStore(s => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore(s => s.activeGameCartridge);
  const activePromptCartridge = useGameStore(s => s.activePromptCartridge);
  const activeDilemma = useGameStore(s => s.activeDilemma);

  const livePills = useMemo(
    () => buildLivePills(activeVotingCartridge, activeGameCartridge, activePromptCartridge, activeDilemma),
    [activeVotingCartridge, activeGameCartridge, activePromptCartridge, activeDilemma],
  );

  const nextUpHint = useNextUpHint();
  // When the L3 state says GAME/VOTING/ACTIVITY but no cartridge is actually live,
  // the phase is stale — fall back to Social Hour instead of showing a misleading label.
  const cartridgePhases: Set<string> = new Set([DayPhases.GAME, DayPhases.VOTING, DayPhases.ACTIVITY]);
  const rawLabel = PHASE_LABELS[phase] || 'Waiting';
  const phaseLabel = (livePills.length === 0 && cartridgePhases.has(phase as DayPhase))
    ? 'Social Hour'
    : rawLabel;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
        background: 'var(--vivid-bg-surface)',
        borderBottom: '2px solid rgba(139, 115, 85, 0.08)',
        flexShrink: 0,
        zIndex: 20,
        gap: 10,
      }}
    >
      {/* Bell icon — tap opens dashboard */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onBellClick?.();
        }}
        style={{
          position: 'relative',
          flexShrink: 0,
          cursor: onBellClick ? 'pointer' : undefined,
          padding: 2,
        }}
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: -2,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: '#e85a4f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 9,
                fontWeight: 700,
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </div>
        )}
      </div>

      {/* Separator */}
      <div
        style={{
          width: 1,
          height: 16,
          background: 'rgba(139, 115, 85, 0.15)',
          flexShrink: 0,
        }}
      />

      {/* Strip content — tap navigates to Today */}
      <div
        onClick={onStripClick}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflow: 'hidden',
          cursor: onStripClick ? 'pointer' : undefined,
          minWidth: 0,
        }}
      >
        {/* Day label */}
        {dayIndex > 0 && (
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 11,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.35)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            DAY {dayIndex}
          </span>
        )}

        {/* Live pills OR phase label fallback */}
        {livePills.length > 0 ? (
          livePills.map((pill) => (
            <div
              key={pill.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(196, 166, 106, 0.15)',
                border: '1px solid rgba(196, 166, 106, 0.3)',
                borderRadius: 20,
                padding: '4px 10px',
                flexShrink: 0,
              }}
            >
              <div className="vivid-live-dot" style={{ width: 6, height: 6 }} />
              <span
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--vivid-phase-accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {pill.label}
              </span>
            </div>
          ))
        ) : (
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--vivid-phase-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {phaseLabel}
          </span>
        )}

        {/* Next up hint */}
        {nextUpHint && (
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono)',
              fontSize: 10,
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 1,
              minWidth: 0,
            }}
          >
            {nextUpHint}
          </span>
        )}

        {/* Chevron */}
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 14,
            color: 'rgba(255, 255, 255, 0.25)',
            flexShrink: 0,
            marginLeft: 'auto',
          }}
        >
          &#8250;
        </span>
      </div>
    </div>
  );
}
