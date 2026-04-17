import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChartBar, GameController, ChatCircleDots, Scales } from '../icons';
import { PULSE_SPRING, PULSE_TAP } from '../springs';
import type { PillState, PillLifecycle } from '../hooks/usePillStates';

const PILL_ICONS: Record<string, typeof ChartBar> = {
  voting: ChartBar,
  game: GameController,
  prompt: ChatCircleDots,
  dilemma: Scales,
};

const PILL_COLORS: Record<string, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

function lifecycleStyles(lifecycle: PillLifecycle) {
  switch (lifecycle) {
    case 'upcoming':
      return {
        background: 'var(--pulse-surface-2)',
        border: '1px dashed var(--pulse-text-4)',
        // Breathing opacity — "coming, don't forget me" instead of "disabled".
        animation: 'pulse-pill-upcoming 3s ease-in-out infinite',
      };
    case 'starting':
    case 'just-started':
      return {
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-accent)',
      };
    case 'needs-action':
      return {
        background: 'var(--pulse-accent-glow)',
        border: '1px solid var(--pulse-accent)',
      };
    case 'urgent':
      return {
        background: 'var(--pulse-accent-glow)',
        border: '1px solid var(--pulse-accent)',
        animation: 'pulse-pill-urgent 1s ease-in-out infinite',
      };
    case 'in-progress':
      return {
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-text-4)',
      };
    case 'completed':
      return {
        background: 'var(--pulse-surface)',
        border: '1px solid var(--pulse-border)',
        opacity: 0.6,
      };
  }
}

interface PillProps {
  pill: PillState;
  mini?: boolean;
  onTap?: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  unread?: boolean;
  cartridgeId?: string;
}

