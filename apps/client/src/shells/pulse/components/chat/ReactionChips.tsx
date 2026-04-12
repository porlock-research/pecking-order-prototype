import { motion } from 'framer-motion';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING } from '../../springs';
import type { ChatMessage } from '@pecking-order/shared-types';

interface ReactionChipsProps {
  message: ChatMessage;
}

/**
 * Render existing reactions as chips below a message.
 * Tap a chip to toggle your own reaction.
 * No "+" button — the smile icon in the inline action bar is the canonical
 * way to add new reactions (avoids a duplicate trigger).
 */
export function ReactionChips({ message }: ReactionChipsProps) {
  const { engine, playerId } = usePulse();
  const reactions = message.reactions;
  if (!reactions || Object.keys(reactions).length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
      {Object.entries(reactions).map(([emoji, reactors]) => {
        const isMine = (reactors as string[]).includes(playerId);
        return (
          <motion.button
            key={emoji}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={PULSE_SPRING.pop}
            onClick={() => engine.sendReaction(message.id, emoji)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 12,
              background: isMine ? 'var(--pulse-accent-glow)' : 'var(--pulse-surface-2)',
              border: isMine
                ? '1px solid var(--pulse-accent)'
                : '1px solid var(--pulse-border)',
              cursor: 'pointer',
              color: 'var(--pulse-text-1)',
              fontFamily: 'var(--po-font-body)',
            }}
          >
            <span>{emoji}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{(reactors as string[]).length}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
