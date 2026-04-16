import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TickerCategories } from '@pecking-order/shared-types';
import { ArrowLeft, HandWaving } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';
import type { Command } from '../../hooks/useCommandBuilder';

interface PlayerPickerProps {
  breadcrumb: string;
  command?: Command;
  onSelect: (player: SocialPlayer, playerId: string) => void;
  onBack: () => void;
}

export function PlayerPicker({ breadcrumb, command, onSelect, onBack }: PlayerPickerProps) {
  const roster = useGameStore(s => s.roster);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const { playerId } = usePulse();

  // Server allows each sender to nudge each target once per day. Mirror that
  // locally from tickerMessages so the picker can mark/disable used targets.
  const alreadyNudged = useMemo<Record<string, true>>(() => {
    if (command !== 'nudge' || !playerId) return {};
    const m: Record<string, true> = {};
    for (const t of tickerMessages) {
      if (t.category !== TickerCategories.SOCIAL_NUDGE) continue;
      const ids = t.involvedPlayerIds;
      if (ids?.[0] === playerId && ids?.[1]) m[ids[1]] = true;
    }
    return m;
  }, [command, playerId, tickerMessages]);

  const players = Object.entries(roster).filter(
    ([id, p]) => id !== playerId && p.status === 'ALIVE',
  );

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36, height: 36,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--pulse-text-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 8,
          }}
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pulse-text-2)', fontFamily: 'var(--po-font-body)' }}>
          {breadcrumb}
        </span>
      </div>

      {/* 3-column portrait grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {players.map(([id, player], i) => {
          const disabled = !!alreadyNudged[id];
          return (
          <motion.button
            key={id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...PULSE_SPRING.snappy, delay: i * 0.03 }}
            onClick={() => { if (!disabled) onSelect(player, id); }}
            disabled={disabled}
            aria-label={disabled ? `Already nudged ${player.personaName} today` : undefined}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: 6,
              borderRadius: 12,
              background: 'var(--pulse-surface-2)',
              border: '1px solid var(--pulse-border)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : 1,
              filter: disabled ? 'saturate(0.6)' : 'none',
              overflow: 'hidden',
            }}
          >
            <img
              src={player.avatarUrl}
              alt=""
              loading="lazy"
              width={100}
              height={100}
              style={{ width: '100%', height: 100, borderRadius: 8, objectFit: 'cover', objectPosition: 'center 25%' }}
            />
            <span style={{
              fontSize: 10, fontWeight: 600, color: getPlayerColor(Object.keys(roster).indexOf(id)),
              fontFamily: 'var(--po-font-body)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
            }}>
              {player.personaName}
            </span>
            {disabled && (
              <span
                style={{
                  position: 'absolute', top: 6, left: 6,
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  padding: '2px 6px', borderRadius: 8,
                  background: 'rgba(20,20,26,0.85)',
                  color: 'var(--pulse-nudge)',
                  fontSize: 9, fontWeight: 800, letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  border: '1px solid rgba(255,160,77,0.35)',
                  pointerEvents: 'none',
                }}
              >
                <HandWaving size={10} weight="fill" />
                Nudged
              </span>
            )}
          </motion.button>
          );
        })}
      </div>
    </div>
  );
}
