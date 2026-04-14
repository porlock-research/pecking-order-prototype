import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { HandWaving, ChatCircle } from '../../icons';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';

interface NudgeConfirmationProps {
  targetId: string | null;
  onClose: () => void;
  onDM: (targetId: string) => void;
}

export function NudgeConfirmation({ targetId, onClose, onDM }: NudgeConfirmationProps) {
  const roster = useGameStore(s => s.roster);

  if (!targetId) return null;

  const target = roster[targetId];
  const playerIndex = Object.keys(roster).indexOf(targetId);

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: backdropFor(PULSE_Z.modal), background: 'rgba(0,0,0,0.6)' }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={PULSE_SPRING.bouncy}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: PULSE_Z.modal,
          padding: 32,
          borderRadius: 24,
          background: 'var(--pulse-surface)',
          textAlign: 'center',
          minWidth: 260,
        }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: 18,
          background: 'linear-gradient(135deg, var(--pulse-nudge) 0%, #e67e22 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 4px 16px rgba(255,160,77,0.35)',
        }}>
          <HandWaving size={40} weight="fill" color="#1a1422" />
        </div>
        <img
          src={target?.avatarUrl}
          alt={target?.personaName}
          style={{ width: 72, height: 72, borderRadius: 18, objectFit: 'cover', marginBottom: 12 }}
        />
        <div style={{ fontWeight: 700, fontSize: 15, color: getPlayerColor(playerIndex), marginBottom: 4, fontFamily: 'var(--po-font-body)' }}>
          {target?.personaName}
        </div>
        <div style={{ fontSize: 14, color: 'var(--pulse-text-2)', marginBottom: 20, fontFamily: 'var(--po-font-body)' }}>
          You nudged {target?.personaName}!
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <motion.button
            whileTap={PULSE_TAP.button}
            onClick={onClose}
            style={{
              padding: '10px 20px', borderRadius: 12,
              background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
              color: 'var(--pulse-text-1)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--po-font-body)',
            }}
          >
            Done
          </motion.button>
          <motion.button
            whileTap={PULSE_TAP.button}
            onClick={() => { onDM(targetId); onClose(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 12,
              background: 'var(--pulse-accent)', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--po-font-body)',
            }}
          >
            <ChatCircle size={14} weight="fill" />
            Send DM
          </motion.button>
        </div>
      </motion.div>
    </>
  );
}
