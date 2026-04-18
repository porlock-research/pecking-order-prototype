import { motion, useReducedMotion } from 'framer-motion';
import { HandWaving } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';

interface Props {
  text: string;
  timestamp: number;
}

/**
 * Inline chat card for SOCIAL_NUDGE ticker broadcasts.
 * Parses "**Sender** nudged **Recipient**" (markdown from ticker.ts) and
 * renders with overlapping persona portraits + HandWaving icon — mirrors
 * SilverTransferCard's UI grammar so every fact-driven event on the feed
 * shares the same pill treatment.
 */
export function NudgeTransferCard({ text }: Props) {
  const roster = useGameStore(s => s.roster);
  const reduce = useReducedMotion();

  // Strip markdown bold markers and parse: "SENDER nudged RECIPIENT"
  const plain = text.replace(/\*\*/g, '');
  const match = plain.match(/^(.+?)\s+nudged\s+(.+?)$/i);
  if (!match) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={PULSE_SPRING.gentle}
        style={{
          padding: '8px 14px',
          margin: '4px 0',
          borderRadius: 12,
          fontSize: 12,
          color: 'var(--pulse-text-2)',
          background: 'var(--pulse-surface-2)',
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
  const senderColor = senderEntry ? getPlayerColor(Object.keys(roster).indexOf(senderEntry[0])) : 'var(--pulse-text-2)';
  const recipientColor = recipientEntry ? getPlayerColor(Object.keys(roster).indexOf(recipientEntry[0])) : 'var(--pulse-text-2)';

  // Same fix as SilverTransferCard: scale keyframes were stuck at the 0.88
  // initial on every parent re-render, rendering the whole card at 88%
  // with cramped portraits. The hand-wave rotation below still carries the
  // "nudge = poke" beat without affecting card dimensions.
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1 }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.35, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 'var(--pulse-space-sm)',
        padding: 'var(--pulse-space-xs) var(--pulse-space-md) var(--pulse-space-xs) var(--pulse-space-xs)',
        margin: 'var(--pulse-space-2xs) 0',
        borderRadius: 999,
        background: 'rgba(255,160,77,0.06)',
        border: '1px solid rgba(255,160,77,0.18)',
        fontFamily: 'var(--po-font-body)',
      }}
    >
      {/* Face-legible portraits — matches SilverTransferCard sizing.
          28px each, overlap 8px so the first portrait shows ~70% of face. */}
      <div style={{ position: 'relative', width: 48, height: 28, flexShrink: 0 }}>
        {sender && (
          <img
            src={sender.avatarUrl}
            alt=""
            loading="lazy"
            width={28}
            height={28}
            style={{
              position: 'absolute', left: 0, top: 0,
              width: 28, height: 28, borderRadius: 7,
              objectFit: 'cover', objectPosition: 'center top',
              border: '1.5px solid var(--pulse-bg)', zIndex: 2,
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
              position: 'absolute', left: 20, top: 0,
              width: 28, height: 28, borderRadius: 7,
              objectFit: 'cover', objectPosition: 'center top',
              border: '1.5px solid var(--pulse-bg)', zIndex: 1,
            }}
          />
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--pulse-text-2)', lineHeight: 1.2, fontWeight: 500 }}>
        <span style={{ fontWeight: 700, color: senderColor }}>{senderName}</span>
        <span> → </span>
        <span style={{ fontWeight: 700, color: recipientColor }}>{recipientName}</span>
      </div>

      <motion.span
        initial={{ rotate: 0 }}
        animate={reduce ? { rotate: 0 } : { rotate: [0, -18, 16, -12, 10, 0] }}
        transition={reduce ? {} : { duration: 0.55, delay: 0.18, ease: 'easeInOut' }}
        style={{ display: 'inline-flex', transformOrigin: '70% 80%', flexShrink: 0 }}
      >
        <HandWaving size={12} weight="fill" color="var(--pulse-nudge)" />
      </motion.span>
    </motion.div>
  );
}
