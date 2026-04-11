import { motion } from 'framer-motion';
import { PULSE_SPRING } from '../../springs';
import type { ChatMessage } from '@pecking-order/shared-types';

interface BroadcastCardProps {
  message: ChatMessage;
}

export function BroadcastCard({ message }: BroadcastCardProps) {
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
        padding: '8px 12px',
        margin: '4px 0',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--pulse-text-2)',
        fontFamily: 'var(--po-font-body)',
        background: isGold
          ? 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.06) 50%, transparent 100%)'
          : 'var(--pulse-surface-2)',
        backgroundSize: isGold ? '200% 100%' : undefined,
        animation: isGold ? 'pulse-shimmer 2s ease forwards' : undefined,
        border: '1px solid var(--pulse-border)',
      }}
    >
      <span>{message.content}</span>
    </motion.div>
  );
}
