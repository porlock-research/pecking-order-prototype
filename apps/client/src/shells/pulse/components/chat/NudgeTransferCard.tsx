import { motion } from 'framer-motion';
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={PULSE_SPRING.gentle}
      style={{
        display: 'inline-flex',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 8,
        padding: '4px 12px 4px 4px',
        margin: '3px 0',
        borderRadius: 999,
        background: 'rgba(255,160,77,0.06)',
        border: '1px solid rgba(255,160,77,0.18)',
        fontFamily: 'var(--po-font-body)',
      }}
    >
      <div style={{ position: 'relative', width: 32, height: 22, flexShrink: 0 }}>
        {sender && (
          <img
            src={sender.avatarUrl}
            alt=""
            style={{
              position: 'absolute', left: 0, top: 0,
              width: 22, height: 22, borderRadius: 6,
              objectFit: 'cover', objectPosition: 'center top',
              border: '1.5px solid var(--pulse-bg)', zIndex: 2,
            }}
          />
        )}
        {recipient && (
          <img
            src={recipient.avatarUrl}
            alt=""
            style={{
              position: 'absolute', left: 10, top: 0,
              width: 22, height: 22, borderRadius: 6,
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

      <HandWaving size={12} weight="fill" color="var(--pulse-nudge)" style={{ flexShrink: 0 }} />
    </motion.div>
  );
}
