import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { SocialPlayer, MechanismTone } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

export type HaloVariant =
  | 'fade'      // MAJORITY — slow rotating ring, desaturated portrait
  | 'shield'    // SHIELD — 4 segmented arcs, one breaks away
  | 'frame'     // PODIUM_SACRIFICE — corner brackets tilt off-axis
  | 'crown'     // FINALS — laurel sweep + crown descend, gold radiate
  | 'spotlight' // EXECUTIONER — theatrical cone from above
  | 'burst'     // BUBBLE — concentric iris rings pop
  | 'rupture';  // TRUST_PAIRS — halo cracks on a diagonal

interface VotingResultHeroProps {
  /** The subject of the moment — eliminated player (or FINALS winner). */
  subjectPlayer: SocialPlayer | undefined;
  /** Mechanism accent color — drives halo, label, glow. */
  accent: string;
  /** Tone shapes the visual register: punitive / fate / celebratory. */
  tone: MechanismTone;
  /** Halo variant — controls portrait treatment + signature entrance. */
  haloVariant?: HaloVariant;
  /** Subtitle below name — e.g. "Cast out by majority". */
  subtitle: string;
  /** Single dramatic word above the name — e.g. "OUT", "CROWNED". */
  label?: string;
  /** Optional decoration icon (e.g. Phosphor CrownFill for FINALS). */
  Icon?: React.ComponentType<any>;
  /** Portrait size in px. Defaults to 140; FINALS uses 160. */
  portraitSize?: number;
  /** Optional secondary subject — paired composition for EXECUTIONER / mutuals. */
  secondarySubject?: {
    player: SocialPlayer | undefined;
    /** Caption under the secondary portrait — e.g. "The executioner". */
    caption: string;
  };
}

/**
 * Reveal hero for voting cartridges. The climax frame.
 *
 * Async-game contract: every reveal is replayable. The animation auto-plays
 * on mount, then the composition holds as a screenshot-ready peak frame.
 * Tap (or Enter/Space) replays the entrance.
 *
 * Per-variant geometry — the five halo types each render a distinct SVG
 * treatment with its own entrance choreography, not the same conic ring
 * with different tints.
 *
 * When `secondarySubject` is present AND tone is punitive (EXECUTIONER),
 * renders a paired composition: eliminated portrait + connector + secondary
 * portrait at equal size, both captioned.
 */
