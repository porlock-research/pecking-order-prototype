import { motion } from 'framer-motion';
import { UserPlus, Dollar } from '@solar-icons/react';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ChatActionsProps {
  channelId: string;
  onInvitePlayer: () => void;
  onSendSilver: () => void;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  ChatActions                                                        */
/* ------------------------------------------------------------------ */

export function ChatActions({
  onInvitePlayer,
  onSendSilver,
  onClose,
}: ChatActionsProps) {
  return (
    <motion.div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 8,
        padding: '8px 12px',
        borderRadius: 16,
        background: 'var(--vivid-bg-elevated)',
        border: '1px solid rgba(139, 115, 85, 0.1)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 2px 8px rgba(139, 115, 85, 0.08)',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={VIVID_SPRING.snappy}
    >
      {/* Invite Player */}
      <motion.button
        onClick={() => {
          onInvitePlayer();
          onClose();
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 12,
          background: '#FFFFFF',
          border: '1.5px solid rgba(139, 115, 85, 0.12)',
          color: 'var(--vivid-text)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--vivid-font-display)',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(139, 115, 85, 0.06)',
        }}
        whileTap={VIVID_TAP.button}
        transition={VIVID_SPRING.bouncy}
      >
        <UserPlus size={16} weight="Bold" />
        Invite Player
      </motion.button>

      {/* Send Silver */}
      <motion.button
        onClick={() => {
          onSendSilver();
          onClose();
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 12,
          background: '#FFFFFF',
          border: '1.5px solid rgba(139, 115, 85, 0.12)',
          color: 'var(--vivid-text)',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--vivid-font-display)',
          cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(139, 115, 85, 0.06)',
        }}
        whileTap={VIVID_TAP.button}
        transition={VIVID_SPRING.bouncy}
      >
        <Dollar size={16} weight="Bold" />
        Send Silver
      </motion.button>
    </motion.div>
  );
}
