import { motion, useReducedMotion } from 'framer-motion';
import { Coins } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';
import { PersonaImage } from '../common/PersonaImage';

interface SilverTransferCardProps {
  text: string;
  timestamp: number;
}

/**
 * Inline chat card for silver transfer broadcasts.
 * Treatment mirrors the NarratorLine / WhisperCard public-intrigue row:
 * dividers each side, muted italic body, inline persona avatars + player-
 * colored bold names. The amount reads gold-bold inline with a Coins icon
 * so the value carries without needing a separate chip.
 */
export function SilverTransferCard({ text }: SilverTransferCardProps) {
  const roster = useGameStore(s => s.roster);
  const reduce = useReducedMotion();

  // Parse: "SENDER sent AMOUNT silver to RECIPIENT"
  const match = text.match(/^(.+?)\s+sent\s+(\d+)\s+silver\s+to\s+(.+?)$/i);
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
        {text}
      </motion.div>
    );
  }

  const [, senderName, amountStr, recipientName] = match;
  const amount = parseInt(amountStr, 10);
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

  // Coins flip-in — the value lands with a beat.
  const coinsMotion = reduce
    ? {}
    : {
        initial: { scale: 0.55, rotate: -30 },
        animate: { scale: 1, rotate: 0 },
        transition: { ...PULSE_SPRING.bouncy, delay: 0.1 },
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
            'linear-gradient(to right, transparent, color-mix(in oklch, var(--pulse-gold) 28%, transparent))',
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
        <span>sent</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <motion.span
            {...coinsMotion}
            style={{
              display: 'inline-flex',
              color: 'var(--pulse-gold)',
              filter: 'drop-shadow(0 0 6px color-mix(in oklch, var(--pulse-gold) 45%, transparent))',
            }}
          >
            <Coins size={12} weight="fill" />
          </motion.span>
          <strong style={{ color: 'var(--pulse-gold)', fontStyle: 'normal', fontWeight: 700 }}>
            {amount}
          </strong>
        </span>
        <span>to</span>
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
            'linear-gradient(to left, transparent, color-mix(in oklch, var(--pulse-gold) 28%, transparent))',
        }}
      />
    </motion.div>
  );
}
