import { motion } from 'framer-motion';
import type { Channel, SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface InviteOverlayProps {
  channel: Channel;
  firstMessage?: string;
  roster: Record<string, SocialPlayer>;
  slotsRemaining: number;
  slotsTotal: number;
  onAccept: () => void;
  onDecline: () => void;
}

export function InviteOverlay({
  channel,
  firstMessage,
  roster,
  slotsRemaining,
  slotsTotal,
  onAccept,
  onDecline,
}: InviteOverlayProps) {
  const sender = roster[channel.createdBy];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={VIVID_SPRING.gentle}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'rgba(250, 247, 241, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: 32,
      }}
    >
      {/* Sender avatar */}
      <PersonaAvatar
        avatarUrl={sender?.avatarUrl}
        personaName={sender?.personaName}
        size={64}
      />

      {/* Invite text */}
      <div
        style={{
          fontFamily: 'var(--vivid-font-display)',
          fontWeight: 700,
          fontSize: 18,
          color: 'var(--vivid-text)',
          textAlign: 'center',
        }}
      >
        {sender?.personaName ?? 'Someone'} wants to chat
      </div>

      {/* First message preview */}
      {firstMessage && (
        <div
          style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 14,
            color: 'var(--vivid-text)',
            textAlign: 'center',
            maxWidth: 260,
            padding: '8px 16px',
            background: 'var(--vivid-bg-elevated)',
            borderRadius: 12,
            border: '1px solid rgba(139, 115, 85, 0.1)',
            fontStyle: 'italic',
          }}
        >
          &ldquo;{firstMessage}&rdquo;
        </div>
      )}

      {/* Slots remaining */}
      <div
        style={{
          fontFamily: 'var(--vivid-font-mono)',
          fontSize: 12,
          color: 'var(--vivid-text-dim)',
        }}
      >
        {slotsRemaining} of {slotsTotal} conversations remaining today
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <motion.button
          onClick={onDecline}
          style={{
            padding: '10px 24px',
            borderRadius: 9999,
            background: 'var(--vivid-bg-elevated)',
            border: '1px solid rgba(139, 115, 85, 0.15)',
            color: 'var(--vivid-text-dim)',
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
          whileTap={VIVID_TAP.button}
          transition={VIVID_SPRING.bouncy}
        >
          Decline
        </motion.button>
        <motion.button
          onClick={onAccept}
          style={{
            padding: '10px 24px',
            borderRadius: 9999,
            background: '#3BA99C',
            border: 'none',
            color: '#FFFFFF',
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(59, 169, 156, 0.3)',
          }}
          whileTap={VIVID_TAP.fab}
          transition={VIVID_SPRING.bouncy}
        >
          Accept
        </motion.button>
      </div>
    </motion.div>
  );
}
