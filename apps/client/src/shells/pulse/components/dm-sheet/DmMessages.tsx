import { useEffect, useMemo, useRef } from 'react';
import type { ChatMessage } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';

interface Props {
  channelId: string;
  /** True when this channel is a group DM. Controls whether sender-name
      labels render above messages. In 1:1 the sender is obvious from
      bubble alignment, so the name is pure noise. */
  isGroup?: boolean;
}

export function DmMessages({ channelId, isGroup = false }: Props) {
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
      {messages.map((m, i) => {
        const sender = roster[m.senderId];
        const isSelf = m.senderId === playerId;
        const color = getPlayerColor(Object.keys(roster).indexOf(m.senderId));
        // In groups, only show the name on sender-change (matches the
        // MAIN chat showHeader grouping rule).
        const prev = i > 0 ? messages[i - 1] : null;
        const showGroupName = isGroup && !isSelf && (!prev || prev.senderId !== m.senderId);
        return (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSelf ? 'flex-end' : 'flex-start' }}>
            {showGroupName && (
              <div style={{ fontSize: 10, color: 'var(--pulse-text-3)', marginBottom: 2 }}>
                <span style={{ color, fontWeight: 700 }}>{sender?.personaName ?? m.senderId}</span>
              </div>
            )}
            <div style={{
              fontSize: 15, color: 'var(--pulse-text-1)', lineHeight: 1.45,
              background: isSelf ? 'rgba(255,59,111,0.10)' : 'transparent',
              border: isSelf ? '1px solid rgba(255,59,111,0.20)' : 'none',
              padding: isSelf ? '8px 12px' : 0,
              borderRadius: isSelf ? 14 : 0,
              maxWidth: '85%',
            }}>{m.content}</div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
