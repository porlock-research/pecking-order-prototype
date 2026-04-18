import type { SocialPlayer } from '@pecking-order/shared-types';
import { motion, useReducedMotion } from 'framer-motion';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { GameTimerBar } from './GameTimerBar';

interface GameReadyRosterProps {
  /** Per-game accent — Ready CTA tint + ready indicator. */
  accent: string;
  /** All players eligible for the live round. */
  eligibleIds: string[];
  /** Subset that has already readied. */
  readyIds: string[];
  /** Current player id. */
  selfId: string;
  /** Roster for portrait lookup. */
  roster: Record<string, SocialPlayer>;
  /** Optional ready-up deadline (epoch ms) for the timer bar. */
  deadline?: number | null;
  /** Total ms span of the deadline (for timer bar). */
  totalMs?: number;
  /** Ready handler. */
  onReady: () => void;
}

/**
 * READY-state roster for live multiplayer games. Replaces the inline
 * `font-mono "Get Ready"` + per-row pill list with a portrait-first
 * grid: persona avatars are the visual anchor, ready state is an
 * accent ring on the avatar (engaged/waiting grammar).
 */
export function GameReadyRoster({
  accent,
  eligibleIds,
  readyIds,
  selfId,
  roster,
  deadline,
  totalMs,
  onReady,
}: GameReadyRosterProps) {
  const reduce = useReducedMotion();
  const readySet = new Set(readyIds);
  const isMeReady = readySet.has(selfId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: '20px 16px 24px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.26em',
            color: accent,
            textTransform: 'uppercase',
          }}
        >
          Ready up
        </span>
        <span
          style={{
            fontFamily: 'var(--po-font-body)',
            fontSize: 13,
            color: 'var(--po-text-dim)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {readyIds.length} of {eligibleIds.length} ready
        </span>
      </div>

      {deadline != null && totalMs != null && (
        <GameTimerBar deadline={deadline} totalMs={totalMs} accent={accent} />
      )}

      <button
        type="button"
        onClick={() => !isMeReady && onReady()}
        disabled={isMeReady}
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--po-text)',
          background: isMeReady
            ? `color-mix(in oklch, ${accent} 18%, transparent)`
            : `linear-gradient(180deg, color-mix(in oklch, ${accent} 95%, white) 0%, ${accent} 100%)`,
          border: isMeReady
            ? `1px solid color-mix(in oklch, ${accent} 38%, transparent)`
            : 'none',
          borderRadius: 14,
          padding: '14px 32px',
          minHeight: 48,
          cursor: isMeReady ? 'default' : 'pointer',
          boxShadow: isMeReady
            ? 'none'
            : [
                `inset 0 1px 0 color-mix(in oklch, ${accent} 60%, white)`,
                `0 6px 18px -8px color-mix(in oklch, ${accent} 60%, transparent)`,
              ].join(', '),
          transition: 'transform 120ms ease',
        }}
        onPointerDown={(e) => { if (!isMeReady) e.currentTarget.style.transform = 'scale(0.97)'; }}
        onPointerUp={(e) => { e.currentTarget.style.transform = ''; }}
        onPointerLeave={(e) => { e.currentTarget.style.transform = ''; }}
      >
        {isMeReady ? 'Locked in' : 'Ready up'}
      </button>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 14,
          paddingTop: 4,
        }}
      >
        {eligibleIds.map((pid, i) => {
          const player = roster[pid];
          if (!player) return null;
          const ready = readySet.has(pid);
          const isSelf = pid === selfId;
          const firstName = (player.personaName || pid).split(' ')[0];

          return (
            <motion.div
              key={pid}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.05 * i, ease: [0.2, 0.9, 0.3, 1] }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <motion.div
                animate={
                  ready || reduce ? undefined : { opacity: [0.55, 0.85, 0.55] }
                }
                transition={
                  ready || reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                }
                style={{
                  position: 'relative',
                  borderRadius: '50%',
                  padding: 2,
                  background: ready
                    ? `conic-gradient(from 0deg, ${accent}, color-mix(in oklch, ${accent} 60%, white), ${accent})`
                    : `1px dashed color-mix(in oklch, var(--po-text) 24%, transparent)`,
                  filter: ready ? 'none' : 'saturate(0.8)',
                  border: ready ? 'none' : `1px dashed color-mix(in oklch, var(--po-text) 24%, transparent)`,
                  boxShadow: ready
                    ? `0 0 16px -4px color-mix(in oklch, ${accent} 50%, transparent)`
                    : 'none',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player.avatarUrl}
                  personaName={player.personaName}
                  size={48}
                />
                {isSelf && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: 'var(--po-text)',
                      border: '2px solid var(--po-bg-panel)',
                    }}
                    aria-label="you"
                  />
                )}
              </motion.div>
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: ready ? 'var(--po-text)' : 'var(--po-text-dim)',
                  maxWidth: 60,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {firstName}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