export function VotingResultHero({
  subjectPlayer,
  accent,
  tone,
  haloVariant = 'fade',
  subtitle,
  label,
  Icon,
  portraitSize,
  secondarySubject,
}: VotingResultHeroProps) {
  const reduce = useReducedMotion();
  const [replayKey, setReplayKey] = useState(0);
  const firstName = (subjectPlayer?.personaName || '').split(' ')[0] || '\u2014';

  const isCelebratory = tone === 'celebratory';
  const isFate = tone === 'fate';
  const size = portraitSize ?? (isCelebratory ? 160 : 140);

  const paired = !!secondarySubject?.player && tone === 'punitive';

  // Tone-driven frame backdrop
  const bgGradient = isCelebratory
    ? `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 32%, transparent) 0%, color-mix(in oklch, ${accent} 10%, transparent) 55%, transparent 100%), var(--po-bg-panel, rgba(0,0,0,0.28))`
    : isFate
      ? `radial-gradient(120% 100% at 50% 0%, color-mix(in oklch, var(--po-text) 8%, transparent) 0%, transparent 70%), var(--po-bg-panel, rgba(0,0,0,0.28))`
      : `radial-gradient(120% 120% at 50% 0%, color-mix(in oklch, ${accent} 20%, transparent) 0%, color-mix(in oklch, ${accent} 6%, transparent) 55%, transparent 100%), var(--po-bg-panel, rgba(0,0,0,0.28))`;

  const outerBoxShadow = isCelebratory
    ? `0 0 64px color-mix(in oklch, ${accent} 42%, transparent), 0 0 140px color-mix(in oklch, ${accent} 20%, transparent), inset 0 0 0 1px color-mix(in oklch, ${accent} 18%, transparent)`
    : isFate
      ? `inset 0 0 0 1px color-mix(in oklch, var(--po-text) 10%, transparent)`
      : `0 0 40px color-mix(in oklch, ${accent} 22%, transparent), inset 0 0 0 1px color-mix(in oklch, ${accent} 16%, transparent)`;

  const replay = () => setReplayKey((k) => k + 1);
  const onKey: React.KeyboardEventHandler = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      replay();
    }
  };

  return (
    <motion.div
      key={replayKey}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.2, 0.9, 0.3, 1] }}
      onClick={replay}
      onKeyDown={onKey}
      role="button"
      tabIndex={0}
      aria-label={label ? `${label} ${firstName}. Tap to replay.` : 'Reveal. Tap to replay.'}
      style={{
        position: 'relative',
        padding: '26px 18px 24px',
        borderRadius: 20,
        background: bgGradient,
        boxShadow: outerBoxShadow,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        overflow: 'hidden',
        cursor: reduce ? 'default' : 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Radiant backdrop layer — adds depth to celebratory/punitive heroes. */}
      {!isFate && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '-40% -10% auto -10%',
            height: '80%',
            background: `radial-gradient(60% 60% at 50% 30%, color-mix(in oklch, ${accent} ${isCelebratory ? 28 : 22}%, transparent) 0%, transparent 70%)`,
            filter: 'blur(10px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Portrait composition — paired (executioner) or single. */}
      {paired ? (
        <PairedComposition
          subject={subjectPlayer}
          secondary={secondarySubject!.player!}
          secondaryCaption={secondarySubject!.caption}
          accent={accent}
          reduce={!!reduce}
          size={Math.min(size, 108)}
        />
      ) : (
        <HaloComposition
          variant={haloVariant}
          accent={accent}
          tone={tone}
          size={size}
          subjectPlayer={subjectPlayer}
          reduce={!!reduce}
          Icon={Icon}
        />
      )}

      {/* Typography — reveal label, name, subtitle. */}
      <RevealTypography
        label={label}
        firstName={firstName}
        subtitle={subtitle}
        accent={accent}
        tone={tone}
        reduce={!!reduce}
        celebratory={isCelebratory}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Typography                                                         */
/* ------------------------------------------------------------------ */

function RevealTypography({
  label,
  firstName,
  subtitle,
  accent,
  tone,
  reduce,
  celebratory,
}: {
  label?: string;
  firstName: string;
  subtitle: string;
  accent: string;
  tone: MechanismTone;
  reduce: boolean;
  celebratory: boolean;
}) {
  const isFate = tone === 'fate';
  const nameColor = celebratory ? 'var(--po-text)' : 'var(--po-text)';
  const labelColor = celebratory ? 'var(--po-gold)' : accent;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        zIndex: 2,
        marginTop: 4,
      }}
    >
      {label && (
        <motion.span
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: '0.14em',
            color: labelColor,
            textTransform: 'uppercase',
            textShadow: isFate
              ? undefined
              : `0 0 16px color-mix(in oklch, ${accent} 55%, transparent)`,
            lineHeight: 1,
          }}
        >
          {label}
        </motion.span>
      )}
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 'clamp(48px, 13vw, 88px)',
          fontWeight: 700,
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
          color: nameColor,
          textAlign: 'center',
          display: 'block',
          padding: '0 4px',
          maxWidth: '100%',
          overflowWrap: 'break-word',
        }}
        aria-label={firstName}
      >
        {celebratory && !reduce ? (
          // Letter-type-in — reveals on crown descent so it lands with the icon.
          Array.from(firstName).map((ch, i) => (
            <motion.span
              key={i}
              aria-hidden="true"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.22,
                delay: 1.15 + i * 0.05,
                ease: [0.2, 0.9, 0.3, 1],
              }}
              style={{ display: 'inline-block', whiteSpace: 'pre' }}
            >
              {ch}
            </motion.span>
          ))
        ) : (
          <motion.span
            aria-hidden="true"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
            style={{ display: 'inline-block' }}
          >
            {firstName}
          </motion.span>
        )}
      </span>
      <motion.span
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.55 }}
        style={{
          fontFamily: 'var(--po-font-body)',
          fontSize: 14,
          fontWeight: 600,
          color: isFate ? 'var(--po-text-dim)' : accent,
          letterSpacing: 0.1,
          textAlign: 'center',
          marginTop: 2,
        }}
      >
        {subtitle}
      </motion.span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Halo compositions — per-variant geometry                           */
/* ------------------------------------------------------------------ */

interface HaloCompositionProps {
  variant: HaloVariant;
  accent: string;
  tone: MechanismTone;
  size: number;
  subjectPlayer: SocialPlayer | undefined;
  reduce: boolean;
  Icon?: React.ComponentType<any>;
}

