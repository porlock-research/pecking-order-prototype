import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface VotingTallyGridProps {
  /** Map of playerId → tally count (votes / saves / etc). */
  tallies: Record<string, number>;
  roster: Record<string, SocialPlayer>;
  /** Mechanism accent — used to color the count chip. */
  accent: string;
  /** Optional eliminated player — gets a red dot marker. */
  eliminatedId?: string | null;
  /** Optional winner (FINALS) — gets a gold dot marker. */
  winnerId?: string | null;
  /** Optional immune-player ids — gets a gold halo on the avatar. */
  immuneIds?: string[];
  /** Optional unit label appended after each count — e.g. "saves", "votes". Default: blank. */
  unitLabel?: string;
  /** Current player id — annotates the row they voted on with "your vote". */
  selfVotedFor?: string | null;
  /** FINALS mode — non-winner rows dim + desaturate so the winner row owns attention. */
  dimNonWinner?: boolean;
  /** Per-row stagger entrance (bottom→top), for "runners-up settle to the strip" feel. */
  rowStagger?: boolean;
}

/**
 * Supporting tally below the hero. Small avatars (28px), single-row layout
 * per player, sorted descending by tally. Pure data — no card backgrounds,
 * no borders, no elevation. The hero IS the moment; this is footnote.
 *
 * Markers:
 *   - eliminated → small red dot left of name
 *   - winner     → small gold dot left of name
 *   - immune     → gold halo around avatar
 */
export function VotingTallyGrid({
  tallies,
  roster,
  accent,
  eliminatedId,
  winnerId,
  immuneIds,
  unitLabel,
  selfVotedFor,
  dimNonWinner,
  rowStagger,
}: VotingTallyGridProps) {
  const reduce = useReducedMotion();
  const immune = new Set(immuneIds ?? []);
  const sorted = Object.entries(tallies).sort(([, a], [, b]) => (b as number) - (a as number));

  if (sorted.length === 0) return null;

  // When staggered we animate each row individually — wrapper doesn't animate.
  const wrapperMotion = rowStagger && !reduce
    ? {}
    : {
        initial: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, delay: 0.45 },
      };

  return (
    <motion.div
      {...wrapperMotion}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '0 4px',
      }}
    >
      {sorted.map(([playerId, count], idx) => {
        const player = roster[playerId];
        const isEliminated = playerId === eliminatedId;
        const isWinner = playerId === winnerId;
        const isImmune = immune.has(playerId);
        const isSelfVote = !!selfVotedFor && playerId === selfVotedFor;
        const firstName = player?.personaName?.split(' ')[0] ?? playerId;
        // In FINALS "dim non-winner" mode, runners-up fade back so the crowned row owns attention.
        const dim = !!dimNonWinner && !!winnerId && !isWinner;
        // Row stagger — bottom-up sequence so rows "settle" into place.
        const rowDelay = rowStagger && !reduce ? 0.15 + (sorted.length - 1 - idx) * 0.06 : 0;

        const rowMotion = rowStagger && !reduce
          ? {
              initial: { opacity: 0, y: 8 },
              animate: { opacity: dim ? 0.55 : 1, y: 0 },
              transition: { duration: 0.35, delay: rowDelay, ease: 'easeOut' as const },
            }
          : dim
            ? { animate: { opacity: 0.55 } }
            : {};

        return (
          <motion.div
            key={playerId}
            {...rowMotion}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '4px 6px',
              borderRadius: 8,
              background: isSelfVote
                ? `color-mix(in oklch, ${accent} 8%, transparent)`
                : 'transparent',
              filter: dim ? 'grayscale(30%) saturate(0.85)' : undefined,
            }}
          >
            <div
              style={{
                borderRadius: '50%',
                padding: isImmune ? 1.5 : 0,
                background: isImmune
                  ? `conic-gradient(from 180deg, var(--po-gold), color-mix(in oklch, var(--po-gold) 40%, transparent), var(--po-gold))`
                  : 'transparent',
                boxShadow: isImmune
                  ? '0 0 10px color-mix(in oklch, var(--po-gold) 35%, transparent)'
                  : undefined,
                opacity: isEliminated ? 0.55 : 1,
                filter: isEliminated ? 'grayscale(40%)' : undefined,
              }}
            >
              <PersonaAvatar
                avatarUrl={player?.avatarUrl}
                personaName={player?.personaName}
                size={28}
              />
            </div>
            {(isEliminated || isWinner) && (
              <span
                aria-hidden="true"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: isWinner ? 'var(--po-gold)' : 'var(--po-pink)',
                  boxShadow: `0 0 6px ${isWinner ? 'var(--po-gold)' : 'var(--po-pink)'}`,
                }}
              />
            )}
            <span
              style={{
                fontFamily: 'var(--po-font-body)',
                fontSize: 13,
                fontWeight: isSelfVote ? 700 : 600,
                color: isEliminated ? 'var(--po-text-dim)' : 'var(--po-text)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {firstName}
              {isImmune && (
                <span
                  style={{
                    marginLeft: 6,
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    color: 'var(--po-gold)',
                    textTransform: 'uppercase',
                  }}
                >
                  immune
                </span>
              )}
              {isSelfVote && (
                <span
                  style={{
                    marginLeft: 6,
                    fontFamily: 'var(--po-font-display)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.18em',
                    color: accent,
                    textTransform: 'uppercase',
                  }}
                >
                  your vote
                </span>
              )}
            </span>
            <span
              style={{
                fontFamily: 'var(--po-font-display)',
                fontSize: 15,
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: accent,
                letterSpacing: '0.02em',
              }}
            >
              {count as number}
              {unitLabel && (
                <span
                  style={{
                    marginLeft: 4,
                    fontSize: 9,
                    color: 'var(--po-text-dim)',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {unitLabel}
                </span>
              )}
            </span>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
