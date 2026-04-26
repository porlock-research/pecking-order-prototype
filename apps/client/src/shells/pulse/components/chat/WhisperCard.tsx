import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { Lock } from '../../icons';
import { PULSE_SPRING } from '../../springs';
import { getPlayerColor } from '../../colors';
import { PersonaImage } from '../common/PersonaImage';
import type { ChatMessage } from '@pecking-order/shared-types';

interface WhisperCardProps {
  message: ChatMessage;
}

/**
 * Observer's view of a whisper — the viewer is neither sender nor target,
 * so the content is redacted. Treatment mirrors the NarratorLine public-
 * intrigue row: dividers on each side, muted italic copy, inline target
 * avatar + accented bold name. Reads as another atmospheric "something
 * just happened between them" beat rather than a chunky pill.
 */
export function WhisperCard({ message }: WhisperCardProps) {
  const roster = useGameStore(s => s.roster);
  const reduce = useReducedMotion();
  const target = message.whisperTarget ? roster[message.whisperTarget] : null;
  const targetIndex = message.whisperTarget
    ? Object.keys(roster).indexOf(message.whisperTarget)
    : 0;
  const targetColor = getPlayerColor(targetIndex);

  // Dividers draw inward from the lock on mount — a whisper's "signal"
  // propagating outward along the row.
  const dividerMotion = reduce
    ? {}
    : {
        initial: { scaleX: 0 },
        animate: { scaleX: 1 },
        transition: { duration: 0.55, ease: [0.25, 1, 0.5, 1] as const },
      };

  // Lock does a quick snap-shut on mount — a small delight that reads
  // as "secret locked." Bouncy spring so it settles with a beat.
  const lockMotion = reduce
    ? {}
    : {
        initial: { scale: 0.55, rotate: -14 },
        animate: { scale: 1, rotate: 0 },
        transition: { ...PULSE_SPRING.bouncy, delay: 0.08 },
      };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={PULSE_SPRING.gentle}
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
      }}
    >
      <motion.span
        aria-hidden
        {...dividerMotion}
        style={{
          flex: 1,
          height: 1,
          minWidth: 12,
          transformOrigin: 'right center',
          background:
            'linear-gradient(to right, transparent, color-mix(in oklch, var(--pulse-whisper) 28%, transparent))',
        }}
      />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: 6,
          rowGap: 2,
          flexShrink: 1,
          maxWidth: '70%',
          fontSize: 11,
          fontStyle: 'italic',
          lineHeight: 1.45,
          letterSpacing: 0.2,
          color: 'var(--pulse-text-3)',
          textAlign: 'center',
        }}
      >
        <motion.span
          {...lockMotion}
          style={{
            display: 'inline-flex',
            color: 'var(--pulse-whisper)',
            // Faint halo — the whisper's warmth, not a drop shadow.
            filter: 'drop-shadow(0 0 6px color-mix(in oklch, var(--pulse-whisper) 40%, transparent))',
          }}
        >
          <Lock size={11} weight="fill" />
        </motion.span>
        <span>Someone whispered to</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {message.whisperTarget && (
            <PersonaImage
              avatarUrl={target?.avatarUrl}
              cacheKey={message.whisperTarget}
              preferredVariant="headshot"
              initials={(target?.personaName ?? '?').slice(0, 1).toUpperCase()}
              playerColor={targetColor}
              alt=""
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
          )}
          <strong style={{ color: targetColor, fontStyle: 'normal', fontWeight: 700 }}>
            {target?.personaName ?? 'someone'}
          </strong>
        </span>
      </span>
      <motion.span
        aria-hidden
        {...dividerMotion}
        style={{
          flex: 1,
          height: 1,
          minWidth: 12,
          transformOrigin: 'left center',
          background:
            'linear-gradient(to left, transparent, color-mix(in oklch, var(--pulse-whisper) 28%, transparent))',
        }}
      />
    </motion.div>
  );
}
