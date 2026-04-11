import { motion } from 'framer-motion';
import { Reply } from 'lucide-react';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING } from '../../springs';
import type { ChatMessage } from '@pecking-order/shared-types';

const EMOJIS = ['😂', '👀', '🔥', '💀', '❤���'];

interface ReactionBarProps {
  messageId: string;
  message: ChatMessage;
  onClose: () => void;
}

export function ReactionBar({ messageId, message, onClose }: ReactionBarProps) {
  const { engine } = usePulse();

  const handleReact = (emoji: string) => {
    engine.sendReaction(messageId, emoji);
    onClose();
  };

  const handleReply = () => {
    // Dispatch reply mode — PulseInput listens via a shared state
    window.dispatchEvent(new CustomEvent('pulse:reply', { detail: { message } }));
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
        initial={{ opacity: 0, scale: 0.9, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={PULSE_SPRING.pop}
        style={{
          position: 'absolute',
          top: -44,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '6px 8px',
          borderRadius: 24,
          background: 'var(--pulse-surface-3)',
          border: '1px solid var(--pulse-border)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          zIndex: 51,
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
              width: 36,
              height: 36,
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

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 24,
            background: 'var(--pulse-text-4)',
            margin: '0 2px',
          }}
        />

        {/* Reply button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            handleReply();
          }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            padding: '4px 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--pulse-text-2)',
          }}
        >
          <Reply size={16} />
          <span style={{ fontSize: 8, fontWeight: 600, fontFamily: 'var(--po-font-body)' }}>Reply</span>
        </motion.button>
      </motion.div>
    </>
  );
}
