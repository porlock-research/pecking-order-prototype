interface Props { targetName: string; }

export function DmWaitingBanner({ targetName }: Props) {
  return (
    <div style={{
      background: 'rgba(255,140,66,0.12)', color: 'var(--pulse-pending)',
      borderTop: '1px solid rgba(255,140,66,0.3)',
      borderBottom: '1px solid rgba(255,140,66,0.3)',
      padding: '10px 14px', fontSize: 12, fontWeight: 600,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>Waiting for {targetName} to accept…</span>
    </div>
  );
}
