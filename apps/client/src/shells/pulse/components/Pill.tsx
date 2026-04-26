import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChartBar, GameController, ChatCircleDots, Scales, ChatCircle, UsersThree, Clock } from '../icons';
import { PULSE_SPRING, PULSE_TAP } from '../springs';
import { ACT_VERB, type PillState, type PillLifecycle, type PillKind, type CartridgeKind } from '../hooks/usePillStates';
import { useNowTick } from '../hooks/useNowTick';

const PILL_ICONS: Record<PillKind, typeof ChartBar> = {
  voting: ChartBar,
  game: GameController,
  prompt: ChatCircleDots,
  dilemma: Scales,
  dms: ChatCircle,
  group: UsersThree,
  boundary: Clock,
};

const PILL_COLORS: Record<PillKind, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
  dms: 'var(--pulse-social)',
  group: 'var(--pulse-social)',
  boundary: 'var(--pulse-gold)',
};

const CARTRIDGE_KINDS: CartridgeKind[] = ['voting', 'game', 'prompt', 'dilemma'];
const isCartridgeKind = (k: PillKind): k is CartridgeKind =>
  (CARTRIDGE_KINDS as PillKind[]).includes(k);

/**
 * Deterministic [0, 1500) ms offset from a stable string. Used as
 * animation-delay so two concurrent active pills don't peak at the same
 * frame. Stable across re-renders (same input → same delay), so the pulse
 * doesn't jitter as state ticks.
 */
function heartbeatDelay(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 1500;
}

interface PillProps {
  pill: PillState;
  mini?: boolean;
  onTap?: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  unread?: boolean;
  cartridgeId?: string;
}

/**
 * Pill — cartridge lifecycle indicator in the pill row.
 *
 * Visual model (per docs/reports/pulse-mockups/15-day-shape-pills.html v5):
 *
 *   upcoming     → solid 1px kind-color border at 40%, full opacity. The
 *                  future is already coloured-in; not greyed out / disabled.
 *   starting     → ignition one-shot then settles into the active styling.
 *   needs-action → "active" in the design model: cartridge open, you haven't
 *                  acted. Kind-color glow (24px @ 0.55) + breathing scale.
 *   in-progress  → "acted": cartridge open, you've contributed. Kind border
 *                  but NO glow, NO heartbeat. Verb microcopy (cast/placed/sent
 *                  /chosen) marks "you did the thing"; meta still shows the
 *                  countdown so you know when results land.
 *   urgent       → kind glow dropped entirely; accent-pink ring carries the
 *                  alarm alone (700ms shadow swing). Leading dot. Reads as a
 *                  doorbell, not a louder hum.
 *   completed    → unread = subtle kind-tint + pink dot affordance (no
 *                  ambient glow — locked decision). read = mini, dim,
 *                  icon-only.
 */