function HaloComposition(props: HaloCompositionProps) {
  switch (props.variant) {
    case 'shield':
      return <ShieldHalo {...props} />;
    case 'frame':
      return <FrameHalo {...props} />;
    case 'crown':
      return <CrownHalo {...props} />;
    case 'spotlight':
      return <SpotlightHalo {...props} />;
    case 'burst':
      return <BurstHalo {...props} />;
    case 'rupture':
      return <RuptureHalo {...props} />;
    case 'fade':
    default:
      return <FadeHalo {...props} />;
  }
}

/** Portrait inner — the actual avatar wrapped in a neutral padded surface. */
function PortraitInner({
  subjectPlayer,
  size,
  filter,
}: {
  subjectPlayer: SocialPlayer | undefined;
  size: number;
  filter?: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: '50%',
        background: 'var(--po-bg-panel, rgba(0,0,0,0.35))',
        padding: 2,
        overflow: 'hidden',
        filter,
      }}
    >
      <PersonaAvatar
        avatarUrl={subjectPlayer?.avatarUrl}
        personaName={subjectPlayer?.personaName}
        size={size}
      />
    </div>
  );
}

/* ---------- FadeHalo — MAJORITY ---------- */

function FadeHalo({ accent, size, subjectPlayer, reduce }: HaloCompositionProps) {
  const ringSize = size + 18;
  return (
    <div style={{ position: 'relative', width: ringSize, height: ringSize }}>
      <motion.div
        aria-hidden="true"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 22, ease: 'linear', repeat: Infinity }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          padding: 3,
          background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 18%, transparent) 40%, color-mix(in oklch, ${accent} 8%, transparent) 65%, ${accent})`,
          opacity: 0.85,
          boxShadow: `0 0 28px color-mix(in oklch, ${accent} 35%, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 9,
          borderRadius: '50%',
          background: 'var(--po-bg-deep, rgba(0,0,0,0.5))',
        }}
      />
      <div style={{ position: 'absolute', inset: 9 }}>
        <PortraitInner
          subjectPlayer={subjectPlayer}
          size={size}
          filter="grayscale(32%) saturate(0.85)"
        />
      </div>
      {/* Pink veil — "cast out" tint */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 11,
          borderRadius: '50%',
          background:
            'radial-gradient(60% 60% at 50% 50%, transparent 0%, color-mix(in oklch, var(--po-pink) 16%, transparent) 100%)',
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/* ---------- ShieldHalo — SHIELD ---------- */

function ShieldHalo({ accent, size, subjectPlayer, reduce }: HaloCompositionProps) {
  const canvas = size + 40;
  const r = (size + 14) / 2;
  const cx = canvas / 2;
  const cy = canvas / 2;

  // Arc d-string: 90° arc from angle A to angle B
  const arc = (aDeg: number, bDeg: number) => {
    const a = (aDeg * Math.PI) / 180;
    const b = (bDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a);
    const y1 = cy + r * Math.sin(a);
    const x2 = cx + r * Math.cos(b);
    const y2 = cy + r * Math.sin(b);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  // 4 arcs, 88° each, 2° gap between
  const arcs = [
    arc(-89, -1),   // top
    arc(1, 89),     // right  ← this one breaks
    arc(91, 179),   // bottom
    arc(181, 269),  // left
  ];
  const breakIndex = 1;

  return (
    <div style={{ position: 'relative', width: canvas, height: canvas }}>
      <svg
        viewBox={`0 0 ${canvas} ${canvas}`}
        width={canvas}
        height={canvas}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <filter id={`shield-glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        {arcs.map((d, i) => {
          const broken = i === breakIndex;
          return (
            <motion.path
              key={i}
              d={d}
              stroke={accent}
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              style={{ filter: `url(#shield-glow-${size})` }}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.88 }}
              animate={
                broken && !reduce
                  ? {
                      opacity: [0, 1, 1, 0.3],
                      scale: [0.88, 1, 1, 1.15],
                      rotate: [0, 0, 0, 14],
                      x: [0, 0, 0, 12],
                      y: [0, 0, 0, -4],
                    }
                  : { opacity: 1, scale: 1 }
              }
              transition={
                broken && !reduce
                  ? {
                      duration: 1.2,
                      times: [0, 0.35, 0.6, 1],
                      delay: 0.1 * i,
                      ease: [0.3, 0.8, 0.3, 1],
                    }
                  : { duration: 0.55, delay: 0.1 * i, ease: [0.2, 0.9, 0.3, 1] }
              }
              transform-origin={`${cx} ${cy}`}
            />
          );
        })}
        {/* Shard shapes — fall away after break */}
        {!reduce && (
          <>
            <motion.circle
              cx={cx + 34}
              cy={cy - 30}
              r={2.5}
              fill={accent}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], y: [0, 24, 48], scale: [0, 1, 0.6] }}
              transition={{ duration: 1.1, delay: 0.8, ease: 'easeIn' }}
            />
            <motion.circle
              cx={cx + 40}
              cy={cy - 18}
              r={1.5}
              fill={accent}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], y: [0, 30, 58], scale: [0, 1, 0.4] }}
              transition={{ duration: 1.3, delay: 0.9, ease: 'easeIn' }}
            />
          </>
        )}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: (canvas - size) / 2,
          top: (canvas - size) / 2,
        }}
      >
        <PortraitInner
          subjectPlayer={subjectPlayer}
          size={size}
          filter="grayscale(25%) saturate(0.9)"
        />
      </div>
    </div>
  );
}

