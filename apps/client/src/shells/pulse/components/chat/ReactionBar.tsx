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
          // Replace the action button bar in-place — same top:-14 as triggers,
          // expanding from the right edge so it grows into existing space
          position: 'absolute',
          top: -16,
          right: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          padding: '3px 5px',
          borderRadius: 18,
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
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '50%',
            }}
          >
            {emoji}
          </motion.button>
        ))}
      </motion.div>
    </>
  );
}
