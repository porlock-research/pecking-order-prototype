import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import { useInFlight } from '../../hooks/useInFlight';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { PersonaImage, initialsOf } from '../common/PersonaImage';

const AMOUNTS = [5, 10, 25, 50];

interface SendSilverSheetProps {
  targetId: string | null;
  onClose: () => void;
}

export function SendSilverSheet({ targetId, onClose }: SendSilverSheetProps) {
  const roster = useGameStore(s => s.roster);
  const { engine, playerId } = usePulse();
  const [amount, setAmount] = useState<number | null>(null);
  const { pending: sending, run: guard } = useInFlight();

  if (!targetId) return null;

  const target = roster[targetId];
  const self = roster[playerId];
  const balance = self?.silver ?? 0;
  const playerIndex = Object.keys(roster).indexOf(targetId);

  const handleSend = () => {
    if (!amount || amount > balance) return;
    guard(() => {
      engine.sendSilver(amount, targetId);
      // Sender celebration — haptic + SilverBurst overdrive layer (coin shower
      // + "+N silver" float). Toast dropped in favor of the burst; the public
      // SOCIAL_TRANSFER chat card still carries the announcement for a11y.
      try { navigator.vibrate?.(25); } catch { /* no-op */ }
      window.dispatchEvent(new CustomEvent('pulse:silver-burst', {
        detail: { amount, recipient: target?.personaName ?? 'player' },
      }));
      onClose();
    });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: backdropFor(PULSE_Z.modal), background: 'rgba(0,0,0,0.5)' }} />
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
          zIndex: PULSE_Z.modal,
          borderRadius: '20px 20px 0 0',
          background: 'var(--pulse-surface)',
          padding: '20px 20px 32px',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close send silver"
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 36, height: 36,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--pulse-text-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}
        >
          <X size={20} weight="bold" />
        </button>

        {/* Recipient */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <PersonaImage
            avatarUrl={target?.avatarUrl}
            cacheKey={targetId}
            preferredVariant="medium"
            fallbackChain={['headshot', 'full']}
            initials={initialsOf(target?.personaName ?? '')}
            playerColor={getPlayerColor(playerIndex)}
            alt=""
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

        {/* Send button — flat gold. The real celebration is SilverBurst after
            tap; the button itself stays calm so the burst owns the drama.
            One-shot sheen on mount (pulse-silver-arrive) glints the CTA into
            view, then settles. */}
        <motion.button
          whileTap={PULSE_TAP.button}
          onClick={handleSend}
          disabled={!amount || amount > balance || sending}
          aria-busy={sending}
          className={amount ? 'pulse-silver-arrive' : undefined}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 14,
            fontSize: 15,
            fontWeight: 800,
            letterSpacing: 0.1,
            fontFamily: 'var(--po-font-body)',
            background: amount ? 'var(--pulse-gold)' : 'var(--pulse-surface-2)',
            color: amount ? 'var(--pulse-on-gold)' : 'var(--pulse-text-4)',
            border: 'none',
            cursor: sending ? 'wait' : amount ? 'pointer' : 'not-allowed',
            opacity: sending ? 0.55 : 1,
            pointerEvents: sending ? 'none' : 'auto',
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
