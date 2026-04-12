import { usePillStates } from '../hooks/usePillStates';
import { useGameStore } from '../../../store/useGameStore';
import { Pill } from './Pill';

/**
 * PulseBar persists between ticker and chat.
 * When cartridges are active → shows pills.
 * When empty → shows online-now presence (who's here with you).
 */
export function PulseBar() {
  const pills = usePillStates();
  const roster = useGameStore(s => s.roster);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);

  // When no pills, show online-now row (social proof — the game is alive)
  if (pills.length === 0) {
    const online = onlinePlayers.map(id => roster[id]).filter(Boolean);
    if (online.length === 0) return null;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          height: 44,
          position: 'relative',
          zIndex: 2,
          borderBottom: '1px solid var(--pulse-border)',
          background: 'var(--pulse-surface)',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'var(--pulse-text-3)', textTransform: 'uppercase', flexShrink: 0 }}>
          Online
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: -2, flex: 1, overflow: 'hidden' }}>
          {online.slice(0, 6).map((p, i) => (
            <div key={p.id} style={{ position: 'relative', marginLeft: i === 0 ? 0 : -8 }}>
              <img
                src={p.avatarUrl}
                alt={p.personaName}
                title={p.personaName}
                style={{
                  width: 28, height: 28, borderRadius: 8, objectFit: 'cover', objectPosition: 'center top',
                  border: '2px solid var(--pulse-surface)',
                  display: 'block',
                }}
              />
              <span
                style={{
                  position: 'absolute', bottom: -1, right: -1,
                  width: 8, height: 8, borderRadius: '50%',
                  background: '#2ecc71', boxShadow: '0 0 4px #2ecc71',
                  border: '2px solid var(--pulse-surface)',
                }}
              />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--pulse-text-2)', fontFamily: 'var(--po-font-body)', flexShrink: 0 }}>
          {online.length} here
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        height: 48,
        overflowX: 'auto',
        overflowY: 'hidden',
        position: 'relative',
        zIndex: 2,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        scrollbarWidth: 'none',
      }}
    >
      {pills.map(pill => (
        <Pill key={pill.id} pill={pill} />
      ))}
    </div>
  );
}
