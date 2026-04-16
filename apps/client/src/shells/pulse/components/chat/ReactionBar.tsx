import { motion } from 'framer-motion';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import type { ChatMessage } from '@pecking-order/shared-types';

const EMOJIS = ['😂', '👀', '🔥', '💀', '❤️'];

interface ReactionBarProps {
  messageId: string;
  message: ChatMessage;
  isSelf: boolean;
  onClose: () => void;
}

export function ReactionBar({ messageId, message: _message, isSelf, onClose }: ReactionBarProps) {
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
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: backdropFor(PULSE_Z.reactionBar),
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85 }}
        transition={PULSE_SPRING.pop}
        style={{
          // Replaces the action-trigger bar in EXACT same position.
          // Self messages have triggers on the LEFT (row-reverse layout),
          // others on the RIGHT — picker mirrors that placement.
          position: 'absolute',
          top: -14,
          [isSelf ? 'left' : 'right']: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          padding: '2px 4px',
          borderRadius: 14,
          background: 'var(--pulse-surface-3)',
          border: '1px solid var(--pulse-border-2)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
          zIndex: PULSE_Z.reactionBar,
          transformOrigin: isSelf ? 'left center' : 'right center',
        }}
      >
        {EMOJIS.map(emoji => (
          <motion.button
            key={emoji}
            whileTap={PULSE_TAP.reaction}
            transition={PULSE_SPRING.pop}
            onClick={(e) => {
              e.stopPropagation();
              handleReact(emoji);
            }}
            aria-label={`React with ${emoji}`}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
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
