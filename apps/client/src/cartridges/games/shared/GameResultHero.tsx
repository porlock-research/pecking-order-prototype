import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedCounter } from './AnimatedCounter';

interface GameResultHeroProps {
  /** Per-game accent. */
  accent: string;
  /** Display name from CARTRIDGE_INFO. */
  gameName: string;
  /** Optional override headline ("Trivia Complete", "King's Reign"). */
  title?: string;
  /** Optional supporting subtitle line — e.g. "Perfect Score!" / shield holder name. */
  subtitle?: string;
  /** Silver this player earned. */
  silverEarned: number;
  /** Optional gold contribution (rendered as secondary chip). */
  goldContribution?: number;
  /** Optional game-specific score breakdown (slot below silver). */
  breakdown?: ReactNode;
  /** Optional bespoke peak-frame composition rendered ABOVE silver
   *  (per-game override; defaults to no extra composition). */
  bespokeHero?: ReactNode;
  onDismiss?: () => void;
}

/**
 * COMPLETED-state hero. Replaces CelebrationSequence.
 *
 * Default composition is a tight "name → big silver → optional breakdown
 * → done" stack. Per-game peak-frame moments inject via the `bespokeHero`
 * slot — that's where Snake's final-length flourish, BeatDrop's score-by-
 * combo card, KingsRansom's reign chronograph live (Action 8 territory).
 */
export function GameResultHero({
  accent,
  gameName,
  title,
  subtitle,
  silverEarned,
  goldContribution,
  breakdown,
  bespokeHero,
  onDismiss,
}: GameResultHeroProps) {
  const reduce = useReducedMotion();
  const stagger = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : {
        hidden: {},
        show: { transition: { staggerChildren: 0.18, delayChildren: 0.05 } },
      };
  const slide = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
      };

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '20px 16px 24px',
      }}
    >
      <motion.div
        variants={slide}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.26em',
            color: accent,
            textTransform: 'uppercase',
          }}
        >
          {title ?? `${gameName} Complete`}
        </span>
        {subtitle && (
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--po-text)',
              letterSpacing: -0.1,
            }}
          >
            {subtitle}
          </span>
        )}
      </motion.div>

      {bespokeHero && <motion.div variants={slide}>{bespokeHero}</motion.div>}

      <motion.div
        variants={slide}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(44px, 12vw, 64px)',
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: -0.02,
            color: 'var(--po-text)',
            fontVariantNumeric: 'tabular-nums',
            textShadow: `0 0 32px color-mix(in oklch, ${accent} 38%, transparent)`,
          }}
        >
          +<AnimatedCounter target={silverEarned} duration={1100} />
        </p>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.16em',
            color: 'var(--po-text-dim)',
            textTransform: 'uppercase',
          }}
        >
          Silver earned
        </span>
      </motion.div>

      {breakdown && <motion.div variants={slide}>{breakdown}</motion.div>}

      {(goldContribution ?? 0) > 0 && (
        <motion.div variants={slide} style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              background: `color-mix(in oklch, var(--po-gold) 12%, transparent)`,
              border: `1px solid color-mix(in oklch, var(--po-gold) 28%, transparent)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--po-font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--po-gold)',
                letterSpacing: -0.2,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              +{goldContribution} gold
            </span>
            <span
              style={{
                fontFamily: 'var(--po-font-body)',
                fontSize: 11,
                color: 'var(--po-text-dim)',
              }}
            >
              added to the pot
            </span>
          </div>
        </motion.div>
      )}

      {onDismiss && (
        <motion.div variants={slide} style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--po-text-dim)',
              background: 'transparent',
              border: `1px solid color-mix(in oklch, var(--po-text) 18%, transparent)`,
              borderRadius: 12,
              padding: '12px 28px',
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
