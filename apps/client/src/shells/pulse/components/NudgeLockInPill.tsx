import { motion, useReducedMotion } from 'framer-motion';
import { HandWaving } from '../icons';
import { LOCK_IN_MS } from '../hooks/useLockInCountdown';
import { PULSE_Z } from '../zIndex';

interface NudgeLockInPillProps {
  name: string;
  onCancel: () => void;
}

/**
 * Visual countdown pill for the nudge lock-in. The HOOK (useLockInCountdown,
 * lifted into PulseShell) owns the timer; this component animates a pink
 * fill across LOCK_IN_MS and renders the tap-to-undo affordance.
 *
 * Mounted via AnimatePresence in PulseShell when nudgeTarget !== null.
 * Position: fixed near the bottom-center, above PulseInput, below the modal
 * z-tier (so DM sheets etc. cover it cleanly).
 *
 * Per impeccable.md principle 7 — irreversible commit actions get a 3-second
 * tap-to-undo window. Nudge previously fired instantly on tap.
 *
 * z-stacking note (see finite-zindex-needs-position guardrail): every child
 * with a zIndex value also sets `position`. The pill itself is `position:
 * fixed`; the progress fill is `absolute`; the inner content row is
 * `relative` so its zIndex above the fill applies.
 */
export function NudgeLockInPill({ name, onCancel }: NudgeLockInPillProps) {
  const reduce = useReducedMotion();

  return (
    <motion.button
      type="button"
      onClick={onCancel}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={LOCK_IN_MS}
      aria-valuenow={0}
      aria-label={`Nudging ${name} — tap to undo.`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: 0.22 }}
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        transform: 'translateX(-50%)',
        zIndex: PULSE_Z.popup,
        minWidth: 240,
        maxWidth: 'min(420px, calc(100vw - 32px))',
        minHeight: 44,
        borderRadius: 'var(--pulse-radius-pill, 999px)',
        border: '2px solid var(--pulse-accent)',
        background: 'var(--pulse-surface-2)',
        color: 'var(--pulse-text-1)',
        cursor: 'pointer',
        padding: 0,
        overflow: 'hidden',
        boxShadow:
          '0 8px 28px color-mix(in oklch, var(--pulse-accent) 35%, transparent), 0 1px 0 color-mix(in oklch, #fff 8%, transparent) inset',
        fontFamily: 'var(--po-font-display, var(--po-font-body))',
      }}
    >
      {/* Animated pink fill — visual only; PulseShell's hook owns completion. */}
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
              'linear-gradient(90deg, var(--pulse-accent), color-mix(in oklch, var(--pulse-accent) 60%, transparent))',
            opacity: 0.28,
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
            background:
              'color-mix(in oklch, var(--pulse-accent) 18%, transparent)',
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '10px 18px',
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
        }}
      >
        <HandWaving
          size={16}
          weight="fill"
          color="var(--pulse-accent)"
          aria-hidden="true"
        />
        <span>
          Nudging {name} · tap to undo
        </span>
      </div>
    </motion.button>
  );
}