export function Pill({ pill, mini, onTap, buttonRef, unread, cartridgeId }: PillProps) {
  // Boundary hero variant: render a separate component below — fully different
  // shape (72px tall, two-line internal layout). Bail out early.
  if (pill.kind === 'boundary' && pill.hero) {
    return <BoundaryHeroPill pill={pill} buttonRef={buttonRef} onTap={onTap} />;
  }

  const Icon = PILL_ICONS[pill.kind] || ChatCircleDots;
  const kindColor = PILL_COLORS[pill.kind] || 'var(--pulse-accent)';
  const reduce = useReducedMotion();

  const isSocialWindow = !!pill.isSocialWindow;
  const isBoundary = pill.kind === 'boundary';
  const isCartridge = isCartridgeKind(pill.kind);

  const isUpcoming = pill.lifecycle === 'upcoming';
  const isActiveLifecycle = pill.lifecycle === 'needs-action' || pill.lifecycle === 'just-started' || pill.lifecycle === 'starting';
  // Cartridges get the active heartbeat + kind glow ("demand attention").
  // Social windows are long ambient open states — they should NOT pulse or
  // strobe; user feedback (Apr 26) confirmed pulsing DMs/group chats are
  // visually distracting since they can be open for hours.
  const isActive = isActiveLifecycle && isCartridge;
  const isActiveSocial = isActiveLifecycle && isSocialWindow;
  // Acted only applies to cartridges. Social windows don't have an acted state.
  const isActed = pill.lifecycle === 'in-progress' && isCartridge;
  // Urgent only fires for cartridges (social windows / boundary skip it).
  const isUrgent = pill.lifecycle === 'urgent' && isCartridge;
  const isCompleted = pill.lifecycle === 'completed';
  // Pink unread dot: any cartridge pill flagged unread (the seen/unseen
  // contract, not strictly "completed"). Social windows skip it — they have
  // no result, so there's nothing to call the player back to read.
  const showUnreadDot = !!unread && isCartridge;
  const isReadCompleted = isCompleted && !unread;

  // Read-completed pills auto-mini (icon only) so the row stays scannable
  // across a 7-hour day. The `mini` prop is still respected as an explicit
  // override.
  const renderMini = mini ?? isReadCompleted;

  // Per-state styling. We keep the "what does this state look like" logic
  // close to the rendering so it's easy to scan against the design mockup.
  const stateStyle = computeStateStyle({
    lifecycle: pill.lifecycle,
    kindColor,
    isUnreadCompleted: showUnreadDot,
    isReadCompleted,
    isBoundary,
    isActiveSocial,
  });

  // Ignition (one-shot) when transitioning upcoming/starting → any active
  // lifecycle. Landing (one-shot) when any active → completed.
  const prevLifecycle = useRef<PillLifecycle>(pill.lifecycle);
  const [igniting, setIgniting] = useState(false);
  const [landing, setLanding] = useState(false);
  useEffect(() => {
    const prev = prevLifecycle.current;
    prevLifecycle.current = pill.lifecycle;
    const wasPreActive = prev === 'upcoming' || prev === 'starting';
    const isNowActive =
      pill.lifecycle === 'just-started' ||
      pill.lifecycle === 'needs-action' ||
      pill.lifecycle === 'in-progress' ||
      pill.lifecycle === 'urgent';
    if (wasPreActive && isNowActive) {
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

  // Animation class precedence: ignition > landing > urgent shadow swing >
  // boundary imminence. Completed-unread no longer carries an ambient glow —
  // the pink dot does the "look at me" job (locked design decision).
  // Boundary imminence (gold + pink layered shadow swing) is its own keyframe
  // so the gold identity stays load-bearing — boundary is not a cartridge
  // alarm, but it should feel "the day's ending soon" louder than calm.
  const isBoundaryImminent = isBoundary && pill.lifecycle === 'urgent';
  const animationClass = igniting
    ? 'pulse-pill-ignition'
    : landing
      ? 'pulse-pill-landing'
      : isUrgent
        ? 'pulse-pill-urgent'
        : isBoundaryImminent
          ? 'pulse-pill-boundary-imminent'
          : undefined;

  // Verb microcopy for the acted state. ACT_VERB is keyed by cartridge kind
  // only — social windows don't have an acted phase.
  const actVerb = isActed && isCartridgeKind(pill.kind) ? ACT_VERB[pill.kind] : null;

  return (
    <motion.button
      ref={buttonRef}
      className={animationClass}
      data-pill-cartridge-id={cartridgeId}
      data-pill-lifecycle={pill.lifecycle}
      aria-label={renderMini ? pill.label : undefined}
      whileTap={PULSE_TAP.pill}
      whileHover={reduce ? undefined : { y: -2 }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: stateStyle.opacity ?? 1, scale: 1 }}
      transition={PULSE_SPRING.snappy}
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: renderMini ? 4 : 6,
        padding: renderMini ? '4px 8px' : '6px 12px',
        borderRadius: 'var(--pulse-radius-xl)',
        cursor: 'pointer',
        fontSize: renderMini ? 10 : 11,
        fontWeight: 700,
        fontFamily: 'var(--po-font-body)',
        color: stateStyle.color,
        whiteSpace: 'nowrap',
        position: 'relative',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        background: stateStyle.background,
        border: stateStyle.border,
        boxShadow: stateStyle.boxShadow,
        opacity: stateStyle.opacity,
        // --pill-glow drives the landing burst keyframe (see pulse-theme.css)
        ...((landing) ? { ['--pill-glow' as string]: kindColor } : {}),
      }}
    >
      {/* Inner wrapper carries the active-state heartbeat via CSS keyframe.
          Putting it on a child element prevents conflict with the button's
          framer-motion hover (translateY) and tap transforms — CSS keyframe
          and inline transform on the same element overwrite each other.
          A deterministic delay (hashed from cartridgeId) staggers concurrent
          pulses so multiple actives don't strobe in lockstep. */}
      <span
        className={isActive ? 'pulse-pill-active-heartbeat' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: renderMini ? 4 : 6,
          color: 'inherit',
          ...(isActive ? { animationDelay: `${heartbeatDelay(cartridgeId || pill.id)}ms` } : {}),
        }}
      >
      {/* Leading dot for urgent — the "doorbell" before the label. */}
      {isUrgent && !renderMini && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--pulse-accent)',
            boxShadow: '0 0 8px var(--pulse-accent)',
            flexShrink: 0,
          }}
        />
      )}

      <span style={{ display: 'inline-flex', flexShrink: 0 }}>
        <Icon size={renderMini ? 14 : 16} weight="fill" />
      </span>

      {!renderMini && (
        <span style={{ color: 'inherit' }}>
          {/* Voting label override in urgent state. Other kinds keep their label. */}
          {isUrgent && pill.kind === 'voting' ? 'Vote now' : pill.label}
        </span>
      )}

      {/* Acted-state verb microcopy: "you did the thing" without a ✓ icon.
          Renders BEFORE the meta countdown so it reads "Wager · placed · 5m left". */}
      {actVerb && !renderMini && (
        <span
          style={{
            color: kindColor,
            fontSize: 10,
            fontWeight: 700,
            fontStyle: 'italic',
            letterSpacing: 0.2,
            textTransform: 'lowercase',
          }}
        >
          · {actVerb}
        </span>
      )}

      {/* Meta — pre-formatted by usePillStates, ticks live. e.g. "16:00",
          "5m 00s left", "open · ends 12:00", "result". */}
      {pill.meta && !renderMini && (
        <span
          style={{
            color: 'inherit',
            opacity: isActive || isUrgent ? 0.85 : 0.7,
            fontWeight: 500,
            fontSize: 10,
            letterSpacing: 0.2,
            textTransform: 'lowercase',
          }}
        >
          · {pill.meta}
        </span>
      )}

      {pill.progress && !renderMini && (
        <span style={{ color: 'var(--pulse-text-2)', fontSize: 10 }}>{pill.progress}</span>
      )}
      </span>{/* /heartbeat wrapper */}

      {/* Unread dot lives OUTSIDE the heartbeat wrapper so its position is
          anchored to the button (relative parent), not the breathing inner
          span. */}
      {showUnreadDot && cartridgeId && (
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

/**
 * Compute background / border / box-shadow / color / opacity for a given
 * lifecycle. Keeps the per-state visual contract co-located so it's
 * straightforward to compare against the design mockup.
 */
function computeStateStyle(opts: {
  lifecycle: PillLifecycle;
  kindColor: string;
  isUnreadCompleted: boolean;
  isReadCompleted: boolean;
  isBoundary?: boolean;
  isActiveSocial?: boolean;
}): {
  background: string;
  border: string;
  boxShadow: string | undefined;
  color: string;
  opacity: number;
} {
  const { lifecycle, kindColor, isUnreadCompleted, isReadCompleted, isBoundary, isActiveSocial } = opts;

  // Active social windows: kind tint + border, no outer glow. Calm "open"
  // ambient state. The heartbeat class is also gated on isCartridge in the
  // Pill render, so social windows don't breathe.
  if (isActiveSocial) {
    return {
      background: `color-mix(in oklch, ${kindColor} 16%, var(--pulse-surface-2))`,
      border: `1px solid color-mix(in oklch, ${kindColor} 50%, var(--pulse-border))`,
      boxShadow: undefined,
      color: kindColor,
      opacity: 1,
    };
  }

  // Boundary mini variant (during day) — gold gradient, gold border, label
  // + meta. Hero variant has its own component (BoundaryHeroPill).
  if (isBoundary) {
    // Imminent escalation: when usePillStates flips the boundary's lifecycle
    // to 'urgent' (< 5 min to day end), layer an accent-pink ring on top of
    // the gold base. Gold reads "warm anchor"; pink reads "act now" — together
    // they communicate "the day's ending and you should pay attention" without
    // dropping gold identity (still a boundary, not a cartridge alarm).
    const isImminent = lifecycle === 'urgent';
    return {
      background: isImminent
        ? 'linear-gradient(180deg, color-mix(in oklch, var(--pulse-gold) 22%, transparent), color-mix(in oklch, var(--pulse-accent) 8%, transparent))'
        : 'linear-gradient(180deg, color-mix(in oklch, var(--pulse-gold) 10%, transparent), transparent)',
      border: isImminent ? `1.5px solid var(--pulse-gold)` : `1.5px solid var(--pulse-gold-soft)`,
      boxShadow: isImminent
        ? '0 0 22px color-mix(in oklch, var(--pulse-gold) 60%, transparent), 0 0 14px color-mix(in oklch, var(--pulse-accent) 40%, transparent)'
        : undefined,
      color: 'var(--pulse-gold)',
      opacity: 1,
    };
  }

  switch (lifecycle) {
    case 'upcoming':
      // Solid kind-color border at ~40% — "the future is already coloured-in".
      // Full opacity, calm. No animation.
      return {
        background: 'transparent',
        border: `1px solid color-mix(in oklch, ${kindColor} 40%, var(--pulse-border-2))`,
        boxShadow: undefined,
        color: 'var(--pulse-text-2)',
        opacity: 1,
      };

    case 'starting':
    case 'just-started':
    case 'needs-action':
      // "Active" in design terms: kind-color glow + heartbeat.
      return {
        background: `color-mix(in oklch, ${kindColor} 32%, var(--pulse-surface-2))`,
        border: `1.5px solid ${kindColor}`,
        boxShadow: `0 0 24px color-mix(in oklch, ${kindColor} 55%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--pulse-text-1) 4%, transparent)`,
        color: kindColor,
        opacity: 1,
      };

    case 'in-progress':
      // "Acted": kind border, NO glow, NO heartbeat. Calm with confirmation
      // (the verb microcopy carries the meaning).
      return {
        background: `color-mix(in oklch, ${kindColor} 12%, var(--pulse-surface-2))`,
        border: `1px solid color-mix(in oklch, ${kindColor} 55%, var(--pulse-border))`,
        boxShadow: undefined,
        color: kindColor,
        opacity: 1,
      };

    case 'urgent':
      // Kind glow DROPPED. Accent-pink ring carries the alarm alone.
      // The keyframe (pulse-pill-urgent) drives the box-shadow swing.
      return {
        background: `color-mix(in oklch, var(--pulse-accent) 12%, var(--pulse-surface-2))`,
        border: `1.5px solid var(--pulse-accent)`,
        boxShadow: undefined, // owned by the keyframe
        color: 'var(--pulse-accent)',
        opacity: 1,
      };

    case 'completed': {
      if (isUnreadCompleted) {
        // Subtle kind-tint, no ambient glow. The pink unread dot does the
        // notification job (locked decision).
        return {
          background: `color-mix(in oklch, ${kindColor} 14%, var(--pulse-surface-2))`,
          border: `1px solid color-mix(in oklch, ${kindColor} 38%, var(--pulse-border))`,
          boxShadow: undefined,
          color: kindColor,
          opacity: 1,
        };
      }
      // Read: settles. Mini-mode shrinks the row footprint elsewhere.
      return {
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-border)',
        boxShadow: undefined,
        color: 'var(--pulse-text-3)',
        opacity: isReadCompleted ? 0.55 : 1,
      };
    }
  }
}

/**
 * BoundaryHeroPill — pregame / night anchor. Taller (56px) than a normal pill,
 * two-line internal layout: small-caps eyebrow over big body number, with an
 * optional relative countdown ("in 5m 30s") next to the body. Gold-rich
 * background with breathing glow when imminent (< 5 min to start).
 *
 * The hero variant is its own component because it diverges from the
 * standard pill geometry — co-locating the styling with the regular Pill
 * branch would balloon that function.
 */
function BoundaryHeroPill({
  pill,
  buttonRef,
  onTap,
}: {
  pill: PillState;
  buttonRef?: (el: HTMLButtonElement | null) => void;
  onTap?: () => void;
}) {
  const reduce = useReducedMotion();
  const tickNow = useNowTick(1000);
  if (!pill.hero) return null;

  // Imminent: < 5 min to start (start of next phase). Live-tick re-renders
  // pull this calc forward each second.
  const imminentMs = 5 * 60 * 1000;
  const remainingMs = pill.startTime !== undefined ? pill.startTime - tickNow : Infinity;
  const isImminent = remainingMs > 0 && remainingMs < imminentMs;

  return (
    <motion.button
      ref={buttonRef}
      onClick={onTap}
      data-pill-cartridge-id={pill.id}
      data-pill-lifecycle={pill.lifecycle}
      data-pill-hero="true"
      whileTap={PULSE_TAP.pill}
      whileHover={reduce ? undefined : { y: -2 }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={
        isImminent && !reduce
          ? {
              opacity: 1,
              scale: 1,
              boxShadow: [
                '0 0 32px color-mix(in oklch, var(--pulse-gold) 30%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--pulse-gold) 18%, transparent)',
                '0 0 56px color-mix(in oklch, var(--pulse-gold) 65%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--pulse-gold) 32%, transparent)',
                '0 0 32px color-mix(in oklch, var(--pulse-gold) 30%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--pulse-gold) 18%, transparent)',
              ],
            }
          : { opacity: 1, scale: 1 }
      }
      transition={
        isImminent && !reduce
          ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
          : PULSE_SPRING.snappy
      }
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        height: 56,
        padding: '0 22px',
        borderRadius: 'var(--pulse-radius-xl)',
        cursor: 'pointer',
        background:
          'radial-gradient(ellipse at top, color-mix(in oklch, var(--pulse-gold) 18%, transparent), color-mix(in oklch, var(--pulse-gold) 4%, transparent) 70%), var(--pulse-surface-2)',
        border: `1.5px solid var(--pulse-gold)`,
        boxShadow: isImminent
          ? undefined
          : '0 0 32px color-mix(in oklch, var(--pulse-gold) 30%, transparent), inset 0 0 0 1px color-mix(in oklch, var(--pulse-gold) 18%, transparent)',
        color: 'var(--pulse-gold)',
        flexShrink: 0,
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0, filter: 'drop-shadow(0 0 8px color-mix(in oklch, var(--pulse-gold) 55%, transparent))' }}>
        <Clock size={22} weight="fill" />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0, lineHeight: 1 }}>
        <span
          style={{
            fontFamily: 'var(--po-font-display, var(--po-font-body))',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.28 * 10,
            textTransform: 'uppercase',
            color: 'color-mix(in oklch, var(--pulse-gold) 72%, transparent)',
            marginBottom: 5,
          }}
        >
          {pill.hero.eyebrow}
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-display, var(--po-font-body))',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: -0.02 * 22,
            color: 'var(--pulse-gold)',
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          {pill.hero.body}
          {pill.hero.rel && (
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.4, color: 'color-mix(in oklch, var(--pulse-gold) 72%, transparent)' }}>
              in {pill.hero.rel}
            </span>
          )}
        </span>
      </span>
    </motion.button>
  );
}
