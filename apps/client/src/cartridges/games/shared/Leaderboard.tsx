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
};

interface LeaderboardProps {
  allPlayerResults: PlayerResult[];
  currentPlayerId: string;
  gameType?: string;
}

export function Leaderboard({ allPlayerResults, currentPlayerId, gameType }: LeaderboardProps) {
  const statConfig = gameType ? GAME_STAT_CONFIG[gameType] : undefined;
  const roster = useGameStore(s => s.roster);

  if (!allPlayerResults || allPlayerResults.length === 0) return null;

  return (
    <div style={{ padding: '0 4px' }}>
      <p style={{
        fontSize: 9, fontWeight: 700,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
        fontFamily: 'var(--vivid-font-mono)',
        textAlign: 'center',
      }}>
        Leaderboard
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {allPlayerResults.map((entry, rank) => {
          const player = roster[entry.playerId];
          const isMe = entry.playerId === currentPlayerId;

          return (
            <div
              key={entry.playerId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 10,
                background: isMe ? 'rgba(196,166,106,0.1)' : 'rgba(139,115,85,0.06)',
                border: isMe ? '1px solid rgba(196,166,106,0.25)' : '1px solid transparent',
              }}
            >
              <span style={{
                width: 20, textAlign: 'center',
                fontSize: 12, fontWeight: 800,
                color: rank === 0 ? 'var(--vivid-phase-accent)' : 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--vivid-font-mono)',
              }}>
                {rank + 1}
              </span>

              <PersonaAvatar
                avatarUrl={player?.avatarUrl}
                personaName={player?.personaName}
                size={28}
              />

              <span style={{
                flex: 1, fontSize: 12, fontWeight: 600,
                color: isMe ? 'var(--vivid-phase-accent)' : 'var(--vivid-text-base)',
                fontFamily: 'var(--vivid-font-display)',
              }}>
                {isMe ? 'You' : (player?.personaName || entry.playerId)}
              </span>

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

              <span style={{
                fontSize: 11, fontWeight: 700,
                color: 'var(--vivid-phase-accent)',
                fontFamily: 'var(--vivid-font-mono)',
                background: 'rgba(196,166,106,0.15)',
                borderRadius: 12,
                padding: '2px 8px',
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
