import { motion } from 'framer-motion';
import { useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { toast } from 'sonner';
import { useGameStore } from '../../../../store/useGameStore';
import { usePillStates, type PillState } from '../../hooks/usePillStates';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { usePulse } from '../../PulseShell';
import { runViewTransition, supportsViewTransitions, prefersReducedMotion } from '../../viewTransitions';
import { usePillOrigin } from './usePillOrigin';
import { CartridgeOverlayHeader } from './CartridgeOverlayHeader';
import { CartridgeInfoSplash } from './CartridgeInfoSplash';
import { PlayableCartridgeMount } from './PlayableCartridgeMount';
import { CartridgeResultCard } from './CartridgeResultCard';

/**
 * Full-screen cartridge presentation surface for Pulse. Subscribes to
 * `focusedCartridge` and routes to the right inner view by lifecycle:
 *   upcoming / starting → CartridgeInfoSplash
 *   active (any phase) → PlayableCartridgeMount
 *   completed          → CartridgeResultCard
 *   truly missing      → toast + unfocus (no overlay rendered)
 *
 * Spec §3 routing constraint: completed cartridges never go through the
 * panel layer. See CartridgeResultCard for why.
 */
export function CartridgeOverlay() {
  const focused = useGameStore(s => s.focusedCartridge);
  const unfocus = useGameStore(s => s.unfocusCartridge);
  const pills = usePillStates();
  const { engine } = usePulse();
  const { consume } = usePillOrigin();

  // Resolve which pill represents the focused cartridge. Match priority:
  //   1. Exact cartridgeId match — required when a push intent for a prior
  //      day's cartridge arrives (e.g., voting-1-BUBBLE push landing on
  //      Day 2 where the active voting pill is voting-2-MAJORITY). Without
  //      this, the overlay would open the wrong cartridge's data under the
  //      original push intent's label.
  //   2. Kind fallback — when no id match is present (e.g., first-tap from
  //      a pill that was rendered before the server echoed cartridgeId).
  const match = useMemo<PillState | undefined>(() => {
    if (!focused) return undefined;
    const byId = pills.find(p => p.id === focused.cartridgeId);
    if (byId) return byId;
    return pills.find(p => p.kind === focused.cartridgeKind);
  }, [focused, pills]);

  // Compute origin rect ONCE per mount. consume() clears the stored rect.
  // useMemo with cartridgeId dep ensures we only consume on a new focus,
  // not on every re-render. AnimatePresence unmounts the component when
  // focused goes null, so the next focus gets a fresh consume.
  const originRect = useMemo(
    () => (focused ? consume() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focused?.cartridgeId],
  );

  // All hooks must run before any early return — handleClose captures
  // focused.cartridgeId via a nullable read so this hook is always called.
  const focusedCartridgeId = focused?.cartridgeId ?? null;

  // When View Transitions are available AND the user hasn't opted into
  // reduced motion, the open/close animation is driven by the browser's
  // `active-pill` morph — framer's scale/opacity would race with it.
  const vtActive = supportsViewTransitions() && !prefersReducedMotion();

  // Close wraps `unfocus` in the VT morph: the overlay panel currently
  // carries `view-transition-name: active-pill`; inside the callback we
  // unmount it (via flushSync) and move the name back onto the pill DOM
  // node so the browser's "new" snapshot morphs overlay → pill.
  const handleClose = useCallback(() => {
    if (!vtActive || !focusedCartridgeId) {
      unfocus();
      return;
    }
    const pillEl = document.querySelector<HTMLElement>(
      `[data-pill-cartridge-id="${focusedCartridgeId}"]`,
    );
    runViewTransition(() => {
      flushSync(unfocus);
      if (pillEl) pillEl.style.viewTransitionName = 'active-pill';
    }).finally(() => {
      if (pillEl) pillEl.style.viewTransitionName = '';
    });
  }, [vtActive, focusedCartridgeId, unfocus]);

  if (!focused) return null;

  // Missing-entirely path: no pill resolves this cartridge. Toast + unfocus.
  if (!match) {
    queueMicrotask(() => {
      toast.error('Activity unavailable');
      unfocus();
    });
    return null;
  }

  const { cartridgeKind: kind, origin } = focused;
  const isPush = origin === 'push';

  const transformOrigin = originRect && !isPush
    ? `${originRect.left + originRect.width / 2}px ${originRect.top + originRect.height / 2}px`
    : 'center';

  const lifecycle = match.lifecycle;
  const isUpcoming = lifecycle === 'upcoming' || lifecycle === 'starting';
  const isCompleted = lifecycle === 'completed';
  const schedEntry = upcomingScheduling(match);

  return (
    <>
      <motion.div
        initial={vtActive ? false : { opacity: 0 }}
        animate={vtActive ? undefined : { opacity: 1 }}
        exit={vtActive ? { opacity: 1, transition: { duration: 0 } } : { opacity: 0 }}
        transition={vtActive ? undefined : PULSE_SPRING.exit}
        onClick={handleClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)',
          zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        initial={vtActive ? false : (isPush ? { opacity: 0 } : { scale: 0.92, opacity: 0 })}
        animate={vtActive ? undefined : (isPush ? { opacity: 1 } : { scale: 1, opacity: 1 })}
        exit={vtActive ? { opacity: 1, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, transition: PULSE_SPRING.exit }}
        transition={vtActive ? undefined : (isPush ? { duration: 0.1 } : PULSE_SPRING.snappy)}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          zIndex: PULSE_Z.drawer, overflow: 'hidden',
          transformOrigin: vtActive ? undefined : transformOrigin,
          viewTransitionName: vtActive ? 'active-pill' : undefined,
        }}
      >
        <CartridgeOverlayHeader
          kind={kind}
          label={match.label}
          deadline={resolveDeadline(match)}
          onClose={handleClose}
        />

        {isUpcoming ? (
          <CartridgeInfoSplash
            kind={kind}
            typeKey={resolveTypeKey(match)}
            fallbackLabel={match.label}
            scheduledAt={schedEntry}
            isStarting={lifecycle === 'starting'}
          />
        ) : isCompleted ? (
          <CartridgeResultCard cartridgeId={focused.cartridgeId} kind={kind} />
        ) : (
          <PlayableCartridgeMount kind={kind} engine={engine} />
        )}
      </motion.div>
    </>
  );
}

