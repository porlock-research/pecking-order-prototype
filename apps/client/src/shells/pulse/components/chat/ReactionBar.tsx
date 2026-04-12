import { motion } from 'framer-motion';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING } from '../../springs';
import type { ChatMessage } from '@pecking-order/shared-types';

const EMOJIS = ['😂', '👀', '🔥', '💀', '❤️'];

interface ReactionBarProps {
  messageId: string;
  message: ChatMessage;
  onClose: () => void;
}

export function ReactionBar({ messageId, message: _message, onClose }: ReactionBarProps) {
  const { engine } = usePulse();

  const handleReact = (emoji: string) => {
    engine.sendReaction(messageId, emoji);
    onClose();
  };

  return (
    <>
      {/* Invisible backdrop to dismiss */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={PULSE_SPRING.pop}
        style={{
          // Replaces the action-trigger bar in EXACT same position
          // (triggers are at top:-14, height ~28; we match the top edge
          // and grow horizontally to the left)
          position: 'absolute',
          top: -14,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          padding: '2px 4px',
          borderRadius: 14,
          background: 'var(--pulse-surface-3)',
          border: '1px solid var(--pulse-border-2)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
          zIndex: 51,
          transformOrigin: 'right center',
        }}
      >
        {EMOJIS.map(emoji => (
          <motion.button
            key={emoji}
            whileTap={{ scale: 1.4 }}
            transition={PULSE_SPRING.pop}
            onClick={(e) => {
              e.stopPropagation();
              handleReact(emoji);
            }}
            style={{
              width: 28,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: 8,
              padding: 0,
            }}
          >
            {emoji}
          </motion.button>
        ))}
      </motion.div>
    </>
  );
}
