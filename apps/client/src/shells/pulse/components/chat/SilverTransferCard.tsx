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
      initial={{ opacity: 0, x: -12, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={PULSE_SPRING.bouncy}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px 8px 8px',
        margin: '6px 0',
        borderRadius: 14,
        background:
          'linear-gradient(90deg, rgba(255,200,61,0.08) 0%, rgba(255,200,61,0.03) 100%), var(--pulse-surface)',
        border: '1px solid rgba(255,200,61,0.25)',
        boxShadow: '0 0 0 1px rgba(255,200,61,0.05), 0 4px 16px rgba(255,200,61,0.06)',
        fontFamily: 'var(--po-font-body)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Shimmer stripe */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,200,61,0.18) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'pulse-shimmer 2.5s ease-out forwards',
          pointerEvents: 'none',
        }}
      />

      {/* Overlapping portraits */}
      <div style={{ position: 'relative', width: 48, height: 32, flexShrink: 0, zIndex: 1 }}>
        {sender && (
          <img
            src={sender.avatarUrl}
            alt={sender.personaName}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              objectFit: 'cover',
              objectPosition: 'center top',
              border: '2px solid var(--pulse-surface)',
              zIndex: 2,
            }}
          />
        )}
        {recipient && (
          <img
            src={recipient.avatarUrl}
            alt={recipient.personaName}
            style={{
              position: 'absolute',
              left: 16,
              top: 0,
              width: 32,
              height: 32,
              borderRadius: 8,
              objectFit: 'cover',
              objectPosition: 'center top',
              border: '2px solid var(--pulse-surface)',
              zIndex: 1,
            }}
          />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--pulse-text-1)', lineHeight: 1.35, zIndex: 1 }}>
        <span style={{ fontWeight: 700, color: senderColor }}>{senderName}</span>
        <span style={{ color: 'var(--pulse-text-2)' }}> sent </span>
        <span style={{ fontWeight: 700, color: recipientColor }}>{recipientName}</span>
      </div>

      {/* Gold amount chip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 10px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, var(--pulse-gold) 0%, #e6a500 100%)',
          color: '#1a1422',
          fontWeight: 800,
          fontSize: 12,
          flexShrink: 0,
          zIndex: 1,
          boxShadow: '0 2px 8px rgba(255,200,61,0.3)',
        }}
      >
        <Coins size={12} weight="fill" />
        <span>{amount}</span>
      </div>
    </motion.div>
  );
}
