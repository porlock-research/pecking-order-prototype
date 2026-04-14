import { useGameStore, selectTotalDmUnread, selectPendingInvitesForMe } from '../../../../store/useGameStore';

interface Props { onClick: () => void; }

export function PanelButton({ onClick }: Props) {
  const unread = useGameStore(selectTotalDmUnread);
  const invites = useGameStore(selectPendingInvitesForMe).length;
  const total = unread + invites;

  return (
    <button
      onClick={onClick}
      aria-label="Open social panel"
      style={{
        position: 'relative', width: 34, height: 34,
        borderRadius: 8, border: '1px solid var(--pulse-border)',
        background: 'var(--pulse-surface)', color: 'var(--pulse-text-1)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
        <rect x="2" y="4" width="14" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="8" width="14" height="2" rx="1" fill="currentColor" />
        <rect x="2" y="12" width="14" height="2" rx="1" fill="currentColor" />
      </svg>
      {total > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6,
          background: 'var(--pulse-accent)', color: '#fff',
          fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 8,
          minWidth: 16, textAlign: 'center', border: '2px solid var(--pulse-bg)',
        }}>{total > 9 ? '9+' : total}</span>
      )}
    </button>
  );
}
