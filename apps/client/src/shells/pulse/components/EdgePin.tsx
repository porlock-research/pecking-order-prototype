import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { PillState } from '../hooks/usePillStates';

/**
 * EdgePin — when the active/urgent pill is scrolled out of view in the pill
 * row, show a small accent-pink pin at the row's edge that recenters on tap.
 *
 * "Loud on purpose": the pin only appears when the player has navigated away
 * from the live pill, never during normal scroll-on-state-change. Calm by
 * default; the pink ring asks for attention only when the live signal would
 * otherwise be missed.
 */
interface EdgePinProps {
  scrollContainer: HTMLDivElement | null;
  pills: PillState[];
  pillNodes: Record<string, HTMLButtonElement | null>;
  /** Override Date.now() for tests (controls "live" pill detection). */
  now?: number;
}

export function EdgePin({ scrollContainer, pills, pillNodes, now }: EdgePinProps) {
  const [state, setState] = useState<{
    visible: boolean;
    side: 'left' | 'right';
    pillId: string | null;
    label: string;
  }>({ visible: false, side: 'right', pillId: null, label: '' });

  useEffect(() => {
    if (!scrollContainer) return;

    // Pick the most-urgent pill to track. Order: urgent > active needs-action
    // (cartridge) > acted. Social windows aren't pinned (they're long, calm,
    // and pinning them would noise up the row constantly).
    const target = findLiveCartridge(pills);

    const update = () => {
      if (!target) {
        setState((s) => (s.visible ? { ...s, visible: false } : s));
        return;
      }
      const node = pillNodes[target.id];
      if (!node) return;
      const wrapRect = scrollContainer.getBoundingClientRect();
      const pillRect = node.getBoundingClientRect();
      const visible = pillRect.right > wrapRect.left + 24 && pillRect.left < wrapRect.right - 24;

      if (visible) {
        setState((s) => (s.visible ? { ...s, visible: false } : s));
      } else {
        const side: 'left' | 'right' = pillRect.left < wrapRect.left ? 'left' : 'right';
        setState({ visible: true, side, pillId: target.id, label: target.label });
      }
    };

    update();
    scrollContainer.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Periodic refresh for live countdowns / pill state changes that don't
    // trigger scroll events (e.g., the row reorders on its own).
    const tickId = window.setInterval(update, 1000);
    return () => {
      scrollContainer.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.clearInterval(tickId);
    };
  }, [scrollContainer, pills, pillNodes, now]);

  if (!state.visible || !state.pillId) return null;

  const handleTap = () => {
    if (!scrollContainer || !state.pillId) return;
    const node = pillNodes[state.pillId];
    if (!node) return;
    const wrapRect = scrollContainer.getBoundingClientRect();
    const pillRect = node.getBoundingClientRect();
    const targetLeft =
      scrollContainer.scrollLeft + (pillRect.left - wrapRect.left) - scrollContainer.clientWidth / 2 + pillRect.width / 2;
    scrollContainer.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

  const arrow = state.side === 'left' ? '←' : '→';

  return (
    <motion.button
      data-testid="pulse-edge-pin"
      onClick={handleTap}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      style={{
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        [state.side]: 14,
        zIndex: 4,
        background: 'var(--pulse-surface-3)',
        border: '1.5px solid var(--pulse-accent)',
        color: 'var(--pulse-accent)',
        fontFamily: 'var(--po-font-display, var(--po-font-body))',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.06 * 12,
        padding: '8px 12px',
        borderRadius: 'var(--pulse-radius-xl, 100px)',
        cursor: 'pointer',
        boxShadow:
          '0 4px 18px color-mix(in oklch, var(--pulse-accent) 45%, transparent), 0 0 0 4px color-mix(in oklch, var(--pulse-accent) 10%, transparent)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        textTransform: 'uppercase',
      }}
    >
      <span aria-hidden="true">{state.side === 'left' ? arrow : ''}</span>
      <span>{state.label}</span>
      <span aria-hidden="true">{state.side === 'right' ? arrow : ''}</span>
    </motion.button>
  );
}

function findLiveCartridge(pills: PillState[]): PillState | null {
  const cartridge = (p: PillState) =>
    p.kind === 'voting' || p.kind === 'game' || p.kind === 'prompt' || p.kind === 'dilemma';
  return (
    pills.find((p) => cartridge(p) && p.lifecycle === 'urgent') ||
    pills.find((p) => cartridge(p) && p.lifecycle === 'needs-action') ||
    pills.find((p) => cartridge(p) && p.lifecycle === 'in-progress') ||
    null
  );
}
