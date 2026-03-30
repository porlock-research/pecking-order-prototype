import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface PlayerResult {
  playerId: string;
  silverReward: number;
  result?: Record<string, number>;
}

interface LeaderboardProps {
  allPlayerResults: PlayerResult[];
  currentPlayerId: string;
}

export function Leaderboard({ allPlayerResults, currentPlayerId }: LeaderboardProps) {
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
