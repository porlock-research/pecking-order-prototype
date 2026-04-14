import { motion } from 'framer-motion';
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

  const ringWidth = status === 'typing' ? 3 : 2;
  const opacity = status === 'idle' ? 0.3 : 1;
  const outer = size + ringWidth * 4;

  return (
    <motion.div
      animate={status === 'typing' ? { scale: [1, 1.03, 1] } : { scale: 1 }}
      transition={status === 'typing' ? { duration: 1, repeat: Infinity } : { duration: 0.2 }}
      style={{
        width: outer,
        height: outer,
        borderRadius: '50%',
        border: `${ringWidth}px solid ${color}`,
        opacity,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden' }}>
        {children}
      </div>
    </motion.div>
  );
}
