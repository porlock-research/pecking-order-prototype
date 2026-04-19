import { motion, useReducedMotion } from 'framer-motion';
import { HandWaving } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';
import { PersonaImage } from '../common/PersonaImage';

interface Props {
  text: string;
  timestamp: number;
}

/**
 * Inline chat card for SOCIAL_NUDGE ticker broadcasts.
 * Treatment mirrors the NarratorLine / WhisperCard public-intrigue row:
 * dividers each side, muted italic body, inline persona avatars + player-
 * colored bold names. HandWaving icon wiggles in the middle — the "nudge
 * as poke" beat, now sitting inline with the sentence rather than trailing.
 */
export function NudgeTransferCard({ text }: Props) {
  const roster = useGameStore(s => s.roster);
  const reduce = useReducedMotion();

  // Strip markdown bold and parse: "SENDER nudged RECIPIENT"
  const plain = text.replace(/\*\*/g, '');
  const match = plain.match(/^(.+?)\s+nudged\s+(.+?)$/i);
  if (!match) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={PULSE_SPRING.gentle}
        style={{
          padding: '8px 16px',
          fontSize: 11,
          fontStyle: 'italic',
          color: 'var(--pulse-text-3)',
          textAlign: 'center',
        }}
      >
        {plain}
      </motion.div>
    );
  }

  const [, senderName, recipientName] = match;
  const senderEntry = Object.entries(roster).find(([, p]) => p.personaName === senderName);
  const recipientEntry = Object.entries(roster).find(([, p]) => p.personaName === recipientName);
  const sender = senderEntry?.[1];
  const recipient = recipientEntry?.[1];
  const senderColor = senderEntry
    ? getPlayerColor(Object.keys(roster).indexOf(senderEntry[0]))
    : 'var(--pulse-text-2)';
  const recipientColor = recipientEntry
    ? getPlayerColor(Object.keys(roster).indexOf(recipientEntry[0]))
    : 'var(--pulse-text-2)';

  const dividerMotion = reduce
    ? {}
    : {
        initial: { scaleX: 0 },
        animate: { scaleX: 1 },
        transition: { duration: 0.55, ease: [0.25, 1, 0.5, 1] as const },
      };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={PULSE_SPRING.gentle}
      style={{
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
            'linear-gradient(to right, transparent, color-mix(in oklch, var(--pulse-nudge) 28%, transparent))',
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
          maxWidth: '80%',
          fontSize: 11,
          fontStyle: 'italic',
          lineHeight: 1.45,
          letterSpacing: 0.2,
          color: 'var(--pulse-text-3)',
          textAlign: 'center',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {senderEntry && (
            <PersonaImage
              avatarUrl={sender?.avatarUrl}
              cacheKey={senderEntry[0]}
              preferredVariant="headshot"
              initials={(senderName ?? '?').slice(0, 1).toUpperCase()}
              playerColor={senderColor}
              alt=""
              style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <strong style={{ color: senderColor, fontStyle: 'normal', fontWeight: 700 }}>
            {senderName}
          </strong>
        </span>
        {/* Hand-wave rotation is driven by the .pulse-nudge-wave CSS class
            (one-shot on mount) rather than a framer keyframe array — the
            array restarts on every parent re-render and can get stuck at
            the first value. See finite-framer-keyframe-restart guardrail. */}
        <span
          className={reduce ? undefined : 'pulse-nudge-wave'}
          style={{
            display: 'inline-flex',
            color: 'var(--pulse-nudge)',
            filter: 'drop-shadow(0 0 6px color-mix(in oklch, var(--pulse-nudge) 45%, transparent))',
          }}
        >
          <HandWaving size={12} weight="fill" />
        </span>
        <span>nudged</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {recipientEntry && (
            <PersonaImage
              avatarUrl={recipient?.avatarUrl}
              cacheKey={recipientEntry[0]}
              preferredVariant="headshot"
              initials={(recipientName ?? '?').slice(0, 1).toUpperCase()}
              playerColor={recipientColor}
              alt=""
              style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <strong style={{ color: recipientColor, fontStyle: 'normal', fontWeight: 700 }}>
            {recipientName}
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
            'linear-gradient(to left, transparent, color-mix(in oklch, var(--pulse-nudge) 28%, transparent))',
        }}
      />
    </motion.div>
  );
}
