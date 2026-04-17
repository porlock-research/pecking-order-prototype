import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer, MechanismTone } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

export type HaloVariant =
  | 'spotlight' // generic — punitive, halo radiates from center
  | 'crown'     // FINALS — gold celebratory
  | 'shield'    // SHIELD — soft pink, "left unsaved" energy
  | 'frame'     // PODIUM — elevated/framed, broken on elimination
  | 'fade';     // generic eliminated — desaturated portrait, dimmed accent

interface VotingResultHeroProps {
  /** The subject of the moment — eliminated player (or FINALS winner). */
  subjectPlayer: SocialPlayer | undefined;
  /** Mechanism accent color — drives halo, label, glow. */
  accent: string;
  /** Tone shapes the visual register: punitive / fate / celebratory. */
  tone: MechanismTone;
  /** Halo variant — controls portrait treatment + decoration. */
  haloVariant?: HaloVariant;
  /** Subtitle below name — e.g. "Cast out by majority". */
  subtitle: string;
  /** Optional small uppercase label above name — e.g. "ELIMINATED" or "WINNER". */
  label?: string;
  /** Optional decoration icon, tucked onto the halo (used for FINALS Crown badge). */
  Icon?: React.ComponentType<any>;
  /** Portrait size in px. Defaults to 112; FINALS uses 128. */
  portraitSize?: number;
  /** Optional secondary subject — used for executioner+target / mutual-pair moments. */
  secondarySubject?: {
    player: SocialPlayer | undefined;
    /** Caption under their portrait — e.g. "executioner" or "trusted you back". */
    caption: string;
  };
}

/**
 * Per-mechanism hero composition for the REVEAL phase. Models the WinnerHero
 * pattern from DilemmaReveal but adapts the tone:
 *   - punitive  → accent + soft red veil, slight desaturation on portrait
 *   - fate      → muted/cold, no glow, no veil — inevitability not celebration
 *   - celebratory (FINALS) → full accent halo, larger portrait, optional Icon
 *
 * Always renders the portrait + label + name + subtitle.
 * Optional secondarySubject renders a smaller paired portrait below
 * (used by EXECUTIONER for the executioner badge, TRUST_PAIRS for mutuals).
 */
