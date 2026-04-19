import { motion, useReducedMotion } from 'framer-motion';
import { Coins } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';

interface SilverTransferCardProps {
  text: string;
  timestamp: number;
}

/**
 * Inline chat card for silver transfer broadcasts.
 * Parses "{Sender} sent {amount} silver to {Recipient}" text and renders with
 * overlapping persona portraits + gold chip — matches mockup 03-conversations.
 */
export function SilverTransferCard({ text }: SilverTransferCardProps) {
  const roster = useGameStore(s => s.roster);
  const reduce = useReducedMotion();

  // Parse: "NAME sent AMOUNT silver to NAME"
  const match = text.match(/^(.+?)\s+sent\s+(\d+)\s+silver\s+to\s+(.+?)$/i);
  if (!match) {
    // Fallback to plain text if regex fails
    return (
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={PULSE_SPRING.bouncy}
        style={{
          padding: '8px 14px',
          margin: '4px 0',
          borderRadius: 12,
          fontSize: 12,
          color: 'var(--pulse-text-2)',
          background: 'var(--pulse-surface-2)',
        }}
      >
        {text}
      </motion.div>
    );
  }

  const [, senderName, amountStr, recipientName] = match;
  const amount = parseInt(amountStr, 10);

  const senderEntry = Object.entries(roster).find(([_, p]) => p.personaName === senderName);
  const recipientEntry = Object.entries(roster).find(([_, p]) => p.personaName === recipientName);
  const sender = senderEntry?.[1];
  const recipient = recipientEntry?.[1];
  const senderColor = senderEntry ? getPlayerColor(Object.keys(roster).indexOf(senderEntry[0])) : 'var(--pulse-text-2)';
  const recipientColor = recipientEntry ? getPlayerColor(Object.keys(roster).indexOf(recipientEntry[0])) : 'var(--pulse-text-2)';

  // Pop/glow arrival uses opacity + translate only. The previous scale
  // keyframe animation (0.88 → 1.04 → 1) was stuck at the initial 0.88
  // whenever the parent re-rendered before the 700ms transition completed
  // — every live-game store tick was enough. The visible result: the whole
  // card rendered at 88% with portraits pinched to 24.6px. Keep arrival
  // feel via opacity + x; the CSS pulse-silver-arrive sheen + glow layer
  // carries the dramatic beat.
  return (
    <motion.div
      className={reduce ? undefined : 'pulse-silver-arrive'}
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 'var(--pulse-space-sm)',
        padding: 'var(--pulse-space-xs) var(--pulse-space-sm) var(--pulse-space-xs) var(--pulse-space-xs)',
        margin: 'var(--pulse-space-2xs) 0',
        borderRadius: 999,
        background: 'color-mix(in oklch, var(--pulse-gold) 5%, transparent)',
        border: '1px solid color-mix(in oklch, var(--pulse-gold) 15%, transparent)',
        fontFamily: 'var(--po-font-body)',
      }}
    >
      {/* Overlapping portraits — face-legible. 28px each, overlap 8px so
          the first portrait still shows 20px (~70%) of the sender's face.
          The old 14px overlap (50%) hid half a face and read as cramped. */}
      <div style={{ position: 'relative', width: 48, height: 28, flexShrink: 0 }}>
        {sender && (
          <img
            src={sender.avatarUrl}
            alt=""
            loading="lazy"
            width={28}
            height={28}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 28,
              height: 28,
              borderRadius: 7,
              objectFit: 'cover',
              objectPosition: 'center top',
              border: '1.5px solid var(--pulse-bg)',
              zIndex: 2,
            }}
          />
        )}
        {recipient && (
          <img
            src={recipient.avatarUrl}
            alt=""
            loading="lazy"
            width={28}
            height={28}
            style={{
              position: 'absolute',
              left: 20,
              top: 0,
              width: 28,
              height: 28,
              borderRadius: 7,
              objectFit: 'cover',
              objectPosition: 'center top',
              border: '1.5px solid var(--pulse-bg)',
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* Text — small, single line */}
      <div style={{ fontSize: 11, color: 'var(--pulse-text-2)', lineHeight: 1.2, fontWeight: 500 }}>
        <span style={{ fontWeight: 700, color: senderColor }}>{senderName}</span>
        <span> → </span>
        <span style={{ fontWeight: 700, color: recipientColor }}>{recipientName}</span>
      </div>

      {/* Gold amount chip — compact */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          color: 'var(--pulse-gold)',
          fontWeight: 800,
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        <Coins size={11} weight="fill" />
        <span>{amount}</span>
      </div>
    </motion.div>
  );
}
