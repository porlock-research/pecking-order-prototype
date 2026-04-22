import type { CastStripEntry } from '../../../../store/useGameStore';
import { useGameStore } from '../../../../store/useGameStore';
import { PersonaImage, initialsOf } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';

interface Props {
  entry: CastStripEntry;
  onTap: (entry: CastStripEntry) => void;
}

export function GroupChip({ entry, onTap }: Props) {
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const others = (entry.memberIds || []).filter(id => id !== playerId).slice(0, 2);
  const firstNames = (entry.memberIds || [])
    .filter(id => id !== playerId)
    .map(id => roster[id]?.personaName?.split(' ')[0] ?? '')
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
  const edgeColor = entry.unreadCount > 0 ? 'var(--pulse-accent)' : 'rgba(255,255,255,0.1)';
  const glow = entry.unreadCount > 0 ? '0 0 12px color-mix(in oklch, var(--pulse-accent) 35%, transparent)' : 'none';

  const ariaLabel = `Group with ${firstNames || 'members'}${entry.unreadCount > 0 ? `, ${entry.unreadCount} unread` : ''}`;

  return (
    <button
      onClick={() => onTap(entry)}
      aria-label={ariaLabel}
      style={{
        position: 'relative', width: 72, height: 100,
        flexShrink: 0, padding: 0, border: 'none', background: 'transparent',
        borderRadius: 14, cursor: 'pointer', scrollSnapAlign: 'start',
      }}
    >
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden',
        background: 'var(--pulse-surface-3)', border: `2px solid ${edgeColor}`, boxShadow: glow,
        display: 'flex',
      }}>
        {others.map((id) => {
          const member = roster[id];
          const memberColor = getPlayerColor(Math.max(0, Object.keys(roster).indexOf(id)));
          return (
            <div key={id} style={{ flex: 1, position: 'relative' }}>
              {member && (
                <PersonaImage
                  avatarUrl={member.avatarUrl}
                  cacheKey={id}
                  preferredVariant="full"
                  fallbackChain={['medium', 'headshot']}
                  initials={initialsOf(member.personaName)}
                  playerColor={memberColor}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
          );
        })}
        <span aria-hidden="true" style={{
          position: 'absolute', top: 4, right: 4,
          background: 'rgba(0,0,0,0.75)', color: 'var(--pulse-on-accent)',
          fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
          padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase',
        }}>Group</span>
        <div aria-hidden="true" style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '14px 6px 5px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 700, textAlign: 'center',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{firstNames}</div>
      </div>
      {entry.unreadCount > 0 && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: -4, right: -4,
          background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
          minWidth: 18, height: 18, padding: '0 4px',
          borderRadius: 9, fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--pulse-bg)',
        }}>{entry.unreadCount > 9 ? '9+' : entry.unreadCount}</span>
      )}
    </button>
  );
}
