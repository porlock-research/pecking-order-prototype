import type { Channel, SocialPlayer } from '@pecking-order/shared-types';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { usePulse } from '../../PulseShell';
import { InviteActions } from '../common/InviteActions';

interface Props { channel: Channel; inviter: SocialPlayer; }

function relativeTime(ts: number | undefined): string {
  if (!ts) return 'just now';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function InviteRow({ channel, inviter }: Props) {
  const { engine } = usePulse();
  const stereotype = inviter.bio && inviter.bio.length > 4 && inviter.bio.length <= 50 ? inviter.bio : '';
  const when = relativeTime(channel.createdAt);
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px',
      background: 'var(--pulse-surface)', border: '1px solid rgba(255,140,66,0.3)',
      borderRadius: 'var(--pulse-radius-md)',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <img src={resolveAvatarUrl(inviter.avatarUrl) || ''} alt=""
          loading="lazy" width={44} height={44}
          style={{ width: 44, height: 44, borderRadius: 'var(--pulse-radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--pulse-text-1)' }}>
            {inviter.personaName} wants to talk
          </div>
          <div style={{
            fontSize: 10, color: 'var(--pulse-text-3)',
            textTransform: 'uppercase', letterSpacing: '0.1em',
            marginTop: 2,
          }}>
            {stereotype ? `${stereotype} · ` : ''}{when}
          </div>
        </div>
      </div>
      <InviteActions
        layout="horizontal"
        onAccept={() => engine.acceptDm(channel.id)}
        onDecline={() => engine.declineDm(channel.id)}
      />
    </div>
  );
}
