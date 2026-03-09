import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { AltArrowLeft, Dollar, CupStar, ChatDots, WiFiRouter } from '@solar-icons/react';
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
          background: 'none',
          border: 'none',
          color: 'var(--vivid-text)',
          cursor: 'pointer',
          padding: 4,
          lineHeight: 0,
          zIndex: 10,
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
          {/* Avatar with glow ring */}
          <div
            style={{
              borderRadius: '50%',
              padding: 3,
              border: `3px solid ${playerColor}`,
              boxShadow: `0 0 20px ${playerColor}40`,
              display: 'flex',
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
              fontWeight: 900,
              fontSize: 24,
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
                background: 'rgba(255,46,99,0.2)',
                border: '1px solid var(--vivid-pink)',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 12,
                color: 'var(--vivid-pink)',
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
                background: 'rgba(34,197,94,0.15)',
                border: '1px solid #22c55e',
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
              background: 'var(--vivid-bg-surface)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Dollar size={28} weight="BoldDuotone" color="var(--vivid-gold)" />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--vivid-text)',
              }}
            >
              {target.silver ?? 0}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--vivid-text-dim)',
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
              background: 'var(--vivid-bg-surface)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <CupStar size={28} weight="BoldDuotone" color="var(--vivid-gold)" />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--vivid-text)',
              }}
            >
              {target.gold ?? 0}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--vivid-text-dim)',
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
              background: 'var(--vivid-bg-surface)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <WiFiRouter size={28} weight="BoldDuotone" color={isOnline ? 'var(--vivid-teal)' : 'var(--vivid-text-dim)'} />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 14,
                color: isOnline ? 'var(--vivid-teal)' : 'var(--vivid-text-dim)',
              }}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span
              style={{
                fontSize: 11,
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
              background: 'var(--vivid-bg-surface)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ChatDots size={28} weight="BoldDuotone" color="var(--vivid-teal)" />
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--vivid-text)',
              }}
            >
              {dmCount}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--vivid-text-dim)',
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
                background: 'var(--vivid-teal)',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
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
                background: 'var(--vivid-gold)',
                border: 'none',
                color: '#1a1b3a',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
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
                  borderRadius: 16,
                  background: 'var(--vivid-bg-surface)',
                  border: '1px solid rgba(255,255,255,0.08)',
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
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.15)',
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
                    background: mySilver < 1 ? 'var(--vivid-text-dim)' : 'var(--vivid-gold)',
                    border: 'none',
                    color: '#1a1b3a',
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
                    border: '1px solid rgba(255,255,255,0.15)',
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

        {/* Future features placeholder */}
        <div
          style={{
            marginTop: 32,
            fontSize: 14,
            color: 'var(--vivid-text-dim)',
            textAlign: 'center',
          }}
        >
          More coming soon...
        </div>
      </div>
    </motion.div>
  );
}
