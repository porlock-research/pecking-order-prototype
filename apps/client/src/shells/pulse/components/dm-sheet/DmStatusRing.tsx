import type { ReactNode } from 'react';
import { useGameStore } from '../../../../store/useGameStore';

type Status = 'online' | 'typing' | 'idle';

interface Props {
  partnerId: string;
  channelId: string | null;
  color: string;
  size: number;
  children: ReactNode;
}

export function DmStatusRing({ partnerId, channelId, color, size, children }: Props) {
  const isOnline = useGameStore(s => s.onlinePlayers.includes(partnerId));
  const typingIn = useGameStore(s => s.typingPlayers?.[partnerId]);

  let status: Status = 'idle';
  if (channelId && typingIn === channelId) status = 'typing';
  else if (isOnline) status = 'online';

  // Typing reads via an outer halo (box-shadow) + full opacity; no ambient
  // scale loop. "Only pending/urgent state pulses ambiently" — typing is
  // transient. The ring is a fixed 2px border so the layout never shifts;
  // typing emphasis comes from a 1px box-shadow outline (paints outside the
  // box, doesn't trigger layout) instead of growing the border-width.
  const opacity = status === 'idle' ? 0.3 : 1;
  const haloOutline = status === 'typing' ? `0 0 0 1px ${color}` : 'none';
  const outer = size + 8; // room for fixed 2px border + halo

  return (
    <div
      style={{
        width: outer,
        height: outer,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        opacity,
        boxShadow: haloOutline,
        transition: 'opacity 180ms ease, box-shadow 180ms ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}
