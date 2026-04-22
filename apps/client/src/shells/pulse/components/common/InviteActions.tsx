import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useInFlight } from '../../hooks/useInFlight';
import { usePulse } from '../../PulseShell';
import { useGameStore } from '../../../../store/useGameStore';

// 3-second reconsider window, matching AvatarPicker's LOCK_IN_MS so all
// "commit with an escape hatch" moments in Pulse share the same teen-tested
// timing. A shorter 2s felt too close to a tap-through on the pending-DM
// sheet; the reconsider window is the whole point.
const UNDO_MS = 3000;

interface InviteActionsProps {
  onAccept: () => void;
  onDecline: () => void;
  layout?: 'horizontal' | 'vertical';
  acceptLabel?: string;
  declineLabel?: string;
}

/**
 * Shared Accept/Decline affordance for DM invites across the pending-DM
 * sheet and the social-panel invite row.
 *
 * Design decisions (slice C, harden):
 *   - Both buttons are ≥ 44×44 tap targets with equal visual weight.
 *     Previously DmPendingState rendered a full-width Accept against a 13px
 *     text-only Decline, so a stray tap landed on the irreversible Accept.
 *   - Accept is `--pulse-accent`. InviteRow previously used `--pulse-online`
 *     (green) which read like a generic "go" CTA; accent is Pulse's
 *     type-identity color for DM actions (matches DmHero, /dm hint chip).
 *   - Decline enters a 3s undo window with a progress bar instead of firing
 *     immediately — both decisions are irreversible server-side, so the
 *     reconsider window lives on the client.
 *   - Accept is wrapped in `useInFlight` so a double-tap doesn't fire twice.
 */
export function InviteActions({
  onAccept,
  onDecline,
  layout = 'horizontal',
  acceptLabel = 'Accept',
  declineLabel = 'Decline',
}: InviteActionsProps) {
  const { playerId } = usePulse();
  const dmsOpen = useGameStore(s => s.dmsOpen);
  const ownSilver = useGameStore(s => s.roster[playerId]?.silver ?? 0);
  const noSilver = ownSilver === 0;

  // Phase-level gate: if DMs are closed, neither accept nor decline can
  // land server-side this phase. Silver-level gate is accept-only — the
  // player can still clear the invite (decline) to tidy up, then re-engage
  // once they've earned more. Matches DmInput's sendDisabled policy.
  const acceptLocked = !dmsOpen || noSilver;
  const declineLocked = !dmsOpen;
  const lockReason = !dmsOpen && noSilver
    ? "DMs are closed — and you're out of silver"
    : !dmsOpen
      ? 'DMs are closed for this phase'
      : noSilver
        ? "Out of silver — play today's game to earn more"
        : null;

  const { pending: accepting, run: guardAccept } = useInFlight();
  const [declining, setDeclining] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const startDecline = () => {
    if (declining || accepting || declineLocked) return;
    setDeclining(true);
    timerRef.current = setTimeout(() => {
      onDecline();
    }, UNDO_MS);
  };

  const cancelDecline = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setDeclining(false);
  };

  if (declining) {
    return <UndoBar onCancel={cancelDecline} />;
  }

  const wrapper: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
  const row: React.CSSProperties = layout === 'vertical'
    ? { display: 'flex', flexDirection: 'column', gap: 10 }
    : { display: 'flex', gap: 8 };

  return (
    <div style={wrapper}>
      <div style={row}>
        <button
          onClick={() => guardAccept(onAccept)}
          disabled={acceptLocked || accepting}
          aria-busy={accepting}
          aria-disabled={acceptLocked || accepting}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'var(--pulse-accent)',
            color: 'var(--pulse-on-accent)',
            border: 'none',
            padding: '12px 16px',
            borderRadius: 'var(--pulse-radius-md)',
            fontSize: 14,
            fontWeight: 800,
            cursor: acceptLocked ? 'not-allowed' : accepting ? 'wait' : 'pointer',
            opacity: acceptLocked ? 0.45 : accepting ? 0.55 : 1,
            pointerEvents: accepting ? 'none' : 'auto',
            fontFamily: 'var(--po-font-body)',
          }}
        >
          {acceptLabel}
        </button>
        <button
          onClick={startDecline}
          disabled={declineLocked}
          aria-disabled={declineLocked}
          style={{
            flex: 1,
            minHeight: 44,
            background: 'transparent',
            color: 'var(--pulse-text-2)',
            border: '1px solid var(--pulse-border-2)',
            padding: '12px 16px',
            borderRadius: 'var(--pulse-radius-md)',
            fontSize: 14,
            fontWeight: 700,
            cursor: declineLocked ? 'not-allowed' : 'pointer',
            opacity: declineLocked ? 0.45 : 1,
            fontFamily: 'var(--po-font-body)',
          }}
        >
          {declineLabel}
        </button>
      </div>
      {lockReason && (
        <div
          role="status"
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--pulse-pending)',
            textAlign: 'center',
            fontFamily: 'var(--po-font-body)',
          }}
        >
          {lockReason}
        </div>
      )}
    </div>
  );
}

function UndoBar({ onCancel }: { onCancel: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onCancel}
      aria-label="Undo decline — tap to cancel. The invite will be declined automatically if you don't."
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 44,
        padding: '12px 16px',
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-border-2)',
        borderRadius: 'var(--pulse-radius-md)',
        color: 'var(--pulse-text-2)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        overflow: 'hidden',
        fontFamily: 'var(--po-font-body)',
      }}
    >
      <motion.div
        aria-hidden="true"
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ duration: UNDO_MS / 1000, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'color-mix(in oklch, var(--pulse-text-3) 18%, transparent)',
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', zIndex: 1 }}>
        Declining · tap to undo
      </span>
    </motion.button>
  );
}
