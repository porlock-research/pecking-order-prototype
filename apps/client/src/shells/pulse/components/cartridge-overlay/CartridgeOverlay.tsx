import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useGameStore } from '../../../../store/useGameStore';
import { usePillStates, type PillState } from '../../hooks/usePillStates';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { usePulse } from '../../PulseShell';
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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={PULSE_SPRING.exit}
        onClick={unfocus}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)',
          zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        initial={isPush ? { opacity: 0 } : { scale: 0.92, opacity: 0 }}
        animate={isPush ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        exit={{ opacity: 0, scale: 0.96, transition: PULSE_SPRING.exit }}
        transition={isPush ? { duration: 0.1 } : PULSE_SPRING.snappy}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border)',
          boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column',
          zIndex: PULSE_Z.drawer, overflow: 'hidden',
          transformOrigin,
        }}
      >
        <CartridgeOverlayHeader
          kind={kind}
          label={match.label}
          deadline={resolveDeadline(match)}
          onClose={unfocus}
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
  if (pill.lifecycle !== 'upcoming' || typeof pill.timeRemaining !== 'number') return null;
  return Date.now() + pill.timeRemaining * 1000;
}
