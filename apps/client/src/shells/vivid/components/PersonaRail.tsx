import React, { useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChatDots } from '@solar-icons/react';
import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { GAME_MASTER_ID, PlayerStatuses, ChannelTypes } from '@pecking-order/shared-types';
import type { ChatMessage } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../springs';

interface PersonaRailProps {
  onSelectPlayer: (playerId: string) => void;
  onSelectMainChat: () => void;
  onLongPressPlayer?: (playerId: string, position: { x: number; y: number }) => void;
  activePlayerId: string | null;
  showingMainChat: boolean;
}

const LONG_PRESS_MS = 500;

export function PersonaRail({
  onSelectPlayer,
  onSelectMainChat,
  onLongPressPlayer,
  activePlayerId,
  showingMainChat,
}: PersonaRailProps) {
  const { playerId, roster } = useGameStore();
  const onlinePlayers = useGameStore(s => s.onlinePlayers);
  const chatLog = useGameStore(s => s.chatLog);
  const channels = useGameStore(s => s.channels);

  // Track long press timers per-element
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const { mePlayer, alivePlayers, eliminatedPlayers } = useMemo(() => {
    const all = Object.values(roster).filter(p => p.id !== GAME_MASTER_ID);
    const me = all.find(p => p.id === playerId);
    const alive = all
      .filter(p => p.status === PlayerStatuses.ALIVE && p.id !== playerId)
      .sort((a, b) => a.personaName.localeCompare(b.personaName));
    const eliminated = all
      .filter(p => p.status === PlayerStatuses.ELIMINATED)
      .sort((a, b) => a.personaName.localeCompare(b.personaName));
    return { mePlayer: me, alivePlayers: alive, eliminatedPlayers: eliminated };
  }, [roster, playerId]);

  // Detect unread DMs: DM channels where the other player sent a message
  // Simplified check: any DM channel with messages from the other player
  const unreadPlayerIds = useMemo(() => {
    if (!playerId) return new Set<string>();
    const unread = new Set<string>();
    const dmChannels = Object.values(channels).filter(
      ch => ch.type === ChannelTypes.DM && ch.memberIds.includes(playerId)
    );
    for (const ch of dmChannels) {
      const otherPlayerId = ch.memberIds.find(id => id !== playerId);
      if (!otherPlayerId) continue;
      const hasMessageFromOther = chatLog.some(
        (m: ChatMessage) => m.channelId === ch.id && m.senderId === otherPlayerId
      );
      if (hasMessageFromOther) {
        unread.add(otherPlayerId);
      }
    }
    return unread;
  }, [channels, chatLog, playerId]);

  const handlePointerDown = useCallback(
    (id: string, e: React.PointerEvent) => {
      longPressFired.current = false;
      const { clientX, clientY } = e;
      longPressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        onLongPressPlayer?.(id, { x: clientX, y: clientY });
      }, LONG_PRESS_MS);
    },
    [onLongPressPlayer],
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleClick = useCallback(
    (id: string) => {
      if (longPressFired.current) return;
      onSelectPlayer(id);
    },
    [onSelectPlayer],
  );

  const handleMainChatClick = useCallback(() => {
    onSelectMainChat();
  }, [onSelectMainChat]);

  // Renders a single avatar item in the rail
  function renderAvatarItem(
    id: string,
    size: number,
    ringStyle: React.CSSProperties | undefined,
    ringClass: string,
    overlay: React.ReactNode,
    isEliminated: boolean,
  ) {
    const player = roster[id];
    if (!player) return null;
    return (
      <motion.button
        key={id}
        layoutId={`vivid-avatar-${id}`}
        className={`relative shrink-0 flex items-center justify-center ${ringClass}`}
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: '50%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          WebkitTapHighlightColor: 'transparent',
          ...ringStyle,
        }}
        whileTap={{ scale: 0.9 }}
        transition={VIVID_SPRING.bouncy}
        onClick={() => handleClick(id)}
        onPointerDown={(e) => handlePointerDown(id, e)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <PersonaAvatar
          avatarUrl={player.avatarUrl}
          personaName={player.personaName}
          size={size}
          eliminated={isEliminated}
        />
        {overlay}
      </motion.button>
    );
  }

  return (
    <div
      className="persona-rail"
      style={{
        height: 72,
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
        gap: 12,
        paddingLeft: 16,
        paddingRight: 16,
        background: 'var(--vivid-bg-surface)',
        opacity: 0.95,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        scrollbarWidth: 'none',
      }}
    >
      {/* 1. Your persona — coral glow ring, 60px */}
      {mePlayer &&
        renderAvatarItem(
          mePlayer.id,
          60,
          {
            boxShadow: '0 0 12px var(--vivid-coral)',
            border: '2px solid var(--vivid-coral)',
          },
          '',
          null,
          false,
        )}

      {/* 2. Alive players — 52px */}
      {alivePlayers.map(player => {
        const isOnline = onlinePlayers.includes(player.id);
        const isActive = activePlayerId === player.id;
        const hasUnread = unreadPlayerIds.has(player.id);

        // Ring style: gold shimmer if active, green if online, none if offline
        let ringStyle: React.CSSProperties | undefined;
        if (isActive) {
          ringStyle = {
            boxShadow: '0 0 10px var(--vivid-gold), 0 0 20px var(--vivid-gold)',
            border: '2px solid var(--vivid-gold)',
          };
        } else if (isOnline) {
          ringStyle = {
            border: '2px solid #22c55e',
          };
        } else {
          ringStyle = {
            border: '2px solid transparent',
          };
        }

        // Unread dot overlay
        const unreadDot = hasUnread ? (
          <motion.div
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'var(--vivid-coral)',
              border: '2px solid var(--vivid-bg-deep)',
            }}
            animate={{ y: [0, -3, 0] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          />
        ) : null;

        return renderAvatarItem(
          player.id,
          52,
          ringStyle,
          '',
          unreadDot,
          false,
        );
      })}

      {/* 3. Eliminated players — 40px, grayscale + red diagonal line */}
      {eliminatedPlayers.map(player =>
        renderAvatarItem(
          player.id,
          40,
          {
            border: '2px solid transparent',
          },
          '',
          /* Red diagonal line overlay */
          <div
            style={{
              position: 'absolute',
              inset: 4,
              borderRadius: '50%',
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '-10%',
                width: '120%',
                height: 2,
                background: 'var(--vivid-coral)',
                transform: 'rotate(45deg)',
                transformOrigin: 'center',
              }}
            />
          </div>,
          true,
        ),
      )}

      {/* 4. Main chat bubble — 48px circle */}
      <motion.button
        className="shrink-0 flex items-center justify-center"
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--vivid-bg-surface)',
          border: showingMainChat
            ? '2px solid var(--vivid-gold)'
            : '2px solid rgba(255,255,255,0.1)',
          boxShadow: showingMainChat
            ? '0 0 10px var(--vivid-gold), 0 0 20px var(--vivid-gold)'
            : 'none',
          cursor: 'pointer',
          padding: 0,
          WebkitTapHighlightColor: 'transparent',
        }}
        whileTap={{ scale: 0.9 }}
        transition={VIVID_SPRING.bouncy}
        onClick={handleMainChatClick}
      >
        <ChatDots size={26} weight="Bold" color="var(--vivid-teal)" />
      </motion.button>
    </div>
  );
}
