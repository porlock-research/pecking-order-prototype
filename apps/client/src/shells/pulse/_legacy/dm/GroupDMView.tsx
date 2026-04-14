import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, PaperPlaneTilt } from '../../icons';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { MessageCard } from '../chat/MessageCard';
import { PULSE_TAP } from '../../springs';

interface GroupDMViewProps {
  channelId: string;
  memberIds: string[];
  onBack: () => void;
}

export function GroupDMView({ channelId, memberIds, onBack }: GroupDMViewProps) {
  const roster = useGameStore(s => s.roster);
  const chatLog = useGameStore(s => s.chatLog);
  const { engine, playerId } = usePulse();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);

  const dmMessages = chatLog.filter(m => m.channelId === channelId);
  const otherMembers = memberIds.filter(id => id !== playerId).slice(0, 3);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dmMessages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    engine.sendToChannel(channelId, text.trim());
    setText('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--pulse-bg)' }}>
      {/* Header with stacked avatars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-text-2)', display: 'flex' }}>
          <ArrowLeft size={22} weight="bold" />
        </button>
        {/* Overlapping portrait stack */}
        <div style={{ display: 'flex', position: 'relative', width: 24 + otherMembers.length * 18, height: 36 }}>
          {otherMembers.map((id, i) => (
            <img
              key={id}
              src={roster[id]?.avatarUrl}
              alt=""
              style={{
                position: 'absolute',
                left: i * 18,
                width: 36,
                height: 36,
                borderRadius: 10,
                objectFit: 'cover',
                border: '2px solid var(--pulse-surface)',
                zIndex: otherMembers.length - i,
              }}
            />
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--pulse-text-1)', fontFamily: 'var(--po-font-body)' }}>
            {otherMembers.map(id => roster[id]?.personaName).join(', ')}
          </div>
          <div style={{ fontSize: 10, color: 'var(--pulse-text-3)' }}>{memberIds.length} members</div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {dmMessages.map((msg, i) => {
          const prev = i > 0 ? dmMessages[i - 1] : null;
          const showHeader = !prev || prev.senderId !== msg.senderId || msg.timestamp - prev.timestamp > 120_000;
          return (
            <MessageCard
              key={msg.id}
              message={msg}
              showHeader={showHeader}
              isSelf={msg.senderId === playerId}
              openReactionId={openReactionId}
              onOpenReaction={setOpenReactionId}
            />
          );
        })}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Message..." style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)', color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'var(--po-font-body)', outline: 'none' }} />
        <motion.button whileTap={PULSE_TAP.button} onClick={handleSend} disabled={!text.trim()}
          style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: text.trim() ? 'var(--pulse-accent)' : 'var(--pulse-surface-2)', border: 'none', cursor: text.trim() ? 'pointer' : 'default', color: '#fff' }}>
          <PaperPlaneTilt size={16} weight="fill" />
        </motion.button>
      </div>
    </div>
  );
}
