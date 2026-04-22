import type { CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore, selectDmThreads } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { getPlayerColor } from '../../colors';
import { usePulse } from '../../PulseShell';

const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '10px 16px', background: 'transparent', border: 'none',
  borderBottom: '1px solid var(--pulse-border)',
  cursor: 'pointer', textAlign: 'left', width: '100%',
};

const pipStyle: CSSProperties = {
  background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
  fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 'var(--pulse-radius-sm)',
};

export function ConversationsList() {
  const threads = useGameStore(useShallow(selectDmThreads));
  const roster = useGameStore(s => s.roster);
  const lastReadTimestamp = useGameStore(s => s.lastReadTimestamp);
  const playerId = useGameStore(s => s.playerId);
  const { openDM } = usePulse();

  if (threads.length === 0) {
    return (
      <div style={{ padding: '16px 20px 24px', textAlign: 'center', fontSize: 13, color: 'var(--pulse-text-3)', lineHeight: 1.5 }}>
        No DMs yet.<br />
        <span style={{ color: 'var(--pulse-text-2)' }}>Tap a face to start one.</span>
      </div>
    );
  }

  const rosterIds = Object.keys(roster);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {threads.map(t => {
        const last = t.messages[t.messages.length - 1];
        const preview = last?.content?.slice(0, 60) ?? '';
        const time = last ? new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const lastRead = lastReadTimestamp[t.channelId] ?? 0;
        const unread = t.messages.filter(m => m.timestamp > lastRead && m.senderId !== playerId).length;

        if (t.isGroup) {
          const members = (t.memberIds || []).map(id => roster[id]).filter(Boolean);
          const name = members.slice(0, 3).map(m => m.personaName.split(' ')[0]).join(', ');
          return (
            <button key={t.channelId} onClick={() => openDM(t.channelId, true)} style={rowStyle}>
              <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0 }}>
                {members.slice(0, 2).map((m, i) => (
                  <img
                    key={m.id}
                    src={resolveAvatarUrl(m.avatarUrl) || ''}
                    alt=""
                    loading="lazy"
                    width={26}
                    height={26}
                    style={{
                      position: 'absolute', width: 26, height: 26, borderRadius: 'var(--pulse-radius-xs)', objectFit: 'cover',
                      top: i === 0 ? 0 : 10, left: i === 0 ? 0 : 10,
                      border: '2px solid var(--pulse-bg)',
                    }}
                  />
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pulse-text-1)' }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--pulse-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--pulse-text-3)' }}>{time}</span>
                {unread > 0 && <span style={pipStyle}>{unread}</span>}
              </div>
            </button>
          );
        }

        const partner = roster[t.partnerId];
        if (!partner) return null;
        const color = getPlayerColor(rosterIds.indexOf(t.partnerId));
        return (
          <button key={t.channelId} onClick={() => openDM(t.partnerId)} style={rowStyle}>
            <img src={resolveAvatarUrl(partner.avatarUrl) || ''} alt=""
              loading="lazy" width={36} height={36}
              style={{ width: 36, height: 36, borderRadius: 'var(--pulse-radius-sm)', objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color }}>{partner.personaName}</div>
              <div style={{ fontSize: 11, color: 'var(--pulse-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span style={{ fontSize: 10, color: 'var(--pulse-text-3)' }}>{time}</span>
              {unread > 0 && <span style={pipStyle}>{unread}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
