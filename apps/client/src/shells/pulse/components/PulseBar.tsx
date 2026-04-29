import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useGameStore, selectCartridgeUnread } from '../../../store/useGameStore';
import { usePillStates, useDayPhase, type PillState, type CartridgeKind } from '../hooks/usePillStates';

const CARTRIDGE_KINDS: CartridgeKind[] = ['voting', 'game', 'prompt', 'dilemma'];
const isCartridgePill = (p: PillState): p is PillState & { kind: CartridgeKind } =>
  (CARTRIDGE_KINDS as PillState['kind'][]).includes(p.kind);
import { useHasOverflow } from '../hooks/useHasOverflow';
import { PULSE_Z } from '../zIndex';
import { runViewTransition, supportsViewTransitions, prefersReducedMotion } from '../viewTransitions';
import { usePillOrigin } from './cartridge-overlay/usePillOrigin';
import { Pill } from './Pill';
import { NowLine } from './NowLine';
import { EdgePin } from './EdgePin';

/**
 * PulseBar shows cartridge pills in chronological order.
 * When no cartridges are active, the bar renders nothing —
 * CastStrip owns presence now (Phase 1.5).
 *
 * View Transitions: each pill carries `data-pill-cartridge-id` and the
 * open/close tap path drives an `active-pill` morph into CartridgeOverlay.
 * Passive reorders (e.g., a pill flipping to `completed` lifecycle when
 * SYNC lands) don't morph — that would require wrapping the Zustand
 * commit site in `runViewTransition` and giving each pill a stable
 * `view-transition-name: pill-${cartridgeId}` during reorder only.
 * Deferred: no single commit site to wrap, and per-pill stable names
 * collide with the transient `active-pill` tag used for tap-to-open.
 */
export function PulseBar() {
  const allPills = usePillStates();
  const phase = useDayPhase();
  // Pregame: only the boundary anchor renders. Cartridge / social-window
  // pills stay in the data layer (so CartridgeOverlay's id lookup still
  // resolves a deep-linked cartridge during pregame), but they don't show
  // in the row — consistent with the dynamic-day reality where the
  // manifest may not be built yet.
  const pills = phase === 'pregame' ? allPills.filter((p) => p.kind === 'boundary') : allPills;
  const focusCartridge = useGameStore(s => s.focusCartridge);
  const markCartridgeSeen = useGameStore(s => s.markCartridgeSeen);
  const dayIndex = useGameStore(s => s.dayIndex);
  // Subscribe to lastSeenCartridge so the unread dot re-evaluates when the
  // cartridge is marked seen. Other fields read by selectCartridgeUnread
  // (activeVoting/Game/Prompt/Dilemma, completedCartridges) are already
  // subscribed to via usePillStates above, so this single extra subscription
  // covers the full set of inputs.
  useGameStore(s => s.lastSeenCartridge);
  const { set: setPillOrigin } = usePillOrigin();
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Mirror scrollRef into state so EdgePin re-renders when the row mounts
  // (refs aren't reactive — passing scrollRef.current as a prop on the first
  // render passes null and never updates).
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const overflow = useHasOverflow(scrollRef);

  if (pills.length === 0) return null;

  const handleTap = (pill: PillState) => {
    // Social windows (DMs, group chat) and boundary pills don't open the
    // cartridge overlay. Wiring for tap-to-open-DM-panel / tap-to-show-day-
    // shape-detail is a follow-up; for now, no-op on non-cartridge taps so
    // the row still receives the click without crashing focusCartridge's
    // CartridgeKind contract.
    if (!isCartridgePill(pill)) {
      // TODO(pulse-day-shape): wire DM/group-chat pill taps → DM panel /
      // group-chat opener; boundary tap → day-shape detail sheet.
      return;
    }

    const el = pillRefs.current[pill.id];
    const cartridgeId = pillToCartridgeId(pill, dayIndex);
    const vtActive = supportsViewTransitions() && !prefersReducedMotion();

    if (el) {
      // Keep the origin-rect fallback for non-VT browsers so the overlay
      // still scales from the tapped pill's position there.
      if (!vtActive) setPillOrigin(el.getBoundingClientRect());
      // Tag source for the VT morph — cleared inside the callback so the
      // "new" snapshot has the name only on the overlay panel (duplicate
      // names abort the transition).
      if (vtActive) el.style.viewTransitionName = 'active-pill';
    }
    markCartridgeSeen(cartridgeId);

    runViewTransition(() => {
      if (el) el.style.viewTransitionName = '';
      flushSync(() => focusCartridge(cartridgeId, pill.kind, 'manual'));
    });
  };

  // Wrap the scroller in a relative positioned container so edge fades can
  // overlay without being clipped by overflow-x. The fades are pointer-events:
  // none so they never intercept taps on the pills underneath.
  return (
    <div
      style={{
        position: 'relative',
        zIndex: PULSE_Z.flow,
        borderBottom: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
      }}
    >
      {phase !== 'pregame' && <NowLine pills={pills} />}
      <div style={{ position: 'relative' }}>
        <div
          ref={(el) => {
            scrollRef.current = el;
            setScrollEl(el);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            height: 64,
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
          }}
        >
          {pills.map(pill => {
            const cartridgeId = pillToCartridgeId(pill, dayIndex);
            const unread = selectCartridgeUnread(useGameStore.getState(), cartridgeId);
            return (
              <Pill
                key={pill.id}
                pill={pill}
                cartridgeId={cartridgeId}
                unread={unread}
                onTap={() => handleTap(pill)}
                buttonRef={(el) => { pillRefs.current[pill.id] = el; }}
              />
            );
          })}
        </div>
        <EdgePin
          scrollContainer={scrollEl}
          pills={pills}
          pillNodes={pillRefs.current}
        />
      </div>
      <EdgeFade side="left" visible={overflow.left} bg="var(--pulse-surface)" />
      <EdgeFade side="right" visible={overflow.right} bg="var(--pulse-surface)" />
    </div>
  );
}

function EdgeFade({ side, visible, bg }: { side: 'left' | 'right'; visible: boolean; bg: string }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 28,
        pointerEvents: 'none',
        background: `linear-gradient(to ${side}, transparent, ${bg})`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }}
    />
  );
}

/**
 * Build the stable cartridgeId matching the server scheme from Phase 4 §0.1:
 *   `${kind}-${dayIndex}-${typeKey}`
 *
 * typeKey resolution order per kind:
 *   voting   → cartridge.mechanism | cartridge.voteType
 *   game     → cartridge.gameType
 *   prompt   → cartridge.promptType
 *   dilemma  → cartridge.dilemmaType
 *
 * For upcoming/starting pills (no live cartridge data), typeKey falls back
 * to 'UNKNOWN'. The overlay handles that case — it can still render the info
 * splash using the pill's label.
 */
function pillToCartridgeId(pill: PillState, dayIndex: number): string {
  const c = pill.cartridgeData as Record<string, unknown> | undefined;
  const typeKey =
    (c?.mechanism as string) ||
    (c?.voteType as string) ||
    (c?.gameType as string) ||
    (c?.promptType as string) ||
    (c?.dilemmaType as string) ||
    'UNKNOWN';
  return `${pill.kind}-${dayIndex}-${typeKey}`;
}
