import { useGameStore, selectDmSlotsRemaining } from '../../../../store/useGameStore';

export function PickingBanner() {
  const { remaining } = useGameStore(selectDmSlotsRemaining);
  const cancelPicking = useGameStore(s => s.cancelPicking);
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
        Pick 1 to chat · 2+ for a group
        <span style={{ color: 'var(--pulse-text-3)', marginLeft: 6 }}>
          ({remaining} slots left today)
        </span>
      </span>
      <button onClick={cancelPicking} style={{
        background: 'transparent', color: 'var(--pulse-text-3)',
        border: '1px solid var(--pulse-border)', borderRadius: 14,
        padding: '3px 10px', fontSize: 11, cursor: 'pointer',
      }}>Cancel</button>
    </div>
  );
}
