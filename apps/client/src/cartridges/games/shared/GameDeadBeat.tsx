import { motion, useReducedMotion } from 'framer-motion';

interface GameDeadBeatProps {
  /** Per-game DEAD line — e.g. "Caught your tail.", "Pattern broken." */
  line: string;
  /** Per-game accent — used for the badge tint. */
  accent: string;
}

/**
 * The DEAD beat — one short sentence the moment the run ends, before
 * the score lands. This is a peak frame, not filler. Title-card voice,
 * display font, accent-tinted aura.
 *
 * Replaces the old `text-skin-dim animate-pulse "Calculating
 * score..."` placeholder. The line itself comes from GAME_INFO so
 * each game owns its closer ("Popped.", "Crashed.", "Time's up.").
 */
export function GameDeadBeat({ line, accent }: GameDeadBeatProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 24px 40px',
        gap: 14,
        minHeight: 200,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.28em',
          color: accent,
          textTransform: 'uppercase',
        }}
      >
        Run over
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-display)',
          fontSize: 'clamp(28px, 7vw, 40px)',
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: -0.4,
          color: 'var(--po-text)',
          textAlign: 'center',
          textShadow: `0 0 36px color-mix(in oklch, ${accent} 36%, transparent)`,
        }}
      >
        {line}
      </p>
    </motion.div>
  );
}
