import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { GAME_MASTER_ID, PlayerStatuses } from '@pecking-order/shared-types';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CastTabProps {
  playerColorMap: Record<string, string>;
  onSelectPlayer: (playerId: string) => void;
  onViewProfile: (playerId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Rank badge colors                                                  */
/* ------------------------------------------------------------------ */

const RANK_BADGE_STYLES: Record<number, { bg: string; color: string }> = {
  1: { bg: 'rgba(212, 150, 10, 0.15)', color: '#D4960A' },
  2: { bg: 'rgba(155, 142, 126, 0.12)', color: '#9B8E7E' },
  3: { bg: 'rgba(196, 113, 59, 0.12)', color: '#C4713B' },
};

/* ------------------------------------------------------------------ */
/*  CastTab                                                            */
/* ------------------------------------------------------------------ */

export function CastTab({ playerColorMap, onSelectPlayer, onViewProfile }: CastTabProps) {
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);
  const onlinePlayers = useGameStore(s => s.onlinePlayers);

  const { rankedAlive, eliminated } = useMemo(() => {
    const all = Object.values(roster).filter(p => p.id !== GAME_MASTER_ID);
    const alive = all
      .filter(p => p.status === PlayerStatuses.ALIVE)
      .sort((a, b) => (b.silver ?? 0) - (a.silver ?? 0));
    const elim = all
      .filter(p => p.status === PlayerStatuses.ELIMINATED)
      .sort((a, b) => (b.silver ?? 0) - (a.silver ?? 0));
    return { rankedAlive: alive, eliminated: elim };
  }, [roster]);

  const onlineSet = useMemo(() => new Set(onlinePlayers), [onlinePlayers]);

  const podium = rankedAlive.slice(0, 3);
  const rest = rankedAlive.slice(3);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 18,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--vivid-phase-accent)',
          }}
        >
          The Cast
        </span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--vivid-text-dim)',
            fontFamily: 'var(--vivid-font-body)',
            fontWeight: 500,
          }}
        >
          {rankedAlive.length} remaining
        </span>
      </div>

      {/* Top 3 podium cards */}
      {podium.map((p, i) => {
        const rank = i + 1;
        const isLeader = rank === 1;
        const isMe = p.id === playerId;
        const color = playerColorMap[p.id] || 'var(--vivid-phase-accent)';
        const badgeStyle = RANK_BADGE_STYLES[rank] || { bg: 'rgba(155, 142, 126, 0.1)', color: 'var(--vivid-text-dim)' };

        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...VIVID_SPRING.gentle, delay: 0.05 * i }}
            whileTap={VIVID_TAP.card}
            onClick={() => onSelectPlayer(p.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: isLeader ? '14px 18px' : '12px 16px',
              background: '#FFFFFF',
              borderRadius: 18,
              cursor: 'pointer',
              position: 'relative',
              border: isMe
                ? `2px solid ${color}`
                : '1px solid rgba(139, 115, 85, 0.08)',
              boxShadow: isLeader
                ? '0 3px 14px rgba(212, 150, 10, 0.12)'
                : 'var(--vivid-card-shadow)',
            }}
          >
            {/* Rank badge — styled number with colored background */}
            <div
              style={{
                width: 30,
                height: 30,
                minWidth: 30,
                borderRadius: 10,
                background: badgeStyle.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 14,
                  fontWeight: 800,
                  color: badgeStyle.color,
                }}
              >
                #{rank}
              </span>
            </div>

            {/* Avatar — 52px for podium */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  borderRadius: '50%',
                  padding: 2,
                  border: `2px solid ${color}`,
                  display: 'flex',
                }}
              >
                <PersonaAvatar
                  avatarUrl={p.avatarUrl}
                  personaName={p.personaName}
                  size={52}
                  isOnline={onlineSet.has(p.id) || undefined}
                />
              </div>
              {onlineSet.has(p.id) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#4ade80',
                    border: '2px solid #FFFFFF',
                  }}
                />
              )}
            </div>

            {/* Name + silver */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: color,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--vivid-font-display)',
                  }}
                >
                  {p.personaName}
                </span>
                {isMe && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#D4960A',
                      background: 'rgba(212, 150, 10, 0.12)',
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}
                  >
                    YOU
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 13,
                  color: '#D4960A',
                  fontWeight: 600,
                }}
              >
                {p.silver ?? 0} silver
              </span>
            </div>

            {/* Info button — simple text */}
            <motion.button
              whileTap={VIVID_TAP.button}
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(p.id);
              }}
              style={{
                background: 'var(--vivid-bg-elevated)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: 8,
                cursor: 'pointer',
                color: 'var(--vivid-text-dim)',
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Info
            </motion.button>
          </motion.div>
        );
      })}

      {/* Remaining alive players */}
      {rest.map((p, i) => {
        const rank = i + 4;
        const isMe = p.id === playerId;
        const color = playerColorMap[p.id] || 'var(--vivid-phase-accent)';

        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...VIVID_SPRING.gentle, delay: 0.05 * (i + 3) }}
            whileTap={VIVID_TAP.card}
            onClick={() => onSelectPlayer(p.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: isMe ? '#FFFFFF' : 'var(--vivid-bg-elevated)',
              borderRadius: 14,
              cursor: 'pointer',
              border: isMe
                ? `2px solid ${color}`
                : '1px solid rgba(139, 115, 85, 0.06)',
              boxShadow: 'var(--vivid-surface-shadow)',
            }}
          >
            {/* Rank */}
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--vivid-text-dim)',
                width: 24,
                minWidth: 24,
                textAlign: 'center',
              }}
            >
              #{rank}
            </span>

            {/* Avatar — 40px for rest */}
            <div style={{ position: 'relative' }}>
              <PersonaAvatar
                avatarUrl={p.avatarUrl}
                personaName={p.personaName}
                size={40}
                isOnline={onlineSet.has(p.id) || undefined}
              />
              {onlineSet.has(p.id) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#4ade80',
                    border: '2px solid var(--vivid-bg-elevated)',
                  }}
                />
              )}
            </div>

            {/* Name + silver */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 14,
                  color: color,
                  fontWeight: 600,
                  fontFamily: 'var(--vivid-font-display)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.personaName}
              </span>
              {isMe && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#D4960A',
                    background: 'rgba(212, 150, 10, 0.12)',
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}
                >
                  YOU
                </span>
              )}
            </div>

            {/* Silver */}
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 12,
                color: '#D4960A',
                fontWeight: 600,
              }}
            >
              {p.silver ?? 0}
            </span>

            {/* Info button — simple text */}
            <motion.button
              whileTap={VIVID_TAP.button}
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(p.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 4,
                cursor: 'pointer',
                color: 'var(--vivid-text-dim)',
                display: 'flex',
                alignItems: 'center',
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Info
            </motion.button>
          </motion.div>
        );
      })}

      {/* Eliminated section */}
      {eliminated.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--vivid-text-dim)',
              }}
            >
              Eliminated
            </span>
            <span
              style={{
                fontSize: 12,
                color: 'var(--vivid-text-dim)',
                fontFamily: 'var(--vivid-font-body)',
              }}
            >
              {eliminated.length}
            </span>
          </div>

          {eliminated.map((p, i) => {
            const isMe = p.id === playerId;

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ ...VIVID_SPRING.gentle, delay: 0.03 * i }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 14px',
                  background: isMe ? 'rgba(217, 64, 115, 0.04)' : 'var(--vivid-bg-elevated)',
                  borderRadius: 14,
                  border: '1px solid rgba(139, 115, 85, 0.06)',
                }}
              >
                {/* Avatar — 36px for eliminated */}
                <PersonaAvatar
                  avatarUrl={p.avatarUrl}
                  personaName={p.personaName}
                  size={36}
                  eliminated
                />

                {/* Name + eliminated badge */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 14,
                      color: 'var(--vivid-text-dim)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.personaName}
                  </span>
                  {isMe && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#D4960A',
                        background: 'rgba(212, 150, 10, 0.12)',
                        padding: '1px 5px',
                        borderRadius: 4,
                      }}
                    >
                      YOU
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: '#D94073',
                      fontFamily: 'var(--vivid-font-display)',
                    }}
                  >
                    ELIMINATED
                  </span>
                </div>

                {/* Silver */}
                <span
                  style={{
                    fontFamily: 'var(--vivid-font-mono)',
                    fontSize: 12,
                    color: 'var(--vivid-text-dim)',
                  }}
                >
                  {p.silver ?? 0}
                </span>

                {/* Info button — simple text */}
                <motion.button
                  whileTap={VIVID_TAP.button}
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewProfile(p.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 4,
                    cursor: 'pointer',
                    color: 'var(--vivid-text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Info
                </motion.button>
              </motion.div>
            );
          })}
        </>
      )}

      {/* Bottom spacer for safe area */}
      <div style={{ height: 16 }} />
    </div>
  );
}
