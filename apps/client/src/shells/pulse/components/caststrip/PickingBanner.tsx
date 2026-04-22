import { useGameStore, selectDmSlots } from '../../../../store/useGameStore';
import { PULSE_Z } from '../../zIndex';

export function PickingBanner() {
  const pickingMode = useGameStore(s => s.pickingMode);
  const used = useGameStore(s => selectDmSlots(s).used);
  const total = useGameStore(s => selectDmSlots(s).total);
  const remaining = Math.max(0, total - used);
  const cancelPicking = useGameStore(s => s.cancelPicking);

  if (!pickingMode) return null;

  const isAddMode = pickingMode.kind === 'add-member';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 14px',
      background: 'color-mix(in oklch, var(--pulse-accent) 12%, transparent)',
      borderBottom: '1px solid color-mix(in oklch, var(--pulse-accent) 25%, transparent)',
      color: 'var(--pulse-accent)', fontSize: 12, fontWeight: 600,
      position: 'relative', zIndex: PULSE_Z.flow,
    }}>
      <span>
        {isAddMode ? 'Add to conversation' : 'Pick 1 to chat · 2+ for a group'}
        {!isAddMode && (
          <span style={{ color: 'var(--pulse-text-3)', marginLeft: 6 }}>
            ({remaining} slots left today)
          </span>
        )}
      </span>
      <button onClick={cancelPicking} style={{
        background: 'transparent', color: 'var(--pulse-text-2)',
        border: '1px solid var(--pulse-border-2)', borderRadius: 'var(--pulse-radius-lg)',
        padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        minHeight: 36, minWidth: 80,
      }}>Cancel</button>
    </div>
  );
}
