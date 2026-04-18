import { useGameStore, selectStandings } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../../colors';
import { usePulse } from '../../PulseShell';
import { Coins } from '../../icons';

export function StandingsRest() {
  const standings = useGameStore(selectStandings);
  const rest = standings.slice(3);
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const { openDM } = usePulse();
  if (rest.length === 0) return null;
  const rosterIds = Object.keys(roster);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 16px 12px' }}>
      {rest.map(entry => {
        const color = getPlayerColor(rosterIds.indexOf(entry.id));
        const isSelf = entry.id === playerId;
        return (
          <button
            key={entry.id}
            onClick={() => { if (!isSelf) openDM(entry.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              background: isSelf ? 'rgba(255,59,111,0.12)' : 'transparent',
              border: 'none', borderRadius: 10,
              cursor: isSelf ? 'default' : 'pointer', textAlign: 'left',
              width: '100%',
            }}
          >
            {/* Rank pill — matches DmHero's rank pill style so rank reads
                the same across surfaces. */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 28,
              fontSize: 10, fontWeight: 800, letterSpacing: 0.2,
              color: 'var(--pulse-accent)',
              background: 'rgba(255, 59, 111, 0.2)',
              padding: '3px 7px', borderRadius: 8,
              fontVariantNumeric: 'tabular-nums',
            }}>#{entry.rank}</span>
            <img src={resolveAvatarUrl(entry.player.avatarUrl) || ''} alt=""
              loading="lazy" width={32} height={32}
              style={{ width: 32, height: 32, borderRadius: 7, objectFit: 'cover' }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color }}>{entry.player.personaName}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--pulse-gold)', fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <Coins size={11} weight="fill" />
              {entry.player.silver}
            </span>
          </button>
        );
      })}
    </div>
  );
}