/* ---------- FrameHalo — PODIUM_SACRIFICE ---------- */

function FrameHalo({ accent, size, subjectPlayer, reduce }: HaloCompositionProps) {
  const canvas = size + 44;
  const bracketLen = 28;
  const corners = [
    // [x, y, rotation in deg]
    [10, 10, 0],
    [canvas - 10, 10, 90],
    [canvas - 10, canvas - 10, 180],
    [10, canvas - 10, 270],
  ];

  return (
    <motion.div
      style={{ position: 'relative', width: canvas, height: canvas, transformOrigin: '50% 50%' }}
      initial={reduce ? { rotate: 0 } : { rotate: 0 }}
      animate={reduce ? { rotate: 0 } : { rotate: [0, 0, -3.5] }}
      transition={{ duration: 1.4, times: [0, 0.55, 1], ease: [0.4, 0.2, 0.3, 1], delay: 0.1 }}
    >
      <svg
        viewBox={`0 0 ${canvas} ${canvas}`}
        width={canvas}
        height={canvas}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        {corners.map(([x, y, rot], i) => (
          <motion.g
            key={i}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.08 * i, ease: [0.2, 0.9, 0.3, 1] }}
            transform={`translate(${x}, ${y}) rotate(${rot})`}
          >
            <path
              d={`M 0 ${bracketLen} L 0 0 L ${bracketLen} 0`}
              stroke={accent}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              style={{
                filter: `drop-shadow(0 0 8px color-mix(in oklch, ${accent} 50%, transparent))`,
              }}
            />
            {/* Inner accent dot */}
            <circle cx={4} cy={4} r={1.5} fill={accent} opacity={0.7} />
          </motion.g>
        ))}
      </svg>
      <motion.div
        initial={reduce ? { y: 0 } : { y: 0 }}
        animate={reduce ? { y: 0 } : { y: [0, 0, 8] }}
        transition={{ duration: 1.4, times: [0, 0.55, 1], ease: [0.4, 0.2, 0.3, 1], delay: 0.1 }}
        style={{
          position: 'absolute',
          left: (canvas - size) / 2,
          top: (canvas - size) / 2,
        }}
      >
        <PortraitInner
          subjectPlayer={subjectPlayer}
          size={size}
          filter="grayscale(15%) saturate(0.95)"
        />
      </motion.div>
    </motion.div>
  );
}

/* ---------- CrownHalo — FINALS ---------- */

