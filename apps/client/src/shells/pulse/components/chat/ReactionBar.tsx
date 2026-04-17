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
        initial={{ opacity: 0, scale: 0.9, y: -2 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={PULSE_SPRING.pop}
        style={{
          // Inline trailing: appears in the same flow slot as the action row,
          // below the message. Aligned to the content-side edge.
          // position:relative required for zIndex to take effect above the
          // fixed backdrop (see .claude/guardrails/finite-zindex-needs-position).
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          marginTop: 4,
          padding: '2px 4px',
          borderRadius: 12,
          background: 'var(--pulse-surface-3)',
          border: '1px solid var(--pulse-border-2)',
          // Pink-tinted layered glow — replaces generic drop shadow.
          boxShadow: '0 0 0 1px rgba(255, 59, 111, 0.18), 0 8px 28px -8px rgba(255, 59, 111, 0.35)',
          zIndex: PULSE_Z.reactionBar,
          transformOrigin: isSelf ? 'right center' : 'left center',
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
