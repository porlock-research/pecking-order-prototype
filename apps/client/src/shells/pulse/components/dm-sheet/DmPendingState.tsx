import { useMemo } from 'react';
import { usePulse } from '../../PulseShell';
import { useGameStore } from '../../../../store/useGameStore';
import { InviteActions } from '../common/InviteActions';

interface Props { channelId: string; inviterName: string; onClose: () => void; }

export function DmPendingState({ channelId, inviterName, onClose }: Props) {
  const { engine, playerId } = usePulse();
  const chatLog = useGameStore(s => s.chatLog);

  // Surface the first message in this channel from someone other than the
  // recipient. Consenting to a DM without seeing its content is asymmetric
  // (the sender already saw their words; the receiver was blind).
  const firstMessage = useMemo(() => {
    return chatLog.find(m => m.channelId === channelId && m.senderId !== playerId);
  }, [chatLog, channelId, playerId]);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 24, gap: 16,
    }}>
      <div style={{
        background: 'var(--pulse-surface)', border: '1px solid var(--pulse-border)',
        borderRadius: 'var(--pulse-radius-md)', padding: 20, textAlign: 'center',
      }}>
        <div style={{
          fontSize: 10,
          fontWeight: 800,
          color: 'var(--pulse-accent)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          marginBottom: 10,
        }}>
          {inviterName} sent you
        </div>
        {firstMessage ? (
          <div style={{
            fontSize: 15,
            color: 'var(--pulse-text-1)',
            lineHeight: 1.45,
            fontWeight: 500,
            fontFamily: 'var(--po-font-body)',
            wordBreak: 'break-word',
          }}>
            &ldquo;{firstMessage.content}&rdquo;
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--pulse-text-3)', fontStyle: 'italic' }}>
            A direct message
          </div>
        )}
      </div>
      <InviteActions
        layout="vertical"
        onAccept={() => engine.acceptDm(channelId)}
        onDecline={() => { engine.declineDm(channelId); onClose(); }}
      />
    </div>
  );
}