export function Pill({ pill, mini, onTap, buttonRef, unread, cartridgeId }: PillProps) {
  const Icon = PILL_ICONS[pill.kind] || ChatCircleDots;
  const kindColor = PILL_COLORS[pill.kind] || 'var(--pulse-accent)';
  const styles = lifecycleStyles(pill.lifecycle);
  const showDot = pill.lifecycle === 'just-started' || pill.lifecycle === 'starting';
  const showBadge = pill.lifecycle === 'needs-action' || pill.lifecycle === 'urgent';
  const isActive = pill.lifecycle !== 'completed' && pill.lifecycle !== 'upcoming';
  const isInProgress = pill.lifecycle === 'in-progress';
  const isCompleted = pill.lifecycle === 'completed';
  const isUnreadCompleted = isCompleted && !!unread;
  const reduce = useReducedMotion();

  // Pill ignition: one-shot animation when transitioning from a pre-active
  // lifecycle (upcoming/starting) into any active lifecycle (just-started,
  // needs-action, in-progress, urgent). Broadened from "only → just-started"
  // so voting/prompt/dilemma that land directly in needs-action also ignite.
  // Pill landing: one-shot animation when any active lifecycle → completed.
  const prevLifecycle = useRef(pill.lifecycle);
  const [igniting, setIgniting] = useState(false);
  const [landing, setLanding] = useState(false);
  useEffect(() => {
    const prev = prevLifecycle.current;
    prevLifecycle.current = pill.lifecycle;
    const wasPreActive = prev === 'upcoming' || prev === 'starting';
    const isNowActiveNonStarting =
      pill.lifecycle === 'just-started' ||
      pill.lifecycle === 'needs-action' ||
      pill.lifecycle === 'in-progress' ||
      pill.lifecycle === 'urgent';
    if (wasPreActive && isNowActiveNonStarting) {
      setIgniting(true);
      const t = setTimeout(() => setIgniting(false), 450);
      return () => clearTimeout(t);
    }
    if (prev !== 'completed' && pill.lifecycle === 'completed') {
      setLanding(true);
      const t = setTimeout(() => setLanding(false), 500);
      return () => clearTimeout(t);
    }
  }, [pill.lifecycle]);

  // Priority: ignition > landing > ambient unread glow. They are
  // mutually exclusive in time anyway (landing fires once into completed,
  // then the ambient glow takes over while unread).
  const animationClass = igniting
    ? 'pulse-pill-ignition'
    : landing
      ? 'pulse-pill-landing'
      : isUnreadCompleted
        ? 'pulse-pill-completed-unread'
        : undefined;

  // Completed pills always keep kind-color identity — they hold results
  // the user needs to be able to see and tap. The previous dim/gray
  // archive state (opacity 0.6, surface bg, text-2 color) read as
  // "disabled" even when unread. Two registers:
  //
  //   - Unread-completed ("results waiting"): strong kind-tinted bg,
  //     near-solid border, static glow, full opacity.
  //   - Read-completed ("viewable history"): subtle kind-tint, softer
  //     border, calmer opacity — but still kind-owned, never gray.
  //
  // Both override the lifecycleStyles('completed') defaults.
  const completedStyle: React.CSSProperties = isCompleted ? {
    background: isUnreadCompleted
      ? `color-mix(in oklch, ${kindColor} 28%, var(--pulse-surface))`
      : `color-mix(in oklch, ${kindColor} 8%, var(--pulse-surface))`,
    border: isUnreadCompleted
      ? `1.5px solid color-mix(in oklch, ${kindColor} 80%, transparent)`
      : `1px solid color-mix(in oklch, ${kindColor} 32%, transparent)`,
    opacity: isUnreadCompleted ? 1 : 0.85,
    ...(isUnreadCompleted ? {
      // Static baseline glow so the kind signal reads even if the
      // CSS ambient keyframe is fighting with framer-motion.
      boxShadow: `0 0 10px color-mix(in oklch, ${kindColor} 40%, transparent)`,
    } : {}),
  } : {};

  return (
    <motion.button
      ref={buttonRef}
      className={animationClass}
      data-pill-cartridge-id={cartridgeId}
      aria-label={mini ? pill.label : undefined}
      whileTap={PULSE_TAP.pill}
      // Pointer-device hover lift. framer-motion only fires whileHover on
      // pointer enter, so touch devices don't get a stuck-hover state on
      // tap. Box-shadow is owned by the kind-themed static style (for
      // unread-completed) or the CSS ambient keyframe — if hover animated
      // box-shadow too, framer-motion would take over the property and
      // kill whatever else was driving it.
      whileHover={reduce ? undefined : { y: -2 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: completedStyle.opacity ?? styles.opacity ?? 1, scale: 1 }}
      transition={PULSE_SPRING.snappy}
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: mini ? 4 : 6,
        padding: mini ? '4px 8px' : '6px 12px',
        borderRadius: 20,
        cursor: 'pointer',
        fontSize: mini ? 10 : 11,
        fontWeight: 700,
        fontFamily: 'var(--po-font-body)',
        // All completed pills (read or unread) keep kind color on text so
        // they read as "results for a voting/game/prompt" — never gray.
        color: isActive || isCompleted ? kindColor : 'var(--pulse-text-2)',
        whiteSpace: 'nowrap',
        position: 'relative',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        // --pill-glow drives both the landing burst and the ambient
        // completed-unread keyframe via var() in pulse-theme.css.
        ...((landing || isUnreadCompleted) ? { ['--pill-glow' as string]: kindColor } : {}),
        ...styles,
        ...(isActive ? {
          background: `${kindColor}14`,
          border: `1px solid ${kindColor}40`,
        } : {}),
        ...completedStyle,
      }}
    >
      <motion.span
        // In-progress heartbeat — subtle scale breath signals "something
        // is happening inside this cartridge right now". Only runs while
        // in-progress; other lifecycles keep the icon still.
        animate={isInProgress && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={isInProgress && !reduce ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }}
        style={{ display: 'inline-flex', flexShrink: 0 }}
      >
        <Icon size={mini ? 14 : 16} weight="fill" />
      </motion.span>
      {!mini && <span>{pill.label}</span>}
      {pill.progress && !mini && (
        <span style={{ color: 'var(--pulse-text-2)', fontSize: 10 }}>{pill.progress}</span>
      )}
      {showDot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: kindColor,
            boxShadow: `0 0 6px ${kindColor}`,
            animation: 'pulse-breathe 2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      )}
      {showBadge && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'var(--pulse-accent)',
            color: 'var(--pulse-on-accent)',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          !
        </span>
      )}
      {unread && cartridgeId && (
        <span
          data-testid={`pill-unread-${cartridgeId}`}
          style={{
            position: 'absolute',
            top: -3,
            left: -3,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--pulse-accent)',
            boxShadow: '0 0 6px var(--pulse-accent)',
            border: '1.5px solid var(--pulse-bg)',
          }}
        />
      )}
    </motion.button>
  );
}
