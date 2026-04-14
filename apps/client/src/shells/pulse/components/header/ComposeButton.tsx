import { useGameStore, selectDmSlots } from '../../../../store/useGameStore';

interface Props { onClick: () => void; }

export function ComposeButton({ onClick }: Props) {
  const used = useGameStore(s => selectDmSlots(s).used);
  const total = useGameStore(s => selectDmSlots(s).total);
  const depleted = total - used <= 0;
  return (
    <button
      onClick={depleted ? undefined : onClick}
      aria-label="Compose"
      disabled={depleted}
      style={{
        position: 'relative', width: 34, height: 34,
        borderRadius: 8, border: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)',
        color: depleted ? 'var(--pulse-text-3)' : 'var(--pulse-text-1)',
        cursor: depleted ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: depleted ? 0.5 : 1,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M12.5 2.5 L13.5 3.5 L5 12 L3 13 L4 11 L12.5 2.5 Z"
          fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span style={{
        position: 'absolute', top: -6, right: -6,
        background: depleted ? 'var(--pulse-text-3)' : 'var(--pulse-accent)',
        color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 8,
        minWidth: 16, textAlign: 'center', border: '2px solid var(--pulse-bg)',
      }}>{used}/{total}</span>
    </button>
  );
}
