import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { PULSE_SPRING, PULSE_TAP } from '../springs';

/**
 * VoteFloatingChip — pink chip that docks above the chat input while voting
 * is open. Dramatizes a central game mechanic outside the pill row, since
 * voting always lives at the right edge of the row and risks scrolling
 * off-screen on small phones.
 *
 * Two states:
 *   - default: "Tap to vote · MM:SS" (or "Vote cast · MM:SS" once player has
 *     voted), gentle bob, kind-pink fill
 *   - urgent:  faster bob (900ms), bolder shadow swing (700ms), brighter
 *     pink fill, slightly larger padding/font
 *
 * Wiring (TODO when integrating into PulseShell):
 *   <div style={{ position: 'relative' }}>
 *     <VoteFloatingChip />
 *     <ChatInput />
 *   </div>
 *
 * The chip absolutely positions itself above its containing block via
 * bottom: calc(100% + 10px). Place it in a parent that wraps the chat
 * input so the chip sits above it.
 */

const URGENT_THRESHOLD_MS = 5 * 60 * 1000;

interface VoteFloatingChipProps {
  /** Override Date.now() for tests / Storybook. */
  now?: number;
  /** Tap callback — wire to focus the voting cartridge. */
  onTap?: () => void;
}

export function VoteFloatingChip({ now: nowProp, onTap }: VoteFloatingChipProps) {
  const voting = useGameStore((s) => s.activeVotingCartridge);
  const playerId = useGameStore((s) => s.playerId);
  const reduce = useReducedMotion();

  // Live ticking clock so the countdown updates each second. We sample once
  // per second; framer-motion handles the visual breathing.
  const [tick, setTick] = useState(() => nowProp ?? Date.now());
  useEffect(() => {
    if (nowProp !== undefined) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [nowProp]);
  const now = nowProp ?? tick;

  // Debug demo path: ?force-urgent=voting (stashed by App.tsx into
  // sessionStorage). Synthesizes the urgent variant so the visual is
  // testable without timing a real close window.
  const forced = typeof window !== 'undefined' && sessionStorage.getItem('po-force-urgent') === 'voting';

  if (!voting && !forced) return null;
  // Closed: REVEAL/WINNER means voting cartridge has tallied; chip should
  // not be present (unless forced for demo).
  if (voting && (voting.phase === 'REVEAL' || voting.phase === 'WINNER') && !forced) return null;

  const playerActed = voting && playerId ? Boolean(voting.votes?.[playerId]) : false;

  // closeAt may not be exposed on every voting projection. When absent, fall
  // back to a generic "open" message — no countdown, no urgency.
  const closeAt = forced
    ? now + 4 * 60 * 1000
    : ((voting as any)?.closeAt as number | undefined);
  const remainingMs = closeAt !== undefined ? closeAt - now : null;
  const isUrgent =
    forced ||
    (remainingMs !== null && remainingMs > 0 && remainingMs < URGENT_THRESHOLD_MS && !playerActed);

  const text = (() => {
    if (playerActed) {
      return remainingMs !== null && remainingMs > 0
        ? `Vote cast · ${formatCountdown(remainingMs)}`
        : 'Vote cast';
    }
    if (isUrgent && remainingMs !== null) return `Vote closing · ${formatCountdown(remainingMs)}`;
    if (remainingMs !== null && remainingMs > 0) return `Tap to vote · ${formatCountdown(remainingMs)}`;
    return 'Tap to vote';
  })();

  return (
    <motion.button
      data-testid="pulse-vote-chip"
      data-urgent={isUrgent ? 'true' : undefined}
      onClick={onTap}
      whileTap={PULSE_TAP.pill}
      animate={
        reduce
          ? { y: 0 }
          : isUrgent
            ? { y: [-3, 2, -3], scale: [1, 1.04, 1] }
            : { y: [-3, 0, -3], scale: 1 }
      }
      transition={
        reduce
          ? { duration: 0 }
          : isUrgent
            ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
      }
      initial={{ opacity: 0, scale: 0.92 }}
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(100% + 10px)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: isUrgent ? '12px 18px' : '10px 16px',
        background: isUrgent ? 'color-mix(in oklch, var(--pulse-accent) 90%, white)' : 'var(--pulse-accent)',
        color: 'var(--pulse-on-accent, #1a0710)',
        fontFamily: 'var(--po-font-display, var(--po-font-body))',
        fontWeight: 800,
        fontSize: isUrgent ? 14 : 13,
        letterSpacing: 0.3,
        borderRadius: 'var(--pulse-radius-xl, 100px)',
        border: 'none',
        cursor: 'pointer',
        boxShadow: isUrgent
          ? '0 14px 36px color-mix(in oklch, var(--pulse-accent) 85%, transparent), 0 0 0 10px color-mix(in oklch, var(--pulse-accent) 30%, transparent)'
          : '0 8px 24px color-mix(in oklch, var(--pulse-accent) 45%, transparent), 0 0 0 4px color-mix(in oklch, var(--pulse-accent) 16%, transparent)',
        zIndex: 50,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: isUrgent ? 8 : 7,
          height: isUrgent ? 8 : 7,
          borderRadius: '50%',
          background: 'var(--pulse-on-accent, #1a0710)',
          boxShadow: isUrgent ? '0 0 0 2px rgba(26,7,16,0.4)' : undefined,
        }}
      />
      {text}
    </motion.button>
  );
}

function formatCountdown(ms: number): string {
  const m = Math.max(0, ms / 60_000);
  const mInt = Math.floor(m);
  const sInt = Math.max(0, Math.floor((m - mInt) * 60));
  return `${mInt}m ${String(sInt).padStart(2, '0')}s`;
}
