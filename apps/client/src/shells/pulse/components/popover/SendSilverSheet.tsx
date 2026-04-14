import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';

const AMOUNTS = [5, 10, 25, 50];

interface SendSilverSheetProps {
  targetId: string | null;
  onClose: () => void;
}

export function SendSilverSheet({ targetId, onClose }: SendSilverSheetProps) {
  const roster = useGameStore(s => s.roster);
  const { engine, playerId } = usePulse();
  const [amount, setAmount] = useState<number | null>(null);

  if (!targetId) return null;

  const target = roster[targetId];
  const self = roster[playerId];
  const balance = self?.silver ?? 0;
  const playerIndex = Object.keys(roster).indexOf(targetId);

  const handleSend = () => {
    if (!amount || amount > balance) return;
    engine.sendSilver(amount, targetId);
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 59, background: 'rgba(0,0,0,0.5)' }} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={PULSE_SPRING.page}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          borderRadius: '20px 20px 0 0',
          background: 'var(--pulse-surface)',
          padding: '20px 20px 32px',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--pulse-text-3)',
          }}
        >
          <X size={20} weight="bold" />
        </button>

        {/* Recipient */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <img
            src={target?.avatarUrl}
            alt={target?.personaName}
            style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover' }}
          />
          <div style={{ fontWeight: 700, fontSize: 16, color: getPlayerColor(playerIndex), fontFamily: 'var(--po-font-body)' }}>
            {target?.personaName}
          </div>
        </div>

        {/* Amount chips */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          {AMOUNTS.map(a => (
            <motion.button
              key={a}
              whileTap={PULSE_TAP.button}
              onClick={() => setAmount(a)}
              style={{
                padding: '10px 18px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'var(--po-font-body)',
                cursor: a > balance ? 'not-allowed' : 'pointer',
                opacity: a > balance ? 0.3 : 1,
                background: amount === a ? 'var(--pulse-gold-glow)' : 'var(--pulse-surface-2)',
                border: amount === a ? '2px solid var(--pulse-gold)' : '2px solid var(--pulse-border)',
                color: 'var(--pulse-gold)',
              }}
            >
              {a}
            </motion.button>
          ))}
        </div>

        {/* Send button */}
        <motion.button
          whileTap={PULSE_TAP.button}
          onClick={handleSend}
          disabled={!amount || amount > balance}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 700,
            fontFamily: 'var(--po-font-body)',
            background: amount ? 'linear-gradient(135deg, var(--pulse-gold), #e6c200)' : 'var(--pulse-surface-2)',
            color: amount ? '#000' : 'var(--pulse-text-4)',
            border: 'none',
            cursor: amount ? 'pointer' : 'not-allowed',
          }}
        >
          {amount ? `Send ${amount} Silver` : 'Pick an amount'}
        </motion.button>

        {/* Balance */}
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--pulse-text-3)' }}>
          Your balance: {balance} silver
        </div>
      </motion.div>
    </>
  );
}
