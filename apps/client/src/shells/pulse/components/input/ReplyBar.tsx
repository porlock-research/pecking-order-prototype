import { X } from '../../icons';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';
import type { ChatMessage } from '@pecking-order/shared-types';

interface ReplyBarProps {
  message: ChatMessage;
  onCancel: () => void;
}

export function ReplyBar({ message, onCancel }: ReplyBarProps) {
  const roster = useGameStore(s => s.roster);
  const reduce = useReducedMotion();
  const player = roster[message.senderId];
  const playerIndex = Object.keys(roster).indexOf(message.senderId);
  const color = getPlayerColor(playerIndex);

  return (
    <motion.div
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      transition={PULSE_SPRING.pop}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        padding: '8px 12px',
        background: 'var(--pulse-surface-2)',
        fontSize: 12,
        fontFamily: 'var(--po-font-body)',
        borderTop: '1px solid rgba(255, 59, 111, 0.18)',
      }}
    >
      <div style={{ width: 2, borderRadius: 1, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--pulse-accent)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Replying to <span style={{ color, textTransform: 'none', letterSpacing: 0 }}>{player?.personaName}</span>
        </span>
        <span style={{ color: 'var(--pulse-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {message.content.slice(0, 60)}
        </span>
      </div>
      <button
        onClick={onCancel}
        aria-label="Cancel reply"
        style={{
          width: 32,
          height: 32,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--pulse-text-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: 8,
        }}
      >
        <X size={14} weight="bold" />
      </button>
    </motion.div>
  );
}
