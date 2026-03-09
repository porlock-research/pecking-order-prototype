import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { formatPhase } from '../../../utils/formatState';
import { PlayerStatuses } from '@pecking-order/shared-types';
import { CurrencyDollarSimple, Trophy, GearSix } from '@phosphor-icons/react';
import { VIVID_SPRING } from '../springs';

/** Map phase label to a vivid accent color */
function phaseColor(phase: string): string {
  switch (phase) {
    case 'VOTING':
      return 'var(--vivid-coral)';
    case 'LIVE SESSION':
    case 'BRIEFING':
      return 'var(--vivid-teal)';
    case 'GAME TIME':
      return 'var(--vivid-lavender)';
    case 'NIGHT COUNCIL':
      return 'var(--vivid-pink)';
    case 'GAME OVER':
    case 'FINALE':
      return 'var(--vivid-gold)';
    default:
      return 'var(--vivid-text)';
  }
}

export function GameHUD() {
  const { roster, goldPool, playerId, dayIndex, serverState, gameId } =
    useGameStore();
  const me = playerId ? roster[playerId] : null;

  const players = Object.values(roster);
  const phase = formatPhase(serverState);

  return (
    <header
      className="shrink-0 z-50"
      style={{
        height: 48,
        background: 'color-mix(in srgb, var(--vivid-bg-surface) 85%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="h-full flex items-center justify-between"
        style={{ padding: '0 16px' }}
      >
        {/* Left: Day + Phase */}
        <div className="flex items-center gap-3 min-w-0">
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: '-0.02em',
              color: 'var(--vivid-text)',
              whiteSpace: 'nowrap',
            }}
          >
            DAY {dayIndex}
          </span>

          <AnimatePresence mode="wait">
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={VIVID_SPRING.snappy}
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontWeight: 800,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: phaseColor(phase),
                whiteSpace: 'nowrap',
              }}
            >
              {phase}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Center: Alive pips */}
        <div
          className="flex items-center gap-1"
          style={{ justifyContent: 'center' }}
          title={`${players.filter(p => p.status === PlayerStatuses.ALIVE).length}/${players.length} alive`}
        >
          {players.map((p) => (
            <span
              key={p.id}
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor:
                  p.status === PlayerStatuses.ALIVE
                    ? 'var(--vivid-teal)'
                    : 'var(--vivid-coral)',
                opacity: p.status === PlayerStatuses.ALIVE ? 1 : 0.35,
                transition: 'background-color 0.3s, opacity 0.3s',
              }}
            />
          ))}
        </div>

        {/* Right: Currency + Admin */}
        <div className="flex items-center gap-3">
          {me && (
            <div className="flex items-center gap-2.5">
              {/* Silver */}
              <div
                className="flex items-center gap-1"
                title="Silver"
              >
                <CurrencyDollarSimple
                  size={16}
                  weight="duotone"
                  style={{ color: 'var(--vivid-gold)' }}
                />
                <span
                  style={{
                    fontFamily: 'var(--vivid-font-body)',
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--vivid-gold)',
                  }}
                >
                  {me.silver}
                </span>
              </div>

              {/* Gold */}
              <div
                className="flex items-center gap-1"
                title="Gold pool"
              >
                <Trophy
                  size={14}
                  weight="duotone"
                  style={{ color: 'var(--vivid-gold)' }}
                />
                <span
                  style={{
                    fontFamily: 'var(--vivid-font-body)',
                    fontWeight: 600,
                    fontSize: 13,
                    color: 'var(--vivid-gold)',
                  }}
                >
                  {goldPool}
                </span>
              </div>
            </div>
          )}

          {/* Admin link */}
          {gameId && (
            <a
              href={`${import.meta.env.VITE_LOBBY_HOST || 'http://localhost:3000'}/admin/game/${gameId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Admin Panel"
              style={{ color: 'var(--vivid-text-dim)', lineHeight: 0 }}
            >
              <GearSix size={16} weight="duotone" />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
