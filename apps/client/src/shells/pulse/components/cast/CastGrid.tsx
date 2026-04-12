import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { CastCard } from './CastCard';

export function CastGrid() {
  const roster = useGameStore(s => s.roster);
  const { playerId, openSendSilver, openNudge, openDM } = usePulse();

  // Sort: alive first (by silver desc), then eliminated
  const entries = Object.entries(roster).filter(([id]) => id !== playerId);
  const alive = entries.filter(([_, p]) => p.status === 'ALIVE').sort((a, b) => (b[1].silver ?? 0) - (a[1].silver ?? 0));
  const eliminated = entries.filter(([_, p]) => p.status === 'ELIMINATED');
  const sorted = [...alive, ...eliminated];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
        padding: 12,
        gridAutoRows: 'min-content',
        alignContent: 'start',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {sorted.map(([id, player]) => (
        <CastCard
          key={id}
          player={player}
          playerId={id}
          playerIndex={Object.keys(roster).indexOf(id)}
          onSilver={() => openSendSilver(id)}
          onDM={() => openDM(id)}
          onNudge={() => openNudge(id)}
        />
      ))}
    </div>
  );
}
