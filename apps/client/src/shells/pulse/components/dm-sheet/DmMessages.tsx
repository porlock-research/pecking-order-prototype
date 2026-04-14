import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';

interface Props { channelId: string; }

export function DmMessages({ channelId }: Props) {
  const chatLog = useGameStore(s => s.chatLog);
  const roster = useGameStore(s => s.roster);
  const playerId = useGameStore(s => s.playerId);
  const markChannelRead = useGameStore(s => s.markChannelRead);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = useMemo<ChatMessage[]>(
    () => chatLog.filter(m => m.channelId === channelId).sort((a, b) => a.timestamp - b.timestamp),
    [chatLog, channelId]
  );

  useEffect(() => {
    markChannelRead(channelId);
  }, [channelId, messages.length, markChannelRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  return (
    <div style={{
      flex: 1, overflowY: 'auto', padding: '12px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {messages.map(m => {
        const sender = roster[m.senderId];
        const isSelf = m.senderId === playerId;
        const color = getPlayerColor(Object.keys(roster).indexOf(m.senderId));
        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
            <div style={{ fontSize: 10, color: 'var(--pulse-text-3)', marginBottom: 2 }}>
              <span style={{ color }}>{sender?.personaName ?? m.senderId}</span>
            </div>
            <div style={{
              fontSize: 14, color: 'var(--pulse-text-1)',
              background: isSelf ? 'rgba(255,59,111,0.14)' : 'transparent',
              padding: isSelf ? '6px 10px' : 0,
              borderRadius: isSelf ? 10 : 0,
              maxWidth: '85%',
            }}>{m.content}</div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