function CrownHalo({ accent, size, subjectPlayer, reduce, Icon }: HaloCompositionProps) {
  const canvas = size + 80;
  const cx = canvas / 2;
  const cy = canvas / 2;
  const laurelRadius = size / 2 + 10;

  return (
    <div style={{ position: 'relative', width: canvas, height: canvas, marginTop: 6 }}>
      {/* Gold radiate backdrop — the pulse behind the winner */}
      <motion.div
        aria-hidden="true"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.4 }}
        animate={reduce ? { opacity: 1 } : { opacity: [0, 0.8, 0.55], scale: [0.4, 1.25, 1.1] }}
        transition={{ duration: 1.3, times: [0, 0.5, 1], delay: 0.7, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `radial-gradient(50% 50% at 50% 50%, color-mix(in oklch, ${accent} 55%, transparent) 0%, color-mix(in oklch, ${accent} 22%, transparent) 40%, transparent 70%)`,
          filter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />

      {/* Laurel branches — SVG dots arranged in two arcs, budding in */}
      <svg
        viewBox={`0 0 ${canvas} ${canvas}`}
        width={canvas}
        height={canvas}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        {[0, 1].map((side) => {
          // Left side: angles from 120°→210°, right side: -30°→60°
          const startAngle = side === 0 ? 120 : -30;
          const endAngle = side === 0 ? 210 : 60;
          const steps = 6;
          return Array.from({ length: steps }).map((_, j) => {
            const t = j / (steps - 1);
            const aDeg = startAngle + (endAngle - startAngle) * t;
            const a = (aDeg * Math.PI) / 180;
            const rx = cx + laurelRadius * Math.cos(a);
            const ry = cy + laurelRadius * Math.sin(a);
            // Leaf shape rotation: tangent to arc
            const leafRot = aDeg + (side === 0 ? 90 : -90);
            return (
              <motion.ellipse
                key={`${side}-${j}`}
                cx={rx}
                cy={ry}
                rx={6}
                ry={3.2}
                fill={accent}
                opacity={0.85}
                transform={`rotate(${leafRot} ${rx} ${ry})`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0 }}
                animate={{ opacity: 0.85, scale: 1 }}
                transition={{
                  duration: 0.35,
                  delay: 0.2 + j * 0.05 + side * 0.08,
                  ease: [0.2, 0.9, 0.3, 1],
                }}
                style={{
                  transformOrigin: `${rx}px ${ry}px`,
                  filter: `drop-shadow(0 0 6px color-mix(in oklch, ${accent} 60%, transparent))`,
                }}
              />
            );
          });
        })}
      </svg>

      {/* Winner portrait — crash-lands from top, scale 1.6 → 1 */}
      <motion.div
        initial={reduce ? { opacity: 0, scale: 1 } : { opacity: 0, scale: 1.6, y: -40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          duration: 0.85,
          delay: 0.4,
          type: 'spring',
          stiffness: 320,
          damping: 22,
        }}
        style={{
          position: 'absolute',
          left: (canvas - size) / 2,
          top: (canvas - size) / 2,
        }}
      >
        <div
          style={{
            borderRadius: '50%',
            padding: 3,
            background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 55%, transparent) 40%, color-mix(in oklch, ${accent} 22%, transparent) 60%, ${accent})`,
            boxShadow: `0 0 40px color-mix(in oklch, ${accent} 70%, transparent), 0 0 88px color-mix(in oklch, ${accent} 30%, transparent)`,
          }}
        >
          <PortraitInner subjectPlayer={subjectPlayer} size={size} />
        </div>
      </motion.div>

      {/* Crown descends from above, lands on portrait */}
      {Icon && (
        <motion.div
          initial={reduce ? { opacity: 0, y: 0, scale: 1 } : { opacity: 0, y: -44, scale: 1.4, rotate: -12 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
          transition={{
            duration: 0.6,
            delay: reduce ? 0 : 1.05,
            type: 'spring',
            stiffness: 420,
            damping: 18,
          }}
          style={{
            position: 'absolute',
            left: cx - 28,
            top: cy - size / 2 - 26,
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            filter: `drop-shadow(0 0 18px color-mix(in oklch, ${accent} 70%, transparent))`,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <Icon size={56} weight="fill" color={accent as any} />
        </motion.div>
      )}
    </div>
  );
}

/* ---------- SpotlightHalo — EXECUTIONER ---------- */

function SpotlightHalo({ accent, size, subjectPlayer, reduce }: HaloCompositionProps) {
  const canvas = size + 48;
  const cx = canvas / 2;

  return (
    <div style={{ position: 'relative', width: canvas, height: canvas + 24 }}>
      {/* Theatrical cone — SVG trapezoid fading from top */}
      <svg
        viewBox={`0 0 ${canvas} ${canvas + 24}`}
        width={canvas}
        height={canvas + 24}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`spot-grad-${size}`} x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.6" />
            <stop offset="50%" stopColor={accent} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.polygon
          points={`${cx - 10},0 ${cx + 10},0 ${canvas + 14},${canvas + 10} ${-14},${canvas + 10}`}
          fill={`url(#spot-grad-${size})`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0.4 }}
          animate={{ opacity: 0.85, scaleY: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.9, 0.3, 1] }}
          style={{ transformOrigin: `${cx}px 0px` }}
        />
      </svg>

      {/* Portrait — sits in the pool of light */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.5, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          position: 'absolute',
          left: (canvas - size) / 2,
          top: 20,
        }}
      >
        <div
          style={{
            borderRadius: '50%',
            padding: 2,
            background: `radial-gradient(circle at 50% 20%, color-mix(in oklch, ${accent} 55%, transparent), color-mix(in oklch, ${accent} 18%, transparent) 80%)`,
            boxShadow: `0 0 30px color-mix(in oklch, ${accent} 40%, transparent)`,
          }}
        >
          <PortraitInner subjectPlayer={subjectPlayer} size={size} filter="saturate(1.05)" />
        </div>
      </motion.div>
    </div>
  );
}

