import type { SocialPlayer } from '@pecking-order/shared-types';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../../colors';

interface Props {
  members: { id: string; player: SocialPlayer; colorIdx: number }[];
  onClose: () => void;
}

export function DmGroupHero({ members, onClose }: Props) {
  const names = members.slice(0, 3).map(m => m.player.personaName.split(' ')[0]).join(', ');
  const suffix = members.length > 3 ? ` +${members.length - 3}` : '';

  return (
    <div style={{ position: 'relative', width: '100%', height: 280, background: '#111', overflow: 'hidden' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {members.map(m => {
          const src = resolveAvatarUrl(m.player.avatarUrl);
          return (
            <div key={m.id} style={{ flex: 1, borderRight: '2px solid var(--pulse-bg)' }}>
              {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
          );
        })}
      </div>

      <button onClick={onClose} aria-label="Close group DM" style={{
        position: 'absolute', top: 10, left: 10,
        width: 38, height: 38, borderRadius: 19,
        background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
        fontSize: 20, cursor: 'pointer',
      }}>‹</button>

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 16px 14px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
      }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
          {names}{suffix}
        </div>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
          color: 'rgba(255,255,255,0.75)', marginTop: 2,
        }}>{members.length} members</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {members.slice(0, 4).map(m => {
            const color = getPlayerColor(m.colorIdx);
            return (
              <span key={m.id} style={{
                background: `${color}33`, color,
                padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
              }}>{m.player.personaName.split(' ')[0]}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
