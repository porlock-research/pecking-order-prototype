import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AltArrowLeft,
  Dollar,
  CupStar,
  ChatDots,
  WiFiRouter,
  UsersGroupRounded,
} from '@solar-icons/react';
import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { PlayerStatuses, GAME_MASTER_ID, ChannelTypes } from '@pecking-order/shared-types';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface SpotlightProps {
  targetPlayerId: string;
  engine: {
    sendSilver: (amount: number, targetId: string) => void;
  };
  onBack: () => void;
  onMessage: (playerId: string) => void;
  onStartGroup?: (playerId: string) => void;
}

export function Spotlight({
  targetPlayerId,
  engine,
  onBack,
  onMessage,
  onStartGroup,
}: SpotlightProps) {
  const { playerId, roster } = useGameStore();
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
  const isGameMaster = targetPlayerId === GAME_MASTER_ID;

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

  const mySilver = me?.silver ?? 0;

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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--vivid-text-dim)',
        }}
      >
        Player not found
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: 24,
        overflow: 'auto',
        filter: isEliminated ? 'saturate(0.6)' : undefined,
      }}
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
        {/* Aura ring + Avatar */}
        <motion.div
          layoutId={`vivid-avatar-${targetPlayerId}`}
          style={{
            width: 128,
            height: 128,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
          }}
        >
          <motion.div
            style={{
              width: 128,
              height: 128,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            animate={{
              boxShadow: isEliminated
                ? [
                    '0 0 20px var(--vivid-pink), 0 0 40px rgba(255, 46, 99, 0.2)',
                    '0 0 30px var(--vivid-pink), 0 0 60px rgba(255, 46, 99, 0.3)',
                    '0 0 20px var(--vivid-pink), 0 0 40px rgba(255, 46, 99, 0.2)',
                  ]
                : [
                    '0 0 20px var(--vivid-teal), 0 0 40px rgba(78, 205, 196, 0.2)',
                    '0 0 30px var(--vivid-teal), 0 0 60px rgba(78, 205, 196, 0.3)',
                    '0 0 20px var(--vivid-teal), 0 0 40px rgba(78, 205, 196, 0.2)',
                  ],
            }}
            transition={{
              repeat: Infinity,
              duration: 2.5,
              ease: 'easeInOut',
            }}
          >
            <div style={{ filter: isEliminated ? 'grayscale(0.8)' : undefined }}>
              <PersonaAvatar
                avatarUrl={target.avatarUrl}
                personaName={target.personaName}
                size={120}
                eliminated={isEliminated}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* Persona name */}
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 900,
            fontSize: 24,
            color: 'var(--vivid-text)',
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
              background: 'rgba(255, 46, 99, 0.2)',
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
              background: 'rgba(34, 197, 94, 0.15)',
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

      {/* Stats grid */}
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
            borderRadius: 16,
            padding: 16,
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
            {target.silver}
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
            borderRadius: 16,
            padding: 16,
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
            borderRadius: 16,
            padding: 16,
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
        </div>

        {/* DM count */}
        <div
          style={{
            background: 'var(--vivid-bg-surface)',
            borderRadius: 16,
            padding: 16,
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
            DMs
          </span>
        </div>
      </div>

      {/* Action buttons */}
      {!isSelf && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            maxWidth: 280,
          }}
        >
          {/* Primary row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Message button — always shown */}
            <motion.button
              onClick={() => onMessage(targetPlayerId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 20px',
                borderRadius: 9999,
                background: 'var(--vivid-teal)',
                border: 'none',
                color: '#FFFFFF',
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              whileTap={VIVID_TAP.button}
              transition={VIVID_SPRING.bouncy}
            >
              <ChatDots size={18} weight="Bold" />
              Message
            </motion.button>

            {/* Send Silver — not for GM or self */}
            {!isGameMaster && (
              <motion.button
                onClick={() => setShowSilverPicker(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 9999,
                  background: 'var(--vivid-gold)',
                  border: 'none',
                  color: '#1a1b3a',
                  fontFamily: 'var(--vivid-font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                whileTap={VIVID_TAP.button}
                transition={VIVID_SPRING.bouncy}
              >
                <Dollar size={18} weight="Bold" />
                {silverSent ? 'Sent!' : 'Send Silver'}
              </motion.button>
            )}

            {/* Start Group — not for GM or self */}
            {!isGameMaster && onStartGroup && (
              <motion.button
                onClick={() => onStartGroup(targetPlayerId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 9999,
                  background: 'var(--vivid-lavender)',
                  border: 'none',
                  color: '#FFFFFF',
                  fontFamily: 'var(--vivid-font-display)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                whileTap={VIVID_TAP.button}
                transition={VIVID_SPRING.bouncy}
              >
                <UsersGroupRounded size={18} weight="Bold" />
                Start Group
              </motion.button>
            )}
          </div>

          {/* Inline silver picker */}
          {showSilverPicker && !isGameMaster && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={VIVID_SPRING.gentle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 16,
                background: 'var(--vivid-bg-surface)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
                  border: '1px solid rgba(255, 255, 255, 0.15)',
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
                onClick={() => {
                  setShowSilverPicker(false);
                  setSilverAmount(1);
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: 9999,
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
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
  );
}
