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
    return (
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={PULSE_SPRING.gentle}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          margin: '6px 0',
          borderRadius: 'var(--pulse-radius-md)',
          background: 'color-mix(in oklch, var(--pulse-accent) 7%, transparent)',
          border: '1px solid color-mix(in oklch, var(--pulse-accent) 18%, transparent)',
          fontFamily: 'var(--po-font-body)',
        }}
      >
        <div
          style={{
            width: 24, height: 24, borderRadius: 'var(--pulse-radius-xs)',
            background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Broadcast size={13} weight="fill" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--pulse-accent)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
            Game Master
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--pulse-text-1)', lineHeight: 1.4 }}>
            {message.content}
          </div>
        </div>
      </motion.div>
    );
  }

  const isGold = message.content.toLowerCase().includes('silver');
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={PULSE_SPRING.gentle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        margin: '3px 0',
        borderRadius: 'var(--pulse-radius-sm)',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--pulse-text-2)',
        fontFamily: 'var(--po-font-body)',
        background: isGold ? 'color-mix(in oklch, var(--pulse-gold) 6%, transparent)' : 'var(--pulse-surface-2)',
        border: isGold ? '1px solid color-mix(in oklch, var(--pulse-gold) 18%, transparent)' : '1px solid var(--pulse-border)',
      }}
    >
      <span>{message.content}</span>
    </motion.div>
  );
}
