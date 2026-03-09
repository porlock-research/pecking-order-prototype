import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Crown, InfoCircle } from '@solar-icons/react';
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

const RANK_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
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
        gap: 12,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--vivid-phase-accent)',
          }}
        >
          The Cast
        </span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--vivid-text-dim)',
            fontFamily: 'var(--vivid-font-body)',
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
        const rankColor = RANK_COLORS[rank] || 'var(--vivid-text-dim)';

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
              background: isMe ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
              borderRadius: 12,
              cursor: 'pointer',
              position: 'relative',
              ...(isLeader
                ? { boxShadow: '0 0 20px rgba(255,217,61,0.08), inset 0 0 30px rgba(255,217,61,0.03)' }
                : {}),
            }}
          >
            {/* Rank badge */}
            <div
              style={{
                width: 28,
                minWidth: 28,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {isLeader && (
                <Crown size={16} weight="BoldDuotone" style={{ color: '#FFD700' }} />
              )}
              <span
                style={{
                  fontFamily: 'var(--vivid-font-mono)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: rankColor,
                }}
              >
                #{rank}
              </span>
            </div>

            {/* Avatar */}
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
                  size={48}
                  isOnline={onlineSet.has(p.id) || undefined}
                />
              </div>
              {onlineSet.has(p.id) && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#4ade80',
                    border: '2px solid var(--vivid-bg-surface)',
                  }}
                />
              )}
            </div>

            {/* Name + silver */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: color,
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
                      color: 'var(--vivid-gold)',
                      background: 'rgba(255,217,61,0.12)',
                      padding: '1px 5px',
                      borderRadius: 4,
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
                  color: 'var(--vivid-gold)',
                }}
              >
                {p.silver ?? 0} silver
              </span>
            </div>

            {/* Info button */}
            <motion.button
              whileTap={VIVID_TAP.button}
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile(p.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 6,
                cursor: 'pointer',
                color: 'var(--vivid-text-dim)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <InfoCircle size={18} weight="Linear" />
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
              padding: '8px 12px',
              background: isMe ? 'rgba(255,255,255,0.06)' : 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
              borderLeft: `3px solid ${color}`,
            }}
          >
            {/* Rank */}
            <span
              style={{
                fontFamily: 'var(--vivid-font-mono)',
                fontSize: 12,
                color: 'var(--vivid-text-dim)',
                width: 24,
                minWidth: 24,
                textAlign: 'center',
              }}
            >
              #{rank}
            </span>

            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <PersonaAvatar
                avatarUrl={p.avatarUrl}
                personaName={p.personaName}
                size={32}
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
                    border: '2px solid var(--vivid-bg-surface)',
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
                    color: 'var(--vivid-gold)',
                    background: 'rgba(255,217,61,0.12)',
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
                color: 'var(--vivid-gold)',
              }}
            >
              {p.silver ?? 0}
            </span>

            {/* Info button */}
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
              }}
            >
              <InfoCircle size={16} weight="Linear" />
            </motion.button>
          </motion.div>
        );
      })}

      {/* Eliminated section */}
      {eliminated.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--vivid-text-dim)',
              }}
            >
              Eliminated
            </span>
            <span
              style={{
                fontSize: 11,
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
                animate={{ opacity: 0.5 }}
                transition={{ ...VIVID_SPRING.gentle, delay: 0.03 * i }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: isMe ? 'rgba(255,255,255,0.06)' : 'transparent',
                  borderRadius: 8,
                  borderLeft: '3px solid rgba(255,255,255,0.1)',
                }}
              >
                {/* Avatar */}
                <PersonaAvatar
                  avatarUrl={p.avatarUrl}
                  personaName={p.personaName}
                  size={32}
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
                        color: 'var(--vivid-gold)',
                        background: 'rgba(255,217,61,0.12)',
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
                      color: 'var(--vivid-pink)',
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

                {/* Info button */}
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
                  }}
                >
                  <InfoCircle size={16} weight="Linear" />
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
