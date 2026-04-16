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

interface LeaderboardProps {
  allPlayerResults: PlayerResult[];
  currentPlayerId: string;
  gameType?: string;
}

/**
 * Shell-agnostic leaderboard — uses only --po-* design contract so it
 * adopts whichever shell wraps the game cartridge. The winning row picks
 * up --po-gold; the current player's row gets a gold-tinted highlight.
 */
export function Leaderboard({ allPlayerResults, currentPlayerId, gameType }: LeaderboardProps) {
  const statConfig = gameType ? GAME_STAT_CONFIG[gameType] : undefined;
  const roster = useGameStore(s => s.roster);

  if (!allPlayerResults || allPlayerResults.length === 0) return null;

  return (
    <div style={{ padding: '0 4px' }}>
      <p style={{
        fontSize: 10, fontWeight: 800,
        color: 'var(--po-text-dim)',
        textTransform: 'uppercase',
        letterSpacing: '0.16em',
        marginBottom: 10,
        marginTop: 0,
        fontFamily: 'var(--po-font-display)',
        textAlign: 'center',
      }}>
        Leaderboard
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {allPlayerResults.map((entry, rank) => {
          const player = roster[entry.playerId];
          const isMe = entry.playerId === currentPlayerId;
          const isWinner = rank === 0;

          return (
            <div
              key={entry.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 10,
                background: isMe
                  ? 'color-mix(in oklch, var(--po-gold) 10%, transparent)'
                  : 'var(--po-bg-glass, rgba(255,255,255,0.04))',
                border: isMe
                  ? '1px solid color-mix(in oklch, var(--po-gold) 28%, transparent)'
                  : '1px solid transparent',
                transition: 'background 0.25s ease',
              }}
            >
              <span style={{
                width: 20, textAlign: 'center',
                fontSize: 13, fontWeight: 800,
                color: isWinner ? 'var(--po-gold)' : 'var(--po-text-dim)',
                fontFamily: 'var(--po-font-display)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {rank + 1}
              </span>

              <PersonaAvatar
                avatarUrl={player?.avatarUrl}
                personaName={player?.personaName}
                size={28}
              />

              <span style={{
                flex: 1, fontSize: 13, fontWeight: 600,
                color: isMe ? 'var(--po-gold)' : 'var(--po-text)',
                fontFamily: 'var(--po-font-body)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}>
                {isMe ? 'You' : (player?.personaName || entry.playerId)}
              </span>

              {statConfig && entry.result?.[statConfig.key] != null && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: 'var(--po-text-dim)',
                  fontFamily: 'var(--po-font-display)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: 0.2,
                  flexShrink: 0,
                }}>
                  {statConfig.format
                    ? statConfig.format(entry.result[statConfig.key])
                    : entry.result[statConfig.key]}{' '}
                  <span style={{
                    fontSize: 9,
                    color: 'var(--po-text-dim)',
                    opacity: 0.7,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}>
                    {statConfig.label}
                  </span>
                </span>
              )}

              <span style={{
                fontSize: 11, fontWeight: 800,
                color: 'var(--po-gold)',
                fontFamily: 'var(--po-font-display)',
                fontVariantNumeric: 'tabular-nums',
                background: 'color-mix(in oklch, var(--po-gold) 16%, transparent)',
                borderRadius: 12,
                padding: '3px 9px',
                flexShrink: 0,
                letterSpacing: 0.2,
              }}>
                +{entry.silverReward}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
