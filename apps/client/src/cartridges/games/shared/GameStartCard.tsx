import { motion, useReducedMotion } from 'framer-motion';

interface GameStartCardProps {
  /** Display name from CARTRIDGE_INFO. */
  gameName: string;
  /** Atmospheric tagline (mood from GAME_INFO, or fallback). */
  tagline?: string;
  /** Per-game accent — Start CTA tint. */
  accent: string;
  /** Optional extra paragraph (used for game-specific instructions). */
  description?: string;
  /** Start handler. */
  onStart: () => void;
  /** Override the CTA label — defaults to "Start". */
  ctaLabel?: string;
  /** Disable the CTA (e.g. while questions are loading). */
  disabled?: boolean;
}

/**
 * NOT_STARTED state for arcade and live games. Replaces the inline
 * "p-6 space-y-4 text-center / bg-skin-gold Start" pattern that was
 * identical across all 25 games.
 *
 * The CTA picks up the per-game accent — different games visibly own
 * the start moment instead of an all-gold uniform.
 */
export function GameStartCard({
  gameName,
  tagline,
  accent,
  description,
  onStart,
  ctaLabel = 'Start',
  disabled,
}: GameStartCardProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
        padding: '24px 16px 28px',
        textAlign: 'center',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--po-font-display)',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: -0.3,
            color: 'var(--po-text)',
          }}
        >
          {gameName}
        </p>
        {tagline && (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--po-font-body)',
              fontSize: 14,
              lineHeight: 1.4,
              color: 'var(--po-text-dim)',
              maxWidth: '38ch',
            }}
          >
            {tagline}
          </p>
        )}
        {description && (
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: 'var(--po-font-body)',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--po-text-dim)',
              maxWidth: '38ch',
            }}
          >
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--po-text)',
          background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 95%, white) 0%, ${accent} 100%)`,
          border: 'none',
          borderRadius: 14,
          padding: '14px 32px',
          minHeight: 48,
          minWidth: 160,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          boxShadow: [
            `inset 0 1px 0 color-mix(in oklch, ${accent} 60%, white)`,
            `0 6px 18px -8px color-mix(in oklch, ${accent} 60%, transparent)`,
          ].join(', '),
          transition: 'transform 120ms ease, box-shadow 200ms ease',
        }}
        onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
        onPointerUp={(e) => { e.currentTarget.style.transform = ''; }}
        onPointerLeave={(e) => { e.currentTarget.style.transform = ''; }}
      >
        {ctaLabel}
      </button>
    </motion.div>
  );
}
