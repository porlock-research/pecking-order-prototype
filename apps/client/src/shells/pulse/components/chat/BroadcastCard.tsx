import { motion } from 'framer-motion';
import { Broadcast } from '../../icons';
import { PULSE_SPRING } from '../../springs';
import { GAME_MASTER_ID } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';

interface BroadcastCardProps {
  message: ChatMessage;
}

export function BroadcastCard({ message }: BroadcastCardProps) {
  const isGM = message.senderId === GAME_MASTER_ID;

  if (isGM) {
    // GM messages get distinct treatment — hosts announcements matter
    return (
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={PULSE_SPRING.bouncy}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '14px 16px',
          margin: '8px 0',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(255,59,111,0.1) 0%, rgba(255,59,111,0.02) 100%)',
          border: '1px solid rgba(255,59,111,0.25)',
          fontFamily: 'var(--po-font-body)',
        }}
      >
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--pulse-accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Broadcast size={18} weight="fill" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--pulse-accent)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
            Game Master
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--pulse-text-1)', lineHeight: 1.45 }}>
            {message.content}
          </div>
        </div>
      </motion.div>
    );
  }

  // Regular broadcast events (silver, etc.)
  const isGold = message.content.toLowerCase().includes('silver');
  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={PULSE_SPRING.bouncy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        margin: '4px 0',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--pulse-text-1)',
        fontFamily: 'var(--po-font-body)',
        background: isGold
          ? 'linear-gradient(90deg, rgba(255,215,0,0.04) 0%, rgba(255,215,0,0.1) 50%, rgba(255,215,0,0.04) 100%)'
          : 'var(--pulse-surface-2)',
        backgroundSize: isGold ? '200% 100%' : undefined,
        animation: isGold ? 'pulse-shimmer 2s ease forwards' : undefined,
        border: isGold ? '1px solid rgba(255,215,0,0.2)' : '1px solid var(--pulse-border)',
      }}
    >
      <span>{message.content}</span>
    </motion.div>
  );
}
