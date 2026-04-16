import { motion } from 'framer-motion';
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
        padding: '4px 10px 4px 4px',
        margin: '3px 0',
        borderRadius: 999,
        background: 'rgba(255,200,61,0.05)',
        border: '1px solid rgba(255,200,61,0.15)',
        fontFamily: 'var(--po-font-body)',
      }}
    >
      {/* Overlapping portraits — smaller */}
      <div style={{ position: 'relative', width: 32, height: 22, flexShrink: 0 }}>
        {sender && (
          <img
            src={sender.avatarUrl}
            alt=""
            loading="lazy"
            width={22}
            height={22}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 22,
              height: 22,
              borderRadius: 6,
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
            width={22}
            height={22}
            style={{
              position: 'absolute',
              left: 10,
              top: 0,
              width: 22,
              height: 22,
              borderRadius: 6,
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
