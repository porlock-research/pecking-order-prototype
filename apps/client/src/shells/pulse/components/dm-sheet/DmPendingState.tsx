import { usePulse } from '../../PulseShell';

interface Props { channelId: string; inviterName: string; onClose: () => void; }

export function DmPendingState({ channelId, inviterName, onClose }: Props) {
  const { engine } = usePulse();
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 24, gap: 16,
    }}>
      <div style={{
        background: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)',
        borderRadius: 14, padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>
          {inviterName} sent you a message
        </div>
      </div>
      <button
        onClick={() => engine.acceptDm(channelId)}
        style={{
          width: '100%', background: 'var(--pulse-accent)', color: 'var(--pulse-on-accent)', border: 'none',
          padding: '12px 16px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer',
        }}
      >Accept</button>
      <button
        onClick={() => { engine.declineDm(channelId); onClose(); }}
        style={{
          width: '100%', background: 'transparent', color: 'var(--pulse-text-3)', border: 'none',
          padding: '4px', fontSize: 13, cursor: 'pointer',
        }}
      >Decline</button>
    </div>
  );
}
