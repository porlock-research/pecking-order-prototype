import { useCallback, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import { useInFlight } from '../../hooks/useInFlight';
import { useLockInCountdown, LOCK_IN_MS } from '../../hooks/useLockInCountdown';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { PersonaImage, initialsOf } from '../common/PersonaImage';
import { SendButton } from '../input/SendButton';

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
  const reduce = useReducedMotion();

  // Read these unconditionally so hook order stays stable across the
  // null-targetId early return below.
  const target = targetId ? roster[targetId] : null;
  const balance = roster[playerId]?.silver ?? 0;

  // Lock-in countdown — per impeccable.md principle 7, irreversible commit
  // actions get a 3-second tap-to-undo window. AvatarPicker is the template;
  // here we drive the timer ourselves and render an inline progress bar where
  // the SendButton normally lives.
  const completeSend = useCallback(() => {
    if (!amount || !targetId) return;
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
  }, [amount, targetId, target?.personaName, engine, guard, onClose]);

  const { state: lockState, start: startLock, cancel: cancelLock } = useLockInCountdown({
    onComplete: completeSend,
  });

  if (!targetId) return null;
  const isLocking = lockState === 'locking';
  const playerIndex = Object.keys(roster).indexOf(targetId);

  const handleSend = () => {
    if (!amount || amount > balance) return;
    startLock();
  };

  const handleClose = () => {
    if (isLocking) cancelLock();
    onClose();
  };

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: backdropFor(PULSE_Z.modal), background: 'rgba(0,0,0,0.5)' }} />
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
          borderRadius: 'var(--pulse-radius-xl) var(--pulse-radius-xl) 0 0',
          background: 'var(--pulse-surface)',
          padding: '20px 20px 32px',
        }}
      >
        {/* Close — also cancels an in-flight lock-in so closing the sheet
            never silently completes the send mid-countdown. */}
        <button
          onClick={handleClose}
          aria-label={isLocking ? 'Cancel and close' : 'Close send silver'}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 44, height: 44,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--pulse-text-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--pulse-radius-sm)',
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
            style={{ width: 64, height: 64, borderRadius: 'var(--pulse-radius-lg)', objectFit: 'cover' }}
          />
          <div style={{ fontWeight: 700, fontSize: 16, color: getPlayerColor(playerIndex), fontFamily: 'var(--po-font-body)' }}>
            {target?.personaName}
          </div>
        </div>

        {/* Amount chips — disabled during lock-in so the amount can't drift
            mid-countdown. Tap-to-undo lives on the bar below. */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          {AMOUNTS.map(a => (
            <motion.button
              key={a}
              whileTap={isLocking ? undefined : PULSE_TAP.button}
              onClick={() => { if (!isLocking) setAmount(a); }}
              disabled={isLocking || a > balance}
              style={{
                padding: '10px 18px',
                borderRadius: 'var(--pulse-radius-md)',
                fontSize: 16,
                fontWeight: 700,
                fontFamily: 'var(--po-font-body)',
                cursor: isLocking || a > balance ? 'not-allowed' : 'pointer',
                opacity: a > balance ? 0.3 : (isLocking && amount !== a ? 0.4 : 1),
                background: amount === a ? 'var(--pulse-gold-glow)' : 'var(--pulse-surface-2)',
                border: amount === a ? '2px solid var(--pulse-gold)' : '2px solid var(--pulse-border)',
                color: 'var(--pulse-gold)',
                transition: 'opacity 0.2s ease',
              }}
            >
              {a}
            </motion.button>
          ))}
        </div>

        {/* Send button OR lock-in bar — swaps via AnimatePresence. The bar
            becomes a tap target itself ("tap to undo"); the button starts
            the countdown on press. */}
        <AnimatePresence mode="wait" initial={false}>
          {isLocking ? (
            <SilverLockInBar
              key="locking"
              amount={amount}
              recipientName={target?.personaName ?? 'player'}
              onCancel={cancelLock}
              reduce={!!reduce}
            />
          ) : (
            <motion.div
              key="send"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <SendButton
                variant="silver"
                shape="fullWidth"
                onClick={handleSend}
                disabled={!amount || amount > balance}
                pending={sending}
                ariaLabel={amount ? `Send ${amount} Silver — starts a 3-second lock-in` : 'Pick an amount to send'}
                className={amount ? 'pulse-silver-arrive' : undefined}
                style={!amount ? { background: 'var(--pulse-surface-2)', color: 'var(--pulse-text-4)' } : undefined}
              >
                {amount ? `Send ${amount} Silver` : 'Pick an amount'}
              </SendButton>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Balance */}
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: 'var(--pulse-text-3)' }}>
          Your balance: {balance} silver
        </div>
      </motion.div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Lock-in bar — visual countdown for the send-silver commit          */
/* ------------------------------------------------------------------ */

interface SilverLockInBarProps {
  amount: number | null;
  recipientName: string;
  onCancel: () => void;
  reduce: boolean;
}

/**
 * Visual-only progress bar for the silver send lock-in. The HOOK
 * (`useLockInCountdown`) owns the timer; this component just animates a
 * gold fill across `LOCK_IN_MS` and renders the tap-to-undo affordance.
 *
 * Note on z-stacking — children with `zIndex` need `position` set or the
 * value silently does nothing (see finite-zindex-needs-position guardrail).
 * The progress fill uses `position: absolute`; the span uses
 * `position: relative` so its zIndex above the fill actually applies.
 */
function SilverLockInBar({ amount, recipientName, onCancel, reduce }: SilverLockInBarProps) {
  return (
    <motion.button
      onClick={onCancel}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={LOCK_IN_MS}
      aria-valuenow={0}
      aria-label={
        amount
          ? `Sending ${amount} silver to ${recipientName} — tap to undo.`
          : `Sending — tap to undo.`
      }
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        minHeight: 52,
        borderRadius: 'var(--pulse-radius-md)',
        border: '2px solid var(--pulse-gold)',
        background: 'var(--pulse-surface-2)',
        color: 'var(--pulse-gold)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '8px 16px',
        cursor: 'pointer',
        fontFamily: 'var(--po-font-display, var(--po-font-body))',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
      }}
    >
      {/* Animated gold fill — 0→100% over LOCK_IN_MS. Visual only; the
          hook's timer is the source of truth for completion. */}
      {!reduce && (
        <motion.div
          aria-hidden="true"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: LOCK_IN_MS / 1000, ease: 'linear' }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            background:
              'linear-gradient(90deg, var(--pulse-gold), color-mix(in oklch, var(--pulse-gold) 65%, transparent))',
            opacity: 0.32,
            zIndex: 0,
          }}
        />
      )}
      {reduce && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'color-mix(in oklch, var(--pulse-gold) 22%, transparent)',
            zIndex: 0,
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>
        {amount ? `Sending ${amount} silver · tap to undo` : 'Sending · tap to undo'}
      </span>
    </motion.button>
  );
}
