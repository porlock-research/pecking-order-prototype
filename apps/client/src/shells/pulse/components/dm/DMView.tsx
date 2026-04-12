import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Coins, Hand, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { StatusRing } from '../StatusRing';
import { MessageCard } from '../chat/MessageCard';
import { PULSE_TAP } from '../../springs';

interface DMViewProps {
  channelId: string | null;
  targetId: string;
  onBack: () => void;
}

export function DMView({ channelId, targetId, onBack }: DMViewProps) {
  const roster = useGameStore(s => s.roster);
  const chatLog = useGameStore(s => s.chatLog);
  const { engine, playerId } = usePulse();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);

  const target = roster[targetId];
  const playerIndex = Object.keys(roster).indexOf(targetId);
  const color = getPlayerColor(playerIndex);

  const dmMessages = channelId ? chatLog.filter(m => m.channelId === channelId) : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dmMessages.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    if (channelId) {
      engine.sendToChannel(channelId, text.trim());
    } else {
      engine.sendFirstMessage([targetId], text.trim());
    }
    setText('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--pulse-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-text-2)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </button>
        <StatusRing playerId={targetId} size={44}>
          <img src={target?.avatarUrl} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
        </StatusRing>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color, fontFamily: 'var(--po-font-body)' }}>{target?.personaName}</div>
        </div>
        <button onClick={() => engine.sendSilver(5, targetId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-gold)' }}>
          <Coins size={20} />
        </button>
        <button onClick={() => engine.sendNudge(targetId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-nudge)' }}>
          <Hand size={20} />
        </button>
      </div>

      {/* Privacy */}
      <div style={{ textAlign: 'center', padding: '4px 0', fontSize: 10, color: 'var(--pulse-text-3)' }}>
        {'🔒 Private conversation'}
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
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Message..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)', color: 'var(--pulse-text-1)', fontSize: 14, fontFamily: 'var(--po-font-body)', outline: 'none' }}
        />
        <motion.button whileTap={PULSE_TAP.button} onClick={handleSend} disabled={!text.trim()}
          style={{ width: 38, height: 38, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: text.trim() ? 'var(--pulse-accent)' : 'var(--pulse-surface-2)', border: 'none', cursor: text.trim() ? 'pointer' : 'default', color: '#fff' }}>
          <Send size={16} />
        </motion.button>
      </div>
    </div>
  );
}
