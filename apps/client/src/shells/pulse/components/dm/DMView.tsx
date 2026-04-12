import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Coins, HandWaving, PaperPlaneTilt } from '../../icons';
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
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const { engine, playerId, openSendSilver, openNudge } = usePulse();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);

  const target = roster[targetId];
  const playerIndex = Object.keys(roster).indexOf(targetId);
  const color = getPlayerColor(playerIndex);
  const isOnline = onlinePlayers.includes(targetId);

  // Filter: only messages in THIS specific DM channel (no whispers, no MAIN messages, no empty content)
  const dmMessages = channelId
    ? chatLog.filter(m => m.channelId === channelId && !m.whisperTarget && !m.redacted && m.content?.trim())
    : [];

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
      {/* Header with large persona portrait for immersion */}
      <div
        style={{
          position: 'relative',
          padding: '12px 16px 16px',
          background: `linear-gradient(180deg, ${color}18 0%, var(--pulse-surface) 100%)`,
          borderBottom: '1px solid var(--pulse-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--pulse-text-1)', display: 'flex', padding: 4 }}>
            <ArrowLeft size={22} weight="bold" />
          </button>
          <StatusRing playerId={targetId} size={56}>
            <img
              src={target?.avatarUrl}
              alt=""
              style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', objectPosition: 'center top' }}
            />
          </StatusRing>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color, fontFamily: 'var(--po-font-body)', letterSpacing: -0.2 }}>
              {target?.personaName}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--pulse-text-3)', fontFamily: 'var(--po-font-body)' }}>
              {isOnline && (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 6px #2ecc71' }} />
              )}
              <span>{isOnline ? 'Online now' : 'Offline'}</span>
            </div>
          </div>
          <motion.button
            whileTap={PULSE_TAP.button}
            onClick={() => openSendSilver(targetId)}
            aria-label="Send silver"
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
              cursor: 'pointer', color: 'var(--pulse-text-1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Coins size={20} weight="fill" />
          </motion.button>
          <motion.button
            whileTap={PULSE_TAP.button}
            onClick={() => openNudge(targetId)}
            aria-label="Nudge"
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
              cursor: 'pointer', color: 'var(--pulse-text-1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <HandWaving size={20} weight="fill" />
          </motion.button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {dmMessages.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--pulse-text-3)', fontSize: 13, fontFamily: 'var(--po-font-body)' }}>
            <img
              src={target?.avatarUrl}
              alt=""
              style={{ width: 120, height: 160, borderRadius: 16, objectFit: 'cover', objectPosition: 'center top', marginBottom: 12, opacity: 0.5 }}
            />
            <div style={{ fontWeight: 600, color: 'var(--pulse-text-2)', marginBottom: 2 }}>Start a conversation</div>
            <div>Only you and {target?.personaName?.split(' ')[0]} will see these messages</div>
          </div>
        )}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--pulse-border)', background: 'var(--pulse-surface)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder={`Message ${target?.personaName?.split(' ')[0]}...`}
          style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)', color: 'var(--pulse-text-1)', fontSize: 15, fontFamily: 'var(--po-font-body)', outline: 'none' }}
        />
        {text.trim() && (
          <motion.button
            whileTap={PULSE_TAP.button}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={handleSend}
            style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pulse-accent)', border: 'none', cursor: 'pointer', color: '#fff' }}
          >
            <PaperPlaneTilt size={16} weight="fill" />
          </motion.button>
        )}
      </div>
    </div>
  );
}