/* ---------- BurstHalo — BUBBLE ---------- */

function BurstHalo({ accent, size, subjectPlayer, reduce }: HaloCompositionProps) {
  const canvas = size + 60;
  const rings = [0, 1, 2];

  return (
    <div style={{ position: 'relative', width: canvas, height: canvas }}>
      {rings.map((i) => (
        <motion.div
          key={i}
          aria-hidden="true"
          initial={reduce ? { opacity: 0, scale: 1 } : { opacity: 0, scale: 0.2 }}
          animate={reduce ? { opacity: 0.4 } : { opacity: [0, 0.55, 0], scale: [0.2, 1.1, 1.25] }}
          transition={{
            duration: 1.6,
            delay: 0.1 + i * 0.18,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${accent}`,
            opacity: 0.55,
            filter: 'blur(0.4px)',
          }}
        />
      ))}
      {/* Static outer ring peak-frame — present after burst */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 6,
          borderRadius: '50%',
          border: `1.5px solid color-mix(in oklch, ${accent} 55%, transparent)`,
          boxShadow: `0 0 24px color-mix(in oklch, ${accent} 28%, transparent)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: (canvas - size) / 2,
          top: (canvas - size) / 2,
        }}
      >
        <PortraitInner
          subjectPlayer={subjectPlayer}
          size={size}
          filter="grayscale(25%) saturate(0.9)"
        />
      </div>
    </div>
  );
}

/* ---------- RuptureHalo — TRUST_PAIRS ---------- */

function RuptureHalo({ accent, size, subjectPlayer, reduce }: HaloCompositionProps) {
  const canvas = size + 36;
  const r = (size + 10) / 2;
  const cx = canvas / 2;
  const cy = canvas / 2;

  // Two half-arcs: top-left and bottom-right (diagonal split)
  const arc = (aDeg: number, bDeg: number) => {
    const a = (aDeg * Math.PI) / 180;
    const b = (bDeg * Math.PI) / 180;
    const x1 = cx + r * Math.cos(a);
    const y1 = cy + r * Math.sin(a);
    const x2 = cx + r * Math.cos(b);
    const y2 = cy + r * Math.sin(b);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  };

  // Upper-left half: 135° to 315° going through top-left
  // Lower-right half: 315° to 135° going through bottom-right
  const upperLeft = arc(135, -45);
  const lowerRight = arc(-45, 135);

  return (
    <div style={{ position: 'relative', width: canvas, height: canvas }}>
      <svg
        viewBox={`0 0 ${canvas} ${canvas}`}
        width={canvas}
        height={canvas}
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
        aria-hidden="true"
      >
        {/* Upper-left arc — diverges up+left */}
        <motion.path
          d={upperLeft}
          stroke={accent}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 0, y: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 1], x: [0, 0, -4], y: [0, 0, -4] }}
          transition={{ duration: 1.2, times: [0, 0.5, 1], ease: [0.3, 0.8, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 10px color-mix(in oklch, ${accent} 50%, transparent))` }}
        />
        {/* Lower-right arc — diverges down+right */}
        <motion.path
          d={lowerRight}
          stroke={accent}
          strokeWidth={3.5}
          strokeLinecap="round"
          fill="none"
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 0, y: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0, 1, 1], x: [0, 0, 4], y: [0, 0, 4] }}
          transition={{ duration: 1.2, times: [0, 0.5, 1], ease: [0.3, 0.8, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 10px color-mix(in oklch, ${accent} 50%, transparent))` }}
        />
        {/* Crack line — a diagonal flash that appears at the moment of rupture */}
        <motion.line
          x1={cx - r * 0.82}
          y1={cy - r * 0.82}
          x2={cx + r * 0.82}
          y2={cy + r * 0.82}
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          initial={reduce ? { opacity: 0 } : { opacity: 0, pathLength: 0 }}
          animate={reduce ? { opacity: 0.5 } : { opacity: [0, 1, 0.4], pathLength: [0, 1, 1] }}
          transition={{ duration: 0.6, delay: 0.45, ease: 'easeInOut' }}
          style={{
            filter: `drop-shadow(0 0 8px color-mix(in oklch, ${accent} 70%, transparent))`,
            strokeDasharray: '6 4',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: (canvas - size) / 2,
          top: (canvas - size) / 2,
        }}
      >
        <PortraitInner
          subjectPlayer={subjectPlayer}
          size={size}
          filter="grayscale(28%) saturate(0.85)"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paired composition — EXECUTIONER reveal                             */
/* ------------------------------------------------------------------ */

function PairedComposition({
  subject,
  secondary,
  secondaryCaption,
  accent,
  reduce,
  size,
}: {
  subject: SocialPlayer | undefined;
  secondary: SocialPlayer;
  secondaryCaption: string;
  accent: string;
  reduce: boolean;
  size: number;
}) {
  const subjectName = (subject?.personaName || '').split(' ')[0] || '\u2014';
  const secondaryName = (secondary.personaName || '').split(' ')[0] || '\u2014';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        marginTop: 6,
        width: '100%',
      }}
    >
      {/* Fallen (the subject) — desaturated, with subtle pink veil */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: -14, scale: 0.94 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          flex: 1,
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: '50%',
            padding: 2.5,
            background: `conic-gradient(from 180deg, color-mix(in oklch, ${accent} 70%, transparent), color-mix(in oklch, ${accent} 20%, transparent) 50%, color-mix(in oklch, ${accent} 70%, transparent))`,
            boxShadow: `0 0 22px color-mix(in oklch, ${accent} 35%, transparent)`,
          }}
        >
          <PortraitInner subjectPlayer={subject} size={size} filter="grayscale(32%) saturate(0.85)" />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 2.5,
              borderRadius: '50%',
              background:
                'radial-gradient(60% 60% at 50% 50%, transparent 0%, color-mix(in oklch, var(--po-pink) 20%, transparent) 100%)',
              mixBlendMode: 'multiply',
              pointerEvents: 'none',
            }}
          />
        </div>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.18em',
            color: accent,
            textTransform: 'uppercase',
          }}
        >
          The fallen
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--po-text)',
          }}
        >
          {subjectName}
        </span>
      </motion.div>

      {/* Connector — diagonal slash line drawn between the two portraits */}
      <motion.div
        aria-hidden="true"
        initial={reduce ? { opacity: 0 } : { opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.5, delay: 0.5, ease: 'easeOut' }}
        style={{
          width: 28,
          height: 2,
          background: `linear-gradient(90deg, color-mix(in oklch, ${accent} 70%, transparent), ${accent}, color-mix(in oklch, ${accent} 70%, transparent))`,
          borderRadius: 1,
          transform: 'rotate(-18deg)',
          transformOrigin: 'center',
          boxShadow: `0 0 12px color-mix(in oklch, ${accent} 50%, transparent)`,
          alignSelf: 'center',
          marginTop: -18,
        }}
      />

      {/* Executioner — full-color, foregrounded */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14, scale: 0.94 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.25, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          flex: 1,
        }}
      >
        <div
          style={{
            borderRadius: '50%',
            padding: 2.5,
            background: `conic-gradient(from 180deg, ${accent}, color-mix(in oklch, ${accent} 45%, transparent) 40%, color-mix(in oklch, ${accent} 18%, transparent) 60%, ${accent})`,
            boxShadow: `0 0 28px color-mix(in oklch, ${accent} 55%, transparent), 0 0 60px color-mix(in oklch, ${accent} 20%, transparent)`,
          }}
        >
          <PortraitInner subjectPlayer={secondary} size={size} />
        </div>
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.18em',
            color: accent,
            textTransform: 'uppercase',
          }}
        >
          {secondaryCaption}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-body)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--po-text)',
          }}
        >
          {secondaryName}
        </span>
      </motion.div>
    </div>
  );
}
