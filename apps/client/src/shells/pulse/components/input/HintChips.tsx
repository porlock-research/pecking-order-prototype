import { motion } from 'framer-motion';
import type { ChannelType, ChannelCapability } from '@pecking-order/shared-types';
import type { Command } from '../../hooks/useCommandBuilder';

type ChipVisibility =
  | { kind: 'capability'; cap: ChannelCapability }
  | { kind: 'channelType'; allow: ChannelType[] };

const chips: Array<{
  label: string;
  command: Command;
  color: string;
  visibility: ChipVisibility;
}> = [
  { label: '/silver',  command: 'silver',  color: 'var(--pulse-gold)',    visibility: { kind: 'capability',  cap: 'SILVER_TRANSFER' } },
  { label: '/nudge',   command: 'nudge',   color: 'var(--pulse-nudge)',   visibility: { kind: 'capability',  cap: 'NUDGE' } },
  { label: '/dm',      command: 'dm',      color: 'var(--pulse-accent)',  visibility: { kind: 'channelType', allow: ['MAIN'] } },
  { label: '/whisper', command: 'whisper', color: 'var(--pulse-whisper)', visibility: { kind: 'capability',  cap: 'WHISPER' } },
  { label: '@mention', command: 'mention', color: 'var(--pulse-text-2)', visibility: { kind: 'channelType', allow: ['MAIN', 'GROUP_DM'] } },
];

interface HintChipsProps {
  onSelect: (command: Command) => void;
  channelType?: ChannelType;
  capabilities?: ChannelCapability[];
}

export function HintChips({ onSelect, channelType = 'MAIN', capabilities = [] }: HintChipsProps) {
  const visible = chips.filter(c =>
    c.visibility.kind === 'capability'
      ? capabilities.includes(c.visibility.cap)
      : c.visibility.allow.includes(channelType),
  );

  if (visible.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 12px 2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
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