export function VotingResultHero({
  subjectPlayer,
  accent,
  tone,
  haloVariant = 'spotlight',
  subtitle,
  label,
  Icon,
  portraitSize = 112,
  secondarySubject,
}: VotingResultHeroProps) {
  const reduce = useReducedMotion();
  const firstName = (subjectPlayer?.personaName || '').split(' ')[0] || '—';

  const isCelebratory = tone === 'celebratory';
  const isFate = tone === 'fate';
  const isPunitive = tone === 'punitive';

  // Tone-driven background tint
  const bgGradient = isCelebratory
    ? `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 28%, transparent) 0%, color-mix(in oklch, ${accent} 10%, transparent) 55%, transparent 100%), var(--po-bg-panel, rgba(0,0,0,0.25))`
    : isFate
      ? `radial-gradient(120% 100% at 50% 0%, color-mix(in oklch, var(--po-text) 8%, transparent) 0%, transparent 70%), var(--po-bg-panel, rgba(0,0,0,0.25))`
      : `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 18%, transparent) 0%, color-mix(in oklch, ${accent} 6%, transparent) 55%, transparent 100%), var(--po-bg-panel, rgba(0,0,0,0.25))`;

  // Tone-driven outer glow
  const boxShadow = isCelebratory
    ? `0 0 56px color-mix(in oklch, ${accent} 40%, transparent), 0 0 120px color-mix(in oklch, ${accent} 18%, transparent)`
    : isFate
      ? '0 6px 24px rgba(0,0,0,0.2)'
      : `0 0 32px color-mix(in oklch, ${accent} 22%, transparent)`;

  // Punitive haloVariant=fade dampens the portrait
  const portraitFilter =
    haloVariant === 'fade' && isPunitive ? 'grayscale(35%) saturate(0.85)' : undefined;

  // Halo conic ring — broken/dim for fate, full for others
  const haloBackground = isFate
    ? 'transparent'
    : `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 40%, transparent), ${accent})`;
  const haloPadding = isFate ? 0 : 3;
  const haloBorder = isFate
    ? '1.5px dashed color-mix(in oklch, var(--po-text) 25%, transparent)'
    : 'none';

  // Halo glow ring around portrait
  const haloShadow = isCelebratory
    ? `0 0 36px color-mix(in oklch, ${accent} 65%, transparent), 0 0 80px color-mix(in oklch, ${accent} 28%, transparent)`
    : isFate
      ? undefined
      : `0 0 22px color-mix(in oklch, ${accent} 45%, transparent)`;

  // Fade variant adds a soft red veil on top of the portrait when punitive
  const veilOverlay =
    haloVariant === 'fade' && isPunitive ? (
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'radial-gradient(60% 60% at 50% 50%, transparent 0%, color-mix(in oklch, var(--po-pink) 18%, transparent) 100%)',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />
    ) : null;

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.9, 1.03, 1], y: 0 }}
      transition={{ duration: 0.65, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        position: 'relative',
        padding: '24px 18px 22px',
        borderRadius: 18,
        background: bgGradient,
        border: `1.5px solid color-mix(in oklch, ${accent} 38%, transparent)`,
        boxShadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {/* Soft radiant backdrop layer — adds depth on celebratory/punitive heroes. */}
      {!isFate && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-40% -10% auto -10%',
            height: '80%',
            background: `radial-gradient(60% 60% at 50% 30%, color-mix(in oklch, ${accent} 24%, transparent) 0%, transparent 70%)`,
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Subject portrait + halo */}
      <motion.div
        initial={reduce ? undefined : { scale: 0.92 }}
        animate={reduce ? undefined : { scale: [0.92, 1, 1] }}
        transition={{ duration: 0.6, delay: 0.18, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'relative',
          borderRadius: '50%',
          padding: haloPadding,
          background: haloBackground,
          border: haloBorder,
          boxShadow: haloShadow,
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: '50%',
            background: 'var(--po-bg-panel, rgba(0,0,0,0.35))',
            padding: 2,
            overflow: 'hidden',
            filter: portraitFilter,
          }}
        >
          <PersonaAvatar
            avatarUrl={subjectPlayer?.avatarUrl}
            personaName={subjectPlayer?.personaName}
            size={portraitSize}
          />
          {veilOverlay}
        </div>
        {Icon && (
          <div
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: accent,
              border: '2.5px solid var(--po-bg-panel, rgba(0,0,0,0.5))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 14px color-mix(in oklch, ${accent} 60%, transparent)`,
            }}
            aria-hidden="true"
          >
            <Icon size={20} strokeWidth={2.5} color="#fff" />
          </div>
        )}
      </motion.div>

      {/* Label + name + subtitle */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
        }}
      >
        {label && (
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.28em',
              color: accent,
              textTransform: 'uppercase',
              textShadow: isFate ? undefined : `0 0 12px color-mix(in oklch, ${accent} 45%, transparent)`,
            }}
          >
            {label}
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: isCelebratory ? 'clamp(28px, 7vw, 36px)' : 'clamp(22px, 6vw, 28px)',
            fontWeight: 700,
            letterSpacing: -0.6,
            lineHeight: 1.05,
            color: 'var(--po-text)',
            textAlign: 'center',
          }}
        >
          {firstName}
        </span>
        <span
          style={{
            marginTop: 2,
            fontFamily: 'var(--po-font-body)',
            fontSize: 13,
            fontWeight: 600,
            color: isFate ? 'var(--po-text-dim)' : accent,
            letterSpacing: 0.1,
            textAlign: 'center',
          }}
        >
          {subtitle}
        </span>
      </div>

      {/* Optional secondary subject — small paired portrait below. */}
      {secondarySubject?.player && (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.5 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            marginTop: 6,
          }}
        >
          <div
            style={{
              borderRadius: '50%',
              padding: 2,
              background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 35%, transparent), ${accent})`,
              boxShadow: `0 0 16px color-mix(in oklch, ${accent} 30%, transparent)`,
            }}
          >
            <PersonaAvatar
              avatarUrl={secondarySubject.player.avatarUrl}
              personaName={secondarySubject.player.personaName}
              size={48}
            />
          </div>
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.22em',
              color: accent,
              textTransform: 'uppercase',
            }}
          >
            {secondarySubject.caption}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
