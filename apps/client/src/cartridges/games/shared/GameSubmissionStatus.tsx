import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { useGameStore } from '../../../store/useGameStore';

interface GameSubmissionStatusProps {
  /** All players eligible to submit. */
  eligibleIds: string[];
  /** Subset that has already submitted. */
  submittedIds: string[];
  /** Current player id (gets self marker + "Decision locked in"). */
  selfId: string;
  /** Roster for name lookup. */
  roster: Record<string, SocialPlayer>;
  /** Per-game accent — applied to "locked-in" indicator. */
  accent: string;
  /** Optional copy override for the locked-in headline. */
  selfLockedLine?: string;
  /** Optional copy override for the watching (ineligible) line. */
  watchingLine?: string;
  /** True when current player isn't eligible to submit. */
  ineligible?: boolean;
}

/**
 * COLLECTING/WAITING-state status for SyncDecision games. Replaces
 * the old `font-mono` spinner + pill grid with a named-callout list:
 * "Waiting on Maya and Lior" — see `.impeccable.md` Principle 8
 * (Named callouts over numeric ratios).
 *
 * Self-row gets the per-game accent treatment; others use the standard
 * engaged/waiting grammar from the cartridge stage.
 */
export function GameSubmissionStatus({
  eligibleIds,
  submittedIds,
  selfId,
  roster,
  accent,
  selfLockedLine = 'Decision locked in',
  watchingLine = 'Watching this round',
  ineligible,
}: GameSubmissionStatusProps) {
  const reduce = useReducedMotion();
  const submittedSet = new Set(submittedIds);
  const isMeSubmitted = submittedSet.has(selfId);
  const holdoutIds = eligibleIds.filter(id => !submittedSet.has(id) && id !== selfId);
  const holdoutCount = holdoutIds.length;

  const callout = formatHoldoutCallout(holdoutIds, roster);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '8px 4px 4px',
        alignItems: 'center',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.26em',
            color: ineligible ? 'var(--po-text-dim)' : accent,
            textTransform: 'uppercase',
          }}
        >
          {ineligible ? 'Watching' : (isMeSubmitted ? 'Locked in' : 'Awaiting')}
        </span>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(18px, 5vw, 22px)',
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: -0.2,
            color: 'var(--po-text)',
          }}
        >
          {ineligible
            ? watchingLine
            : isMeSubmitted
              ? selfLockedLine
              : 'Make your call'}
        </p>
      </div>

      {(holdoutCount > 0 || (!isMeSubmitted && !ineligible)) && (
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--po-font-body)',
            fontSize: 13,
            color: 'var(--po-text-dim)',
            lineHeight: 1.4,
            maxWidth: '36ch',
          }}
        >
          {callout}
        </p>
      )}
    </motion.div>
  );
}

function formatHoldoutCallout(
  holdoutIds: string[],
  roster: Record<string, SocialPlayer>,
): string {
  if (holdoutIds.length === 0) return 'Everyone else is in.';
  const names = holdoutIds
    .map(id => (roster[id]?.personaName || id).split(' ')[0])
    .filter(Boolean);
  if (names.length === 1) return `Waiting on ${names[0]}.`;
  if (names.length === 2) return `Waiting on ${names[0]} and ${names[1]}.`;
  if (names.length <= 4) {
    const head = names.slice(0, -1).join(', ');
    return `Waiting on ${head}, and ${names[names.length - 1]}.`;
  }
  // Long list — fall back to numeric, but still call out the first two
  return `Waiting on ${names[0]}, ${names[1]}, and ${names.length - 2} others.`;
}
