import { motion, useReducedMotion } from 'framer-motion';
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
  const reduce = useReducedMotion();
  const reactions = message.reactions;
  if (!reactions || Object.keys(reactions).length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--pulse-space-xs)', marginTop: 'var(--pulse-space-xs)' }}>
      {Object.entries(reactions).map(([emoji, reactors]) => {
        const isMine = (reactors as string[]).includes(playerId);
        return (
          <motion.button
            key={emoji}
            initial={reduce ? { scale: 0.95, opacity: 0 } : { scale: 0, boxShadow: '0 0 0 0 rgba(255,59,111,0)' }}
            animate={
              reduce
                ? { scale: 1, opacity: 1 }
                : {
                    scale: 1,
                    // One-shot pink glow on arrival — "this just landed" beat.
                    boxShadow: [
                      '0 0 0 0 rgba(255,59,111,0)',
                      '0 0 14px 2px rgba(255,59,111,0.55)',
                      '0 0 0 0 rgba(255,59,111,0)',
                    ],
                  }
            }
            transition={reduce ? { duration: 0.2 } : { ...PULSE_SPRING.pop, boxShadow: { duration: 0.55, ease: 'easeOut' } }}
            onClick={() => engine.sendReaction(message.id, emoji)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--pulse-space-xs)',
              padding: 'var(--pulse-space-2xs) var(--pulse-space-sm)',
              borderRadius: 'var(--pulse-radius-md)',
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
