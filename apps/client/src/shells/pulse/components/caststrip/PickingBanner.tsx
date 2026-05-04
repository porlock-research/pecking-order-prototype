import { useGameStore, selectDmSlots } from '../../../../store/useGameStore';
import { PULSE_Z } from '../../zIndex';

/**
 * Picking-mode strip below the header. Distinct from ConfessionPhaseBanner
 * (which IS a tap target — a `<motion.button>` that opens the booth) by
 * design: this banner is informational about a mode the player is already
 * in, with a discrete Cancel control. The actual interaction (picking
 * players) happens in the cast strip below.
 *
 * Visual differentiators that say "informational, not tappable":
 *   - `cursor: default` on the wrapper (no hover affordance)
 *   - leading info dot eyebrow (not a CTA glyph)
 *   - the prominent Cancel button on the right does the action
 *   - role="status" + aria-live so screen readers announce mode entry
 *     without competing with a tappable-button announcement
 */
export function PickingBanner() {
  const pickingMode = useGameStore(s => s.pickingMode);
  const used = useGameStore(s => selectDmSlots(s).used);
  const total = useGameStore(s => selectDmSlots(s).total);
  const remaining = Math.max(0, total - used);
  const cancelPicking = useGameStore(s => s.cancelPicking);

  if (!pickingMode) return null;

  const isAddMode = pickingMode.kind === 'add-member';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'color-mix(in oklch, var(--pulse-accent) 12%, transparent)',
        borderBottom: '1px solid color-mix(in oklch, var(--pulse-accent) 25%, transparent)',
        color: 'var(--pulse-accent)', fontSize: 12, fontWeight: 600,
        position: 'relative', zIndex: PULSE_Z.flow,
        cursor: 'default',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--pulse-accent)',
          }}
        />
        <span style={{ minWidth: 0 }}>
          {isAddMode ? 'Add to conversation' : 'Pick 1 to chat · 2+ for a group'}
          {!isAddMode && (
            <span style={{ color: 'var(--pulse-text-3)', marginLeft: 6 }}>
              ({remaining} slots left today)
            </span>
          )}
        </span>
      </span>
      <button onClick={cancelPicking} style={{
        background: 'transparent', color: 'var(--pulse-text-2)',
        border: '1px solid var(--pulse-border-2)', borderRadius: 'var(--pulse-radius-lg)',
        padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        minHeight: 36, minWidth: 80,
        flexShrink: 0,
      }}>Cancel</button>
    </div>
  );
}
