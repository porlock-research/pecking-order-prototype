import { motion } from 'framer-motion';
import type { ChannelType, ChannelCapability, DayPhase } from '@pecking-order/shared-types';
import { DayPhases } from '@pecking-order/shared-types';
import type { Command } from '../../hooks/useCommandBuilder';

type ChipVisibility =
  | { kind: 'capability'; cap: ChannelCapability }
  | { kind: 'channelType'; allow: ChannelType[] };

/**
 * `requires` is a phase gate: the chip only shows when the named flag is true.
 * Separate from `visibility` (which is channel/capability-scoped and static for
 * the session) — these flags flip during the day as OPEN_* / CLOSE_* fire.
 */
const chips: Array<{
  label: string;
  command: Command;
  color: string;
  visibility: ChipVisibility;
  requires?: 'groupChatOpen' | 'dmsOpen';
}> = [
  { label: '/silver',  command: 'silver',  color: 'var(--pulse-gold)',    visibility: { kind: 'capability',  cap: 'SILVER_TRANSFER' } },
  { label: '/nudge',   command: 'nudge',   color: 'var(--pulse-nudge)',   visibility: { kind: 'capability',  cap: 'NUDGE' } },
  { label: '/dm',      command: 'dm',      color: 'var(--pulse-accent)',  visibility: { kind: 'channelType', allow: ['MAIN'] }, requires: 'dmsOpen' },
  { label: '/whisper', command: 'whisper', color: 'var(--pulse-whisper)', visibility: { kind: 'capability',  cap: 'WHISPER' }, requires: 'dmsOpen' },
  { label: '@mention', command: 'mention', color: 'var(--pulse-text-2)',  visibility: { kind: 'channelType', allow: ['MAIN', 'GROUP_DM'] }, requires: 'groupChatOpen' },
];

interface HintChipsProps {
  onSelect: (command: Command) => void;
  channelType?: ChannelType;
  capabilities?: ChannelCapability[];
  groupChatOpen?: boolean;
  dmsOpen?: boolean;
  /** Phase-aware bypass: /whisper is valid during pregame even though
   *  dmsOpen is false (l3-pregame's canWhisper guard skips the dmsOpen
   *  check by design). */
  phase?: DayPhase;
}

export function HintChips({
  onSelect,
  channelType = 'MAIN',
  capabilities = [],
  groupChatOpen = true,
  dmsOpen = true,
  phase,
}: HintChipsProps) {
  const visible = chips.filter(c => {
    const staticOk = c.visibility.kind === 'capability'
      ? capabilities.includes(c.visibility.cap)
      : c.visibility.allow.includes(channelType);
    if (!staticOk) return false;
    if (c.requires === 'groupChatOpen' && !groupChatOpen) return false;
    if (c.requires === 'dmsOpen' && !dmsOpen) {
      // Pregame exception: whisper is always allowed in pregame.
      const whisperInPregame = c.command === 'whisper' && phase === DayPhases.PREGAME;
      if (!whisperInPregame) return false;
    }
    return true;
  });

  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {visible.map(h => (
        <motion.button
          key={h.label}
          whileTap={{ scale: 0.94, backgroundColor: `${h.color}22` }}
          transition={{ backgroundColor: { duration: 0.12 } }}
          onClick={() => onSelect(h.command)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 11px 5px 9px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--po-font-body)',
            background: 'var(--pulse-surface-2)',
            border: '1px solid var(--pulse-border)',
            color: 'var(--pulse-text-2)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {/* Leading dot carries the command's accent — hue is type-identity,
              not decoration, so only one pixel-scale worth of color per chip. */}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: h.color,
              flexShrink: 0,
            }}
          />
          {h.label}
        </motion.button>
      ))}
    </div>
  );
}
