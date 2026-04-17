import type { SocialPlayer } from '@pecking-order/shared-types';
import { getPlayerColor } from '../../colors';
import { PersonaImage, initialsOf } from '../common/PersonaImage';
import { UserPlus, ArrowLeft } from '../../icons';
import { useGameStore, selectCanAddMemberTo, selectGroupDmTitle } from '../../../../store/useGameStore';

interface Props {
  members: { id: string; player: SocialPlayer; colorIdx: number }[];
  pendingMembers?: { id: string; player: SocialPlayer; colorIdx: number }[];
  channelId: string | null;
  onClose: () => void;
}

export function DmGroupHero({ members, pendingMembers = [], channelId, onClose }: Props) {
  const canAdd = useGameStore(s => channelId ? selectCanAddMemberTo(s, channelId) : false);
  const startAddMember = useGameStore(s => s.startAddMember);
  const title = useGameStore(s => channelId ? selectGroupDmTitle(s, channelId) : '');
  const fallbackTitle = members.slice(0, 3).map(m => m.player.personaName.split(' ')[0]).join(', ')
    + (members.length > 3 ? ` +${members.length - 3}` : '');
  const displayTitle = title || fallbackTitle;

  return (
    <div style={{ position: 'relative', width: '100%', height: 'var(--pulse-hero-height)', background: 'var(--pulse-bg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {[...members, ...pendingMembers].map(m => {
          const isPending = pendingMembers.some(p => p.id === m.id);
          return (
            <div key={m.id} style={{ flex: 1, borderRight: '2px solid var(--pulse-bg)', position: 'relative', opacity: isPending ? 0.55 : 1 }}>
              <PersonaImage
                avatarUrl={m.player.avatarUrl}
                cacheKey={m.id}
                preferredVariant="headshot"
                fallbackChain={['headshot']}
                initials={initialsOf(m.player.personaName)}
                playerColor={getPlayerColor(m.colorIdx)}
                alt={m.player.personaName}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isPending ? 'grayscale(0.6)' : 'none' }}
              />
              {isPending && (
                <span style={{
                  position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                  padding: '2px 8px', borderRadius: 9,
                  background: 'rgba(20,20,26,0.8)', color: 'var(--pulse-text-2)',
                  fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}>Pending</span>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={onClose} aria-label="Close group DM" style={{
        position: 'absolute', top: 10, left: 10,
        width: 44, height: 44, borderRadius: 22,
        background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)', color: 'var(--pulse-on-accent)',
        cursor: 'pointer', padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ArrowLeft size={20} weight="bold" />
      </button>

      {canAdd && channelId && (
        <button
          onClick={() => startAddMember(channelId)}
          aria-label="Add members"
          style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '8px 12px', borderRadius: 14,
            background: 'rgba(20,20,26,0.55)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--pulse-on-accent)', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}
        >
          <UserPlus weight="bold" size={16} />
          <span>Add</span>
        </button>
      )}

      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '40px 16px 14px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
      }}>
        <h2 style={{
          margin: 0,
          fontFamily: 'var(--po-font-display)',
          fontSize: 'clamp(26px, 7vw, 36px)',
          fontWeight: 700,
          color: 'var(--pulse-on-accent)',
          letterSpacing: '-0.04em',
          lineHeight: 0.98,
        }}>
          {displayTitle}
        </h2>
        <div style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
          color: 'rgba(255,255,255,0.75)', marginTop: 2,
        }}>
          {members.length + pendingMembers.length} members
          {pendingMembers.length > 0 && (
            <span style={{ color: 'rgba(255,255,255,0.5)' }}> · {pendingMembers.length} pending</span>
          )}
        </div>
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
          {pendingMembers.slice(0, 2).map(m => {
            const color = getPlayerColor(m.colorIdx);
            return (
              <span key={`pending-${m.id}`} style={{
                background: 'rgba(20,20,26,0.55)', color: 'rgba(255,255,255,0.6)',
                padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                border: `1px dashed ${color}66`,
              }}>{m.player.personaName.split(' ')[0]} · pending</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
