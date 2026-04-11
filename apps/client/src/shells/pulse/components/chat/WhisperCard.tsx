import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { PULSE_SPRING } from '../../springs';
import { getPlayerColor } from '../../colors';
import type { ChatMessage } from '@pecking-order/shared-types';

interface WhisperCardProps {
  message: ChatMessage;
}

export function WhisperCard({ message }: WhisperCardProps) {
  const roster = useGameStore(s => s.roster);
  const target = message.whisperTarget ? roster[message.whisperTarget] : null;
  const targetIndex = message.whisperTarget
    ? Object.keys(roster).indexOf(message.whisperTarget)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={PULSE_SPRING.gentle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        margin: '4px 0',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 500,
        fontFamily: 'var(--po-font-body)',
        color: 'var(--pulse-whisper)',
        background: 'rgba(155, 89, 182, 0.06)',
        border: '1px solid rgba(155, 89, 182, 0.15)',
        fontStyle: 'italic',
      }}
    >
      <span>
        {'🤫 Someone whispered to '}
        <span style={{ color: getPlayerColor(targetIndex), fontWeight: 700, fontStyle: 'normal' }}>
          {target?.personaName || 'someone'}
        </span>
      </span>
    </motion.div>
  );
}
