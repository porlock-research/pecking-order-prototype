import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { ChannelTypes } from '@pecking-order/shared-types';
import { usePulse } from '../../PulseShell';
import { PULSE_Z } from '../../zIndex';
import { PULSE_SPRING } from '../../springs';

/**
 * Confession Phase Banner — sticky strip below the header that announces
 * "the booth is open right now" and routes a tap to the booth sheet.
 *
 * Why bolder than NarratorLine: the chat-stream narrator gets buried as
 * soon as anyone sends a message. The banner stays put for the duration
 * of the phase, so a player landing cold can see the call-to-action
 * without scrolling. Mirrors PickingBanner's mount pattern (right after
 * PulseHeader, above CastStrip) but with a louder treatment — confession
 * is one of the show's dramatic beats, not a routine pick step.
 *
 * Aesthetic notes (per .impeccable.md):
 * - Pink (--pulse-accent) is the 10% accent; we burn that budget here on
 *   purpose. Calm by default, loud on purpose.
 * - Cassette-tape silhouette (twin reels + crossed-tape X) carries over
 *   the booth's existing visual vocabulary from BoothNameplate without
 *   re-importing it.
 * - Ambient pulse dot — the only "ambient motion is allowed" exception
 *   in Pulse is pending/urgent state, which an open booth qualifies as.
 * - Clash Display 800 tracked-caps for the headline; reality-TV title-card
 *   energy at banner scale.
 */
export function ConfessionPhaseBanner() {
  const confessionActive = useGameStore(s => s.confessionPhase.active);
  const confessionChannelId = useGameStore(s =>
    Object.values(s.channels).find(ch => ch.type === ChannelTypes.CONFESSION)?.id ?? null,
  );
  const { openConfessionBooth } = usePulse();

  if (!confessionActive || !confessionChannelId) return null;

  return (
    <motion.button
      type="button"
      aria-label="Confession Booth open — tap to enter"
      onClick={() => openConfessionBooth(confessionChannelId)}
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -12, opacity: 0 }}
      transition={PULSE_SPRING.snappy}
      whileTap={{ scale: 0.99 }}
      style={{
        appearance: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--pulse-space-md)',
        padding: 'var(--pulse-space-md) var(--pulse-space-lg)',
        background: 'color-mix(in oklch, var(--pulse-accent) 18%, var(--pulse-bg))',
        borderBottom: '1px solid color-mix(in oklch, var(--pulse-accent) 32%, transparent)',
        boxShadow: 'inset 0 1px 0 color-mix(in oklch, var(--pulse-accent) 28%, transparent), inset 0 -10px 24px -16px color-mix(in oklch, var(--pulse-accent) 40%, transparent)',
        position: 'relative',
        zIndex: PULSE_Z.flow,
        color: 'var(--pulse-text-1)',
      }}
    >
      {/* Cassette silhouette — twin reels with crossed tape (same visual
          language as BoothNameplate, miniaturized). aria-hidden because
          the headline already announces the moment. */}
      <span
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 36,
          height: 24,
          flexShrink: 0,
          display: 'inline-block',
        }}
      >
        {/* tape body */}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 4,
            background: 'color-mix(in oklch, var(--pulse-accent) 35%, var(--pulse-bg))',
            border: '1px solid color-mix(in oklch, var(--pulse-accent) 55%, transparent)',
          }}
        />
        {/* twin reel cores */}
        <span
          style={{
            position: 'absolute',
            top: 7,
            left: 6,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--pulse-bg)',
            boxShadow: 'inset 0 0 0 2px color-mix(in oklch, var(--pulse-accent) 70%, transparent)',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: 7,
            right: 6,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--pulse-bg)',
            boxShadow: 'inset 0 0 0 2px color-mix(in oklch, var(--pulse-accent) 70%, transparent)',
          }}
        />
      </span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--pulse-text-1)',
            lineHeight: 1,
          }}
        >
          Booth Open
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-body)',
            fontWeight: 500,
            fontSize: 12,
            color: 'color-mix(in oklch, var(--pulse-text-1) 78%, var(--pulse-accent))',
            lineHeight: 1.3,
          }}
        >
          Anonymous · tap to drop a confession
        </span>
      </span>

      {/* Ambient pulse dot — the only "this is live right now" signal we
          allow ambient motion on. Spring-free CSS keyframe (defined inline
          for proximity; if reused elsewhere, promote to pulse-theme.css). */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'var(--pulse-accent)',
          boxShadow: '0 0 0 4px color-mix(in oklch, var(--pulse-accent) 28%, transparent)',
          animation: 'pulse-confession-dot 1.6s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes pulse-confession-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(1.18); opacity: 0.78; }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes pulse-confession-dot {
            0%, 100% { transform: scale(1); opacity: 1; }
          }
        }
      `}</style>
    </motion.button>
  );
}
