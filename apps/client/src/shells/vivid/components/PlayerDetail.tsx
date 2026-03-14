import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AltArrowLeft, ChatDots, Dollar, CloseCircle } from '@solar-icons/react';
import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { resolveAvatarUrl, resolvePersonaVariant } from '../../../utils/personaImage';
import { PlayerStatuses, ChannelTypes } from '@pecking-order/shared-types';
import { AnimatedCounter } from './AnimatedCounter';
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
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [heroImageError, setHeroImageError] = useState(false);

  const target = roster[targetPlayerId];
  const me = playerId ? roster[playerId] : undefined;
  const isEliminated = target?.status === PlayerStatuses.ELIMINATED;
  const isOnline = onlinePlayers.includes(targetPlayerId);
  const isSelf = targetPlayerId === playerId;
  const mySilver = me?.silver ?? 0;

  // Derive full-body image URL from headshot
  const fullImageUrl = resolvePersonaVariant(target?.avatarUrl, 'full');
  const mediumImageUrl = resolvePersonaVariant(target?.avatarUrl, 'medium');

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
          zIndex: 50,
          background: '#1A1410',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9B8E7E',
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
        zIndex: 50,
        background: '#1A1410',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={VIVID_SPRING.page}
    >
      {/* ---- Hero image area ---- */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '52vh',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Full-body background image */}
        {fullImageUrl && !heroImageError && (
          <motion.img
            src={fullImageUrl}
            alt=""
            onLoad={() => setHeroImageLoaded(true)}
            onError={() => setHeroImageError(true)}
            initial={{ opacity: 0, scale: 1.08 }}
            animate={{
              opacity: heroImageLoaded ? 1 : 0,
              scale: 1,
              filter: isEliminated ? 'grayscale(0.8) brightness(0.6)' : 'none',
            }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 15%',
            }}
          />
        )}

        {/* Fallback: headshot blown up with blur */}
        {(!fullImageUrl || heroImageError) && (
          <div
            style={{
              position: 'absolute',
              inset: -20,
              backgroundImage: `url(${resolveAvatarUrl(target.avatarUrl)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: `blur(20px) ${isEliminated ? 'grayscale(0.8) brightness(0.6)' : ''}`,
              transform: 'scale(1.15)',
            }}
          />
        )}

        {/* Gradient overlays */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg,
              rgba(26, 20, 16, 0.3) 0%,
              rgba(26, 20, 16, 0) 30%,
              rgba(26, 20, 16, 0) 50%,
              rgba(26, 20, 16, 0.85) 85%,
              #1A1410 100%)`,
          }}
        />

        {/* Color tint from player accent */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${playerColor}15 0%, transparent 60%)`,
            mixBlendMode: 'overlay',
          }}
        />

        {/* Back button */}
        <motion.button
          onClick={onBack}
          style={{
            position: 'absolute',
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            left: 16,
            background: 'rgba(26, 20, 16, 0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            color: '#FAF3E8',
            cursor: 'pointer',
            padding: 10,
            lineHeight: 0,
            zIndex: 10,
          }}
          whileTap={VIVID_TAP.button}
          transition={VIVID_SPRING.bouncy}
        >
          <AltArrowLeft size={22} weight="Bold" />
        </motion.button>

        {/* Online indicator (top right) */}
        {isOnline && (
          <motion.div
            style={{
              position: 'absolute',
              top: 'max(22px, calc(env(safe-area-inset-top, 22px) + 4px))',
              right: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 9999,
              background: 'rgba(26, 20, 16, 0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              zIndex: 10,
            }}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, ...VIVID_SPRING.gentle }}
          >
            <motion.div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#4ade80',
              }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 11,
              fontWeight: 700,
              color: '#4ade80',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}>
              Online
            </span>
          </motion.div>
        )}

        {/* Eliminated banner */}
        {isEliminated && (
          <motion.div
            style={{
              position: 'absolute',
              top: '40%',
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              zIndex: 5,
            }}
            initial={{ opacity: 0, scale: 0.8, rotate: -3 }}
            animate={{ opacity: 1, scale: 1, rotate: -3 }}
            transition={{ delay: 0.4, ...VIVID_SPRING.dramatic }}
          >
            <div style={{
              padding: '8px 28px',
              background: 'rgba(217, 64, 115, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '2px solid rgba(217, 64, 115, 0.4)',
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 16,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'line-through',
            }}>
              Eliminated
            </div>
          </motion.div>
        )}

        {/* Name + stereotype overlay at bottom of hero */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '0 24px 16px',
            zIndex: 5,
          }}
        >
          <motion.h1
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 800,
              fontSize: 32,
              color: '#FAF3E8',
              margin: 0,
              lineHeight: 1.1,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, ...VIVID_SPRING.gentle }}
          >
            {target.personaName}
          </motion.h1>

          {target.bio && (
            <motion.p
              style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 14,
                lineHeight: 1.5,
                color: 'rgba(250, 243, 232, 0.7)',
                margin: '8px 0 0',
                maxWidth: '90%',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, ...VIVID_SPRING.gentle }}
            >
              {target.bio}
            </motion.p>
          )}
        </div>
      </div>

      {/* ---- Scrollable content below hero ---- */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          background: '#1A1410',
        }}
      >
        <div style={{ padding: '20px 24px 40px' }}>
          {/* Stats row — compact, de-emphasized */}
          <motion.div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 20,
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, ...VIVID_SPRING.gentle }}
          >
            {/* Silver */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 10,
              background: 'rgba(212, 150, 10, 0.08)',
              border: '1px solid rgba(212, 150, 10, 0.12)',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#D4960A',
              }} />
              <AnimatedCounter
                value={target.silver ?? 0}
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#D4960A',
                }}
              />
            </div>

            {/* Gold */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 10,
              background: 'rgba(139, 108, 193, 0.08)',
              border: '1px solid rgba(139, 108, 193, 0.12)',
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#8B6CC1',
              }} />
              <span style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 14,
                fontWeight: 700,
                color: '#8B6CC1',
              }}>
                {target.gold ?? 0}
              </span>
            </div>

            {/* DM count */}
            {dmCount > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 10,
                background: 'rgba(59, 169, 156, 0.08)',
                border: '1px solid rgba(59, 169, 156, 0.12)',
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#3BA99C',
                }} />
                <span style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#3BA99C',
                }}>
                  {dmCount}
                </span>
                <span style={{
                  fontFamily: 'var(--vivid-font-body)',
                  fontSize: 11,
                  color: 'rgba(59, 169, 156, 0.7)',
                }}>
                  msgs
                </span>
              </div>
            )}
          </motion.div>

          {/* Medium image — secondary dramatic shot */}
          {mediumImageUrl && (
            <motion.div
              style={{
                marginBottom: 20,
                borderRadius: 16,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                position: 'relative',
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, ...VIVID_SPRING.gentle }}
            >
              <img
                src={mediumImageUrl}
                alt={`${target.personaName}`}
                style={{
                  width: '100%',
                  display: 'block',
                  maxHeight: 280,
                  objectFit: 'cover',
                  objectPosition: 'center 20%',
                  filter: isEliminated ? 'grayscale(0.7) brightness(0.7)' : undefined,
                }}
                loading="lazy"
              />
              {/* Subtle gradient at bottom */}
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 60,
                background: 'linear-gradient(transparent, rgba(26, 20, 16, 0.7))',
              }} />
            </motion.div>
          )}

          {/* Action buttons */}
          {!isSelf && (
            <motion.div
              style={{
                display: 'flex',
                gap: 10,
                marginBottom: 16,
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, ...VIVID_SPRING.gentle }}
            >
              {/* Whisper */}
              <motion.button
                onClick={() => onWhisper(targetPlayerId)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 48,
                  borderRadius: 14,
                  background: '#3BA99C',
                  border: 'none',
                  color: '#FFFFFF',
                  fontFamily: 'var(--vivid-font-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: '0 4px 16px rgba(59, 169, 156, 0.25)',
                }}
                whileTap={VIVID_TAP.button}
                transition={VIVID_SPRING.bouncy}
              >
                <ChatDots size={20} weight="Bold" />
                Whisper
              </motion.button>

              {/* Send Silver */}
              <motion.button
                onClick={() => setShowSilverPicker(prev => !prev)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  height: 48,
                  borderRadius: 14,
                  background: showSilverPicker ? 'rgba(212, 150, 10, 0.15)' : '#D4960A',
                  border: showSilverPicker ? '1px solid rgba(212, 150, 10, 0.3)' : 'none',
                  color: showSilverPicker ? '#D4960A' : '#FFFFFF',
                  fontFamily: 'var(--vivid-font-display)',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: showSilverPicker ? 'none' : '0 4px 16px rgba(212, 150, 10, 0.25)',
                }}
                whileTap={VIVID_TAP.button}
                transition={VIVID_SPRING.bouncy}
              >
                <Dollar size={20} weight="Bold" />
                {silverSent ? 'Sent!' : 'Send Silver'}
              </motion.button>
            </motion.div>
          )}

          {/* Silver picker */}
          <AnimatePresence>
            {showSilverPicker && !isSelf && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={VIVID_SPRING.gentle}
                style={{ overflow: 'hidden', marginBottom: 16 }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 14,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
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
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid rgba(212, 150, 10, 0.2)',
                      background: 'rgba(212, 150, 10, 0.06)',
                      color: '#D4960A',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 16,
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                  <motion.button
                    onClick={handleSendSilver}
                    disabled={mySilver < 1}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: 10,
                      background: mySilver < 1 ? '#3D2E1F' : '#D4960A',
                      border: 'none',
                      color: '#FFFFFF',
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: mySilver < 1 ? 'not-allowed' : 'pointer',
                    }}
                    whileTap={mySilver >= 1 ? VIVID_TAP.button : undefined}
                    transition={VIVID_SPRING.bouncy}
                  >
                    Confirm
                  </motion.button>
                  <motion.button
                    onClick={() => { setShowSilverPicker(false); setSilverAmount(1); }}
                    style={{
                      padding: '10px',
                      borderRadius: 10,
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#9B8E7E',
                      lineHeight: 0,
                      cursor: 'pointer',
                    }}
                    whileTap={VIVID_TAP.button}
                    transition={VIVID_SPRING.bouncy}
                  >
                    <CloseCircle size={18} weight="Bold" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
