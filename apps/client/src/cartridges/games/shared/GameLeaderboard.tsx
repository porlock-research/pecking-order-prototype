import { motion, useReducedMotion } from 'framer-motion';
import { GameTypes } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface PlayerResult {
  playerId: string;
  silverReward: number;
  result?: Record<string, number>;
}

const GAME_STAT_CONFIG: Record<string, { key: string; label: string; format?: (v: number) => string }> = {
  [GameTypes.GAP_RUN]: { key: 'distance', label: 'Distance' },
  [GameTypes.GRID_PUSH]: { key: 'bankedTotal', label: 'Score' },
  [GameTypes.SEQUENCE]: { key: 'correctRounds', label: 'Rounds' },
  [GameTypes.REACTION_TIME]: { key: 'avgReactionMs', label: 'Avg', format: v => `${v}ms` },
  [GameTypes.COLOR_MATCH]: { key: 'correctAnswers', label: 'Correct' },
  [GameTypes.STACKER]: { key: 'height', label: 'Height' },
  [GameTypes.QUICK_MATH]: { key: 'correctAnswers', label: 'Correct' },
  [GameTypes.SIMON_SAYS]: { key: 'roundsCompleted', label: 'Rounds' },
  [GameTypes.AIM_TRAINER]: { key: 'score', label: 'Score' },
  [GameTypes.TRIVIA]: { key: 'correctCount', label: 'Correct' },
  [GameTypes.SHOCKWAVE]: { key: 'wavesCleared', label: 'Waves' },
  [GameTypes.ORBIT]: { key: 'transfers', label: 'Transfers' },
  [GameTypes.BEAT_DROP]: { key: 'score', label: 'Score' },
  [GameTypes.INFLATE]: { key: 'score', label: 'Score' },
  [GameTypes.SNAKE]: { key: 'score', label: 'Pellets' },
  [GameTypes.FLAPPY]: { key: 'score', label: 'Score' },
  [GameTypes.COLOR_SORT]: { key: 'sortedTubes', label: 'Sorted' },
  [GameTypes.BLINK]: { key: 'score', label: 'Score' },
  [GameTypes.RECALL]: { key: 'highestSize', label: 'Grid', format: v => v > 0 ? `${v}×${v}` : '—' },
};

interface GameLeaderboardProps {
  allPlayerResults: PlayerResult[];
  currentPlayerId: string;
  gameType?: string;
  /** Per-game accent — applied to top-1 highlight + self row tint. */
  accent: string;
}

/**
 * COMPLETED-state leaderboard with olympic-podium lift on top-3.
 * Replaces the legacy uniform-row Leaderboard. Per `.impeccable.md`
 * Olympic-podium shape: lift #1 up rather than dropping #2/#3 down
 * (triumphal feel vs gap-in-list feel).
 */
export function GameLeaderboard({
  allPlayerResults,
  currentPlayerId,
  gameType,
  accent,
}: GameLeaderboardProps) {
  const reduce = useReducedMotion();
  const statConfig = gameType ? GAME_STAT_CONFIG[gameType] : undefined;
  const roster = useGameStore(s => s.roster);

  if (!allPlayerResults || allPlayerResults.length === 0) return null;

  const podiumLift = (rank: number) =>
    rank === 0 ? -10 : rank === 1 ? -2 : 0;

  return (
    <div style={{ padding: '0 4px 4px' }}>
      <p
        style={{
          margin: '0 0 12px',
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.22em',
          color: 'var(--po-text-dim)',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        Leaderboard
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {allPlayerResults.map((entry, rank) => {
          const player = roster[entry.playerId];
          const isMe = entry.playerId === currentPlayerId;
          const isWinner = rank === 0;
          const inPodium = rank < 3;
          const lift = podiumLift(rank);
          const personaName = player?.personaName || entry.playerId;

          return (
            <motion.div
              key={entry.playerId}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 + lift * -1 }}
              animate={{ opacity: 1, y: lift }}
              transition={{
                delay: 0.06 * rank,
                type: 'spring',
                stiffness: 360,
                damping: 26,
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                background: isMe
                  ? `color-mix(in oklch, ${accent} 12%, transparent)`
                  : isWinner
                    ? `color-mix(in oklch, ${accent} 8%, var(--po-bg-glass))`
                    : 'var(--po-bg-glass)',
                border: isMe
                  ? `1px solid color-mix(in oklch, ${accent} 32%, transparent)`
                  : isWinner
                    ? `1px solid color-mix(in oklch, ${accent} 22%, transparent)`
                    : '1px solid transparent',
                boxShadow: inPodium
                  ? `0 6px 18px -10px color-mix(in oklch, ${accent} 28%, transparent)`
                  : 'none',
              }}
              aria-label={`${rank + 1}. ${isMe ? 'You' : personaName}`}
            >
              <span
                style={{
                  width: 22,
                  textAlign: 'center',
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 14,
                  fontWeight: 800,
                  color: isWinner ? accent : 'var(--po-text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {rank + 1}
              </span>

              <PersonaAvatar
                avatarUrl={player?.avatarUrl}
                personaName={player?.personaName}
                size={isWinner ? 32 : 28}
              />

              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isMe ? accent : 'var(--po-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {isMe ? 'You' : personaName}
              </span>

              {statConfig && entry.result?.[statConfig.key] != null && (
                <span
                  style={{
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--po-text-dim)',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {statConfig.format
                    ? statConfig.format(entry.result[statConfig.key])
                    : entry.result[statConfig.key]}{' '}
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      opacity: 0.7,
                    }}
                  >
                    {statConfig.label}
                  </span>
                </span>
              )}

              <span
                style={{
                  fontFamily: 'var(--po-font-display)',
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'var(--po-gold)',
                  fontVariantNumeric: 'tabular-nums',
                  background: `color-mix(in oklch, var(--po-gold) 14%, transparent)`,
                  borderRadius: 999,
                  padding: '4px 10px',
                  flexShrink: 0,
                }}
              >
                +{entry.silverReward}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
