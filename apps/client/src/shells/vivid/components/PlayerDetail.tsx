import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AltArrowLeft, ChatDots, Dollar } from '@solar-icons/react';
import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PlayerStatuses, ChannelTypes } from '@pecking-order/shared-types';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface PlayerDetailProps {
  targetPlayerId: string;
  playerColor: string;
  engine: {
    sendSilver: (amount: number, targetId: string) => void;
  };
  onBack: () => void;
  onWhisper: (playerId: string) => void;
}

export function PlayerDetail({
  targetPlayerId,
  playerColor,
  engine,
  onBack,
  onWhisper,
}: PlayerDetailProps) {
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);

  const [showSilverPicker, setShowSilverPicker] = useState(false);
  const [silverAmount, setSilverAmount] = useState(1);
  const [silverSent, setSilverSent] = useState(false);

  const target = roster[targetPlayerId];
  const me = playerId ? roster[playerId] : undefined;
  const isEliminated = target?.status === PlayerStatuses.ELIMINATED;
  const isOnline = onlinePlayers.includes(targetPlayerId);
  const isSelf = targetPlayerId === playerId;
  const mySilver = me?.silver ?? 0;

  const dmCount = useMemo(() => {
    if (!playerId) return 0;
    return chatLog.filter(m => {
      const ch = channels[m.channelId];
      return (
        ch?.type === ChannelTypes.DM &&
        ch.memberIds.includes(targetPlayerId) &&
        ch.memberIds.includes(playerId)
      );
    }).length;
  }, [chatLog, channels, targetPlayerId, playerId]);

  function handleSendSilver() {
    if (silverAmount < 1 || silverAmount > mySilver) return;
    engine.sendSilver(silverAmount, targetPlayerId);
    setSilverSent(true);
    setShowSilverPicker(false);
    setSilverAmount(1);
    setTimeout(() => setSilverSent(false), 2000);
  }

  if (!target) {
    return (
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          background: 'var(--vivid-bg-deep)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--vivid-text-dim)',
        }}
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={VIVID_SPRING.page}
      >
        Player not found
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        background: 'var(--vivid-bg-deep)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={VIVID_SPRING.page}
    >
      {/* Back button */}
      <motion.button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          background: '#FFFFFF',
          border: '1px solid rgba(139, 115, 85, 0.1)',
          borderRadius: 12,
          color: 'var(--vivid-text)',
          cursor: 'pointer',
          padding: 8,
          lineHeight: 0,
          zIndex: 10,
          boxShadow: 'var(--vivid-surface-shadow)',
        }}
        whileTap={VIVID_TAP.button}
        transition={VIVID_SPRING.bouncy}
      >
        <AltArrowLeft size={24} weight="Bold" />
      </motion.button>

      {/* Scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          filter: isEliminated ? 'saturate(0.6)' : undefined,
        }}
      >
        {/* Hero section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            marginBottom: 28,
          }}
        >
          {/* Avatar with warm ring */}
          <div
            style={{
              borderRadius: '50%',
              padding: 4,
              border: `3px solid ${playerColor}`,
              boxShadow: `0 4px 20px ${playerColor}25`,
              display: 'flex',
              background: '#FFFFFF',
            }}
          >
            <PersonaAvatar
              avatarUrl={target.avatarUrl}
              personaName={target.personaName}
              size={96}
              eliminated={isEliminated}
            />
          </div>

          {/* Player name */}
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 800,
              fontSize: 26,
              color: playerColor,
              textAlign: 'center',
            }}
          >
            {target.personaName}
          </span>

          {/* Status badge */}
          {isEliminated ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 14px',
                borderRadius: 9999,
                background: 'rgba(217, 64, 115, 0.1)',
                border: '1px solid rgba(217, 64, 115, 0.2)',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 12,
                color: '#D94073',
                textDecoration: 'line-through',
                letterSpacing: '0.05em',
              }}
            >
              ELIMINATED
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 14px',
                borderRadius: 9999,
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 12,
                color: '#22c55e',
                letterSpacing: '0.05em',
              }}
            >
              <motion.div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#22c55e',
                }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              />
              ALIVE
            </span>
          )}
        </div>

        {/* Stats grid 2x2 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            maxWidth: 280,
            width: '100%',
            marginBottom: 24,
          }}
        >
          {/* Silver */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: '1px solid rgba(139, 115, 85, 0.08)',
              boxShadow: 'var(--vivid-surface-shadow)',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#D4960A',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 22,
                color: 'var(--vivid-text)',
              }}
            >
              {target.silver ?? 0}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#D4960A',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Silver
            </span>
          </div>

          {/* Gold */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: '1px solid rgba(139, 115, 85, 0.08)',
              boxShadow: 'var(--vivid-surface-shadow)',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#8B6CC1',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 22,
                color: 'var(--vivid-text)',
              }}
            >
              {target.gold ?? 0}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#8B6CC1',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Gold
            </span>
          </div>

          {/* Online status */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: '1px solid rgba(139, 115, 85, 0.08)',
              boxShadow: 'var(--vivid-surface-shadow)',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isOnline ? '#4ade80' : '#9B8E7E',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 14,
                color: isOnline ? '#3BA99C' : 'var(--vivid-text-dim)',
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--vivid-text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Status
            </span>
          </div>

          {/* DM count */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              border: '1px solid rgba(139, 115, 85, 0.08)',
              boxShadow: 'var(--vivid-surface-shadow)',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#3BA99C',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 22,
                color: 'var(--vivid-text)',
              }}
            >
              {dmCount}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#3BA99C',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Messages
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {!isSelf && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              width: '100%',
              maxWidth: 280,
            }}
          >
            {/* Whisper button */}
            <motion.button
              onClick={() => onWhisper(targetPlayerId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 48,
                borderRadius: 9999,
                background: '#3BA99C',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 3px 10px rgba(59, 169, 156, 0.2)',
              }}
              whileTap={VIVID_TAP.button}
              transition={VIVID_SPRING.bouncy}
            >
              <ChatDots size={20} weight="Bold" />
              Whisper
            </motion.button>

            {/* Send Silver button */}
            <motion.button
              onClick={() => setShowSilverPicker(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 48,
                borderRadius: 9999,
                background: '#D4960A',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: '0 3px 10px rgba(212, 150, 10, 0.2)',
              }}
              whileTap={VIVID_TAP.button}
              transition={VIVID_SPRING.bouncy}
            >
              <Dollar size={20} weight="Bold" />
              {silverSent ? 'Sent!' : 'Send Silver'}
            </motion.button>

            {/* Inline silver picker */}
            {showSilverPicker && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={VIVID_SPRING.gentle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 18,
                  background: '#FFFFFF',
                  border: '1px solid rgba(139, 115, 85, 0.1)',
                  boxShadow: 'var(--vivid-surface-shadow)',
                }}
              >
                <input
                  type="number"
                  min={1}
                  max={mySilver}
                  value={silverAmount}
                  onChange={e => setSilverAmount(Math.max(1, Math.min(mySilver, Number(e.target.value) || 1)))}
                  style={{
                    width: 64,
                    padding: '6px 8px',
                    borderRadius: 10,
                    border: '2px solid rgba(139, 115, 85, 0.12)',
                    background: 'var(--vivid-bg-deep)',
                    color: 'var(--vivid-text)',
                    fontFamily: 'var(--vivid-font-display)',
                    fontWeight: 700,
                    fontSize: 14,
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
                <motion.button
                  onClick={handleSendSilver}
                  disabled={mySilver < 1}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 9999,
                    background: mySilver < 1 ? 'var(--vivid-text-dim)' : '#D4960A',
                    border: 'none',
                    color: '#FFFFFF',
                    fontFamily: 'var(--vivid-font-display)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: mySilver < 1 ? 'not-allowed' : 'pointer',
                  }}
                  whileTap={mySilver >= 1 ? VIVID_TAP.button : undefined}
                  transition={VIVID_SPRING.bouncy}
                >
                  Send
                </motion.button>
                <motion.button
                  onClick={() => { setShowSilverPicker(false); setSilverAmount(1); }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 9999,
                    background: 'transparent',
                    border: '1px solid rgba(139, 115, 85, 0.12)',
                    color: 'var(--vivid-text-dim)',
                    fontFamily: 'var(--vivid-font-display)',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                  whileTap={VIVID_TAP.button}
                  transition={VIVID_SPRING.bouncy}
                >
                  Cancel
                </motion.button>
              </motion.div>
            )}
          </div>
        )}

      </div>
    </motion.div>
  );
}
