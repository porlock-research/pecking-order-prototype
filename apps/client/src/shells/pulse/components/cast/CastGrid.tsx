import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { CastCard } from './CastCard';

export function CastGrid() {
  const roster = useGameStore(s => s.roster);
  const { playerId, openSendSilver, openNudge, openDM } = usePulse();

  // Include all players (self too — they need to see their own rank).
  // Sort alive players by silver descending (it's a leaderboard).
  // Eliminated players go in their own dimmed section below.
  const entries = Object.entries(roster);
  const alive = entries
    .filter(([_, p]) => p.status === 'ALIVE')
    .sort((a, b) => (b[1].silver ?? 0) - (a[1].silver ?? 0));
  const eliminated = entries.filter(([_, p]) => p.status === 'ELIMINATED');

  return (
    <div
      style={{
        padding: 12,
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {/* Leaderboard label */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'var(--pulse-text-3)', textTransform: 'uppercase' }}>
          Cast · {alive.length} alive
        </span>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--pulse-text-3)', fontFamily: 'var(--po-font-body)' }}>
          ranked by silver
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, gridAutoRows: 'min-content' }}>
        {alive.map(([id, player], idx) => (
          <CastCard
            key={id}
            player={player}
            playerId={id}
            playerIndex={Object.keys(roster).indexOf(id)}
            rank={idx + 1}
            isSelf={id === playerId}
            onSilver={() => openSendSilver(id)}
            onDM={() => openDM(id)}
            onNudge={() => openNudge(id)}
          />
        ))}
      </div>

      {/* Eliminated section */}
      {eliminated.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 2px 8px' }}>
            <span style={{ flex: 1, height: 1, background: 'var(--pulse-border)' }} />
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'var(--pulse-text-3)', textTransform: 'uppercase' }}>
              Eliminated · {eliminated.length}
            </span>
            <span style={{ flex: 1, height: 1, background: 'var(--pulse-border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, gridAutoRows: 'min-content' }}>
            {eliminated.map(([id, player]) => (
              <CastCard
                key={id}
                player={player}
                playerId={id}
                playerIndex={Object.keys(roster).indexOf(id)}
                isSelf={id === playerId}
                compact
                onSilver={() => {}}
                onDM={() => {}}
                onNudge={() => {}}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
