import { useGameStore, selectDmSlots } from '../../../../store/useGameStore';

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
      background: 'rgba(255,59,111,0.12)',
      borderBottom: '1px solid rgba(255,59,111,0.25)',
      color: 'var(--pulse-accent)', fontSize: 12, fontWeight: 600,
      position: 'relative', zIndex: 3,
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
        background: 'transparent', color: 'var(--pulse-text-3)',
        border: '1px solid var(--pulse-border)', borderRadius: 14,
        padding: '3px 10px', fontSize: 11, cursor: 'pointer',
      }}>Cancel</button>
    </div>
  );
}
