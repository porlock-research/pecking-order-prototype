import { useMemo, useEffect } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { DayPhases, TickerCategories } from '@pecking-order/shared-types';
import type { DayPhase } from '@pecking-order/shared-types';
import { ArrowLeft, HandWaving, UsersThree } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import { PersonaImage, initialsOf } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import type { SocialPlayer } from '@pecking-order/shared-types';
import type { Command } from '../../hooks/useCommandBuilder';

interface PlayerPickerProps {
  command?: Command;
  onSelect: (player: SocialPlayer, playerId: string) => void;
  onBack: () => void;
  /** Game phase. When 'pregame' the picker stays open but shows a clarifying
   *  banner — DMs/silver/nudge/group chat aren't reachable yet, only whispers
   *  land. Without this hint the picker reads as broken (tapping a face does
   *  something for /whisper but nothing for /dm /silver /nudge). */
  phase?: DayPhase;
}

const COMMAND_HUE: Record<Command, string> = {
  silver: 'var(--pulse-gold)',
  dm: 'var(--pulse-accent)',
  nudge: 'var(--pulse-nudge)',
  whisper: 'var(--pulse-whisper)',
  mention: 'var(--pulse-text-1)',
};

const COMMAND_TITLE: Record<Command, string> = {
  silver: 'Send silver to…',
  dm: 'Message…',
  nudge: 'Nudge…',
  whisper: 'Whisper to…',
  mention: 'Tag…',
};

const EMPTY_VERB: Record<Command, string> = {
  silver: 'send silver to',
  dm: 'message',
  nudge: 'nudge',
  whisper: 'whisper to',
  mention: 'tag',
};

export function PlayerPicker({ command, onSelect, onBack, phase }: PlayerPickerProps) {
  const roster = useGameStore(s => s.roster);
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const { playerId } = usePulse();
  const isPregame = phase === DayPhases.PREGAME;
  // Per-command pregame copy: /whisper actually works (server allows pregame
  // whispers as intrigue beats); the others are visibly active but won't go
  // through. The picker stays open by design so tapping a face still teaches
  // "this is how you'd do it" — the banner just sets expectations honestly.
  const pregameNote = isPregame
    ? command === 'whisper'
      ? 'Whispers fire even before Day 1 — your target sees them, the rest of the cast sees a lock.'
      : 'Day 1 hasn’t started yet. This will go through once the day opens.'
    : null;

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

  const players = useMemo(
    () => Object.entries(roster).filter(([id, p]) => id !== playerId && p.status === 'ALIVE'),
    [roster, playerId],
  );

  const title = command ? COMMAND_TITLE[command] : 'Pick someone…';
  const hue = command ? COMMAND_HUE[command] : 'var(--pulse-text-2)';
  const emptyVerb = command ? EMPTY_VERB[command] : 'pick';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={PULSE_SPRING.page}
      style={{ padding: '10px 14px 14px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <motion.button
          whileTap={PULSE_TAP.button}
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 44, height: 44,
            background: 'none', border: 'none', cursor: 'pointer',
            color: hue,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--pulse-radius-sm)',
          }}
        >
          <ArrowLeft size={20} weight="bold" />
        </motion.button>
        <span style={{
          fontSize: 15,
          fontWeight: 600,
          fontFamily: 'var(--po-font-display)',
          color: hue,
          letterSpacing: '-0.01em',
        }}>
          {title}
        </span>
      </div>

      {pregameNote && (
        <div
          role="status"
          style={{
            margin: '0 0 12px',
            padding: '8px 12px',
            borderRadius: 'var(--pulse-radius-md)',
            background: 'color-mix(in oklch, var(--pulse-gold) 6%, var(--pulse-surface-2))',
            border: '1px solid color-mix(in oklch, var(--pulse-gold) 24%, transparent)',
            fontSize: 12,
            lineHeight: 1.4,
            color: 'var(--pulse-text-2)',
            fontFamily: 'var(--po-font-body)',
            fontStyle: 'italic',
          }}
        >
          <span aria-hidden="true" style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--pulse-gold)',
            marginRight: 8,
            verticalAlign: 'middle',
          }} />
          {pregameNote}
        </div>
      )}

      {players.length === 0 ? (
        <div style={{
          padding: '28px 16px 24px',
          textAlign: 'center',
          color: 'var(--pulse-text-3)',
          fontSize: 13,
          fontFamily: 'var(--po-font-body)',
        }}>
          <UsersThree size={28} weight="fill" style={{ opacity: 0.4, marginBottom: 8 }} />
          <div>No one left to {emptyVerb}.</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))',
          gap: 12,
        }}>
          {players.map(([id, player], i) => (
            <PlayerCard
              key={id}
              id={id}
              player={player}
              index={i}
              disabled={!!alreadyNudged[id]}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

interface PlayerCardProps {
  id: string;
  player: SocialPlayer;
  index: number;
  disabled: boolean;
  onSelect: (player: SocialPlayer, playerId: string) => void;
}

function PlayerCard({ id, player, index, disabled, onSelect }: PlayerCardProps) {
  const controls = useAnimationControls();
  const baseTilt = index % 2 === 0 ? -0.6 : 0.6;

  useEffect(() => {
    controls.start({
      opacity: 1,
      scale: 1,
      rotate: baseTilt,
      transition: { ...PULSE_SPRING.snappy, delay: index * 0.03 },
    });
  }, [controls, baseTilt, index]);

  const handleTap = () => {
    if (disabled) {
      controls.start({
        x: [0, -6, 6, -4, 4, 0],
        transition: { duration: 0.38, ease: 'easeOut' },
      }).then(() => {
        controls.start({ x: 0, rotate: baseTilt });
      });
      try { navigator.vibrate?.(8); } catch { /* no-op */ }
      return;
    }
    onSelect(player, id);
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.94, rotate: baseTilt }}
      animate={controls}
      whileTap={disabled ? undefined : { scale: 0.96, rotate: 0 }}
      onClick={handleTap}
      aria-disabled={disabled}
      aria-label={disabled ? `Already nudged ${player.personaName} today` : player.personaName}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 6,
        padding: 5,
        borderRadius: 'var(--pulse-radius-sm)',
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-border)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        filter: disabled ? 'saturate(0.55)' : 'none',
        overflow: 'hidden',
        textAlign: 'left',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '4 / 5',
        borderRadius: 'var(--pulse-radius-xs)',
        overflow: 'hidden',
        background: 'var(--pulse-surface-3)',
      }}>
        <PersonaImage
          avatarUrl={player.avatarUrl}
          cacheKey={id}
          preferredVariant="medium"
          fallbackChain={['headshot', 'full']}
          initials={initialsOf(player.personaName)}
          playerColor={getPlayerColor(index)}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {disabled && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 6, right: 6,
              width: 24, height: 24,
              borderRadius: '50%',
              background: 'color-mix(in oklch, var(--pulse-bg) 75%, transparent)',
              color: 'var(--pulse-nudge)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(2px)',
              boxShadow: '0 0 0 1px color-mix(in oklch, var(--pulse-nudge) 35%, transparent)',
            }}
          >
            <HandWaving size={13} weight="fill" />
          </span>
        )}
      </div>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--pulse-text-1)',
        fontFamily: 'var(--po-font-body)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 2px 1px',
        letterSpacing: '-0.005em',
      }}>
        {player.personaName}
      </span>
    </motion.button>
  );
}
