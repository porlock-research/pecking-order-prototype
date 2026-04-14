import type { Channel, SocialPlayer } from '@pecking-order/shared-types';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { usePulse } from '../../PulseShell';

interface Props { channel: Channel; inviter: SocialPlayer; }

export function InviteRow({ channel, inviter }: Props) {
  const { engine } = usePulse();
  const stereotype = inviter.bio && inviter.bio.length > 4 && inviter.bio.length <= 50 ? inviter.bio : '';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px',
      background: 'var(--pulse-surface)', border: '1px solid rgba(255,140,66,0.3)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <img src={resolveAvatarUrl(inviter.avatarUrl) || ''} alt=""
          style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)' }}>
            {inviter.personaName} wants to DM you
          </div>
          <div style={{ fontSize: 10, color: 'var(--pulse-text-3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {stereotype ? `${stereotype} · ` : ''}just now
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => engine.acceptDm(channel.id)} style={{
          flex: 1, background: '#2ecc71', color: '#fff', border: 'none',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
        }}>Accept</button>
        <button onClick={() => engine.declineDm(channel.id)} style={{
          flex: 1, background: 'var(--pulse-bg)', color: 'var(--pulse-text-3)',
          border: '1px solid var(--pulse-border)',
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Decline</button>
      </div>
    </div>
  );
}
