import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCartridgeStage } from '../../CartridgeStageContext';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import type { SocialPlayer } from '@pecking-order/shared-types';

interface VoterStripProps {
  eligibleVoters: string[];
  votes: Record<string, string>;
  roster: Record<string, SocialPlayer>;
  /** Mechanism accent — used for the engaged-state ring + glow. */
  accentColor: string;
  /** Current player id, so we can mark "you" in the row. */
  selfId?: string;
}

/**
 * Shell-agnostic voter-progress strip.
 *
 * Engagement grammar (canonical, matches DilemmaCard / PromptShell):
 *   - Voted    → conic-gradient ring in mechanism accent + soft glow, full opacity
 *   - Waiting  → 1.5px dashed neutral ring + 0.55 opacity + breathing pulse
 *                (opacity oscillates 0.55 → 0.85 → 0.55 over 2.4s) + saturate(0.8)
 *
 * Self-marker: the current player gets a tiny accent dot under their avatar.
 *
 * Status text uses tabular-nums + named callouts when ≤2 holdouts remain.
 * Wrapped with role="status" + aria-live="polite" for SR users.
 *
 * Hidden when staged: the Pulse stage renders a bigger cast strip below
 * the cartridge already (mirrors PromptShell behavior).
 */
export function VoterStrip({
  eligibleVoters,
  votes,
  roster,
  accentColor,
  selfId,
}: VoterStripProps) {
  const { staged } = useCartridgeStage();
  const reduce = useReducedMotion();

  const votedSet = new Set(Object.keys(votes));
  const total = eligibleVoters.length;
  const votedCount = eligibleVoters.filter((id) => votedSet.has(id)).length;
  const remaining = total - votedCount;

  // Ignition beat: when remaining transitions 1 → 0, flash the status line once.
  const prevRemainingRef = useRef(remaining);
  const [ignite, setIgnite] = useState(false);
  useEffect(() => {
    const prev = prevRemainingRef.current;
    if (prev === 1 && remaining === 0) {
      setIgnite(true);
      const t = setTimeout(() => setIgnite(false), 900);
      return () => clearTimeout(t);
    }
    prevRemainingRef.current = remaining;
    return undefined;
  }, [remaining]);

  if (staged) return null;

  const holdoutNames = eligibleVoters
    .filter((id) => !votedSet.has(id))
    .map((id) => roster[id]?.personaName?.split(' ')[0] ?? null)
    .filter((n): n is string => !!n);

  const statusText = formatStatus(votedCount, total, remaining, holdoutNames);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        {eligibleVoters.map((voterId) => {
          const player = roster[voterId];
          if (!player) return null;
          const did = votedSet.has(voterId);
          const isSelf = voterId === selfId;
          return (
            <div
              key={voterId}
              title={player.personaName}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <motion.div
                animate={did || reduce ? { opacity: did ? 1 : 0.55 } : { opacity: [0.55, 0.85, 0.55] }}
                transition={did || reduce ? { duration: 0.25 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  borderRadius: '50%',
                  padding: 1.5,
                  background: did
                    ? `conic-gradient(from 180deg, ${accentColor}, color-mix(in oklch, ${accentColor} 40%, transparent), ${accentColor})`
                    : 'transparent',
                  border: did
                    ? 'none'
                    : '1.5px dashed color-mix(in oklch, var(--po-text) 25%, transparent)',
                  filter: did ? 'none' : 'grayscale(35%) saturate(0.8)',
                  boxShadow: did
                    ? `0 0 14px color-mix(in oklch, ${accentColor} 30%, transparent)`
                    : undefined,
                }}
              >
                <PersonaAvatar
                  avatarUrl={player.avatarUrl}
                  personaName={player.personaName}
                  size={36}
                />
              </motion.div>
              {isSelf && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: accentColor,
                    marginTop: 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <motion.span
        role="status"
        aria-live="polite"
        animate={
          ignite && !reduce
            ? { scale: [1, 1.08, 1], color: [accentColor, accentColor, 'var(--po-text-dim)'] }
            : undefined
        }
        transition={{ duration: 0.8, times: [0, 0.3, 1], ease: 'easeOut' }}
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          color: 'var(--po-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.16em',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          textAlign: 'center',
          textShadow: ignite && !reduce
            ? `0 0 14px color-mix(in oklch, ${accentColor} 55%, transparent)`
            : undefined,
        }}
      >
        {statusText}
      </motion.span>
    </div>
  );
}

/** Truncate a first-name to 10 chars with ellipsis — keeps the status line on one row. */
function trim(name: string): string {
  return name.length > 10 ? `${name.slice(0, 9)}\u2026` : name;
}

/**
 * Status copy for the voter strip.
 *
 * Empty / unanimous / holdouts are named aggressively — named callouts
 * do the social/FOMO work. Numbers are the fallback only when the list
 * is too long to read on one line (6+ holdouts).
 */
function formatStatus(
  votedCount: number,
  total: number,
  remaining: number,
  holdoutNames: string[],
): string {
  if (total === 0) return '';
  if (remaining === 0) return 'All locked in \u2014 revealing\u2026';

  const trimmed = holdoutNames.map(trim);

  if (remaining === 1 && trimmed.length === 1) {
    return `Waiting on ${trimmed[0]}`;
  }
  if (remaining === 2 && trimmed.length === 2) {
    return `Waiting on ${trimmed[0]} and ${trimmed[1]}`;
  }
  // 3–5 holdouts — still name them, with an Oxford-comma list.
  if (remaining >= 3 && remaining <= 5 && trimmed.length === remaining) {
    const head = trimmed.slice(0, trimmed.length - 1).join(', ');
    return `Waiting on ${head}, and ${trimmed[trimmed.length - 1]}`;
  }
  // 6+ holdouts — name the first 3, then "+N more".
  if (remaining >= 6 && trimmed.length >= 3) {
    const head = trimmed.slice(0, 3).join(', ');
    return `Waiting on ${head} +${remaining - 3} more`;
  }
  // Fallback (missing names, etc.).
  return `${votedCount} of ${total} voted`;
}