function resolveTypeKey(pill: PillState): string {
  const c = pill.cartridgeData as Record<string, unknown> | undefined;
  return (
    (c?.mechanism as string) ||
    (c?.voteType as string) ||
    (c?.gameType as string) ||
    (c?.promptType as string) ||
    (c?.dilemmaType as string) ||
    'UNKNOWN'
  );
}

function resolveDeadline(pill: PillState): number | null {
  const c = pill.cartridgeData as Record<string, unknown> | undefined;
  if (!c) return null;
  if (typeof c.deadline === 'number') return c.deadline as number;
  if (typeof c.endsAt === 'number') return c.endsAt as number;
  if (typeof c.phaseEndsAt === 'number') return c.phaseEndsAt as number;
  return null;
}

function upcomingScheduling(pill: PillState): number | null {
  if (pill.lifecycle !== 'upcoming') return null;
  // Prefer the stable absolute startTime (set by usePillStates from the
  // manifest event's ISO timestamp). Without this, deriving the scheduled
  // moment as Date.now() + timeRemaining*1000 jitters: timeRemaining is a
  // stale integer-second from the last 1s tick, while Date.now() samples
  // fresh on every parent render — so scheduledAt drifts up between ticks
  // and the countdown can skip seconds or appear to increment.
  if (typeof pill.startTime === 'number') return pill.startTime;
  if (typeof pill.timeRemaining === 'number') return Date.now() + pill.timeRemaining * 1000;
  return null;
}
