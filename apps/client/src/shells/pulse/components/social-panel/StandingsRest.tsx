import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectStandings } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../../colors';
import { usePulse } from '../../PulseShell';

export function StandingsRest() {
  const standings = useGameStore(useShallow(s => selectStandings(s).slice(3)));
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const { openDM } = usePulse();
  if (standings.length === 0) return null;
  const rosterIds = Object.keys(roster);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 16px 12px' }}>
      {standings.map(entry => {
        const color = getPlayerColor(rosterIds.indexOf(entry.id));
        const isSelf = entry.id === playerId;
        return (
          <button
            key={entry.id}
            onClick={() => { if (!isSelf) openDM(entry.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
              background: isSelf ? 'rgba(255,59,111,0.12)' : 'transparent',
              border: 'none', borderRadius: 10,
              cursor: isSelf ? 'default' : 'pointer', textAlign: 'left',
              width: '100%',
            }}
          >
            <span style={{ width: 22, fontSize: 11, color: 'var(--pulse-text-3)', fontWeight: 700 }}>#{entry.rank}</span>
            <img src={resolveAvatarUrl(entry.player.avatarUrl) || ''} alt=""
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color }}>{entry.player.personaName}</span>
            <span style={{ fontSize: 12, color: '#ffd700', fontWeight: 700 }}>{entry.player.silver}</span>
          </button>
        );
      })}
    </div>
  );
}
