import { motion } from 'framer-motion';
import type { Command } from '../../hooks/useCommandBuilder';

const hints: Array<{ label: string; command: Command; color: string }> = [
  { label: '/silver', command: 'silver', color: 'var(--pulse-gold)' },
  { label: '/dm', command: 'dm', color: 'var(--pulse-accent)' },
  { label: '/nudge', command: 'nudge', color: 'var(--pulse-nudge)' },
  { label: '/whisper', command: 'whisper', color: 'var(--pulse-whisper)' },
  { label: '@mention', command: 'mention', color: 'var(--pulse-text-2)' },
];

interface HintChipsProps {
  onSelect: (command: Command) => void;
}

export function HintChips({ onSelect }: HintChipsProps) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '6px 12px 2px', overflowX: 'auto', scrollbarWidth: 'none' }}>
      {hints.map(h => (
        <motion.button
          key={h.label}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(h.command)}
          style={{
            padding: '5px 11px',
            borderRadius: 14,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--po-font-body)',
            background: `${h.color}14`,
            border: `1px solid ${h.color}33`,
            color: h.color,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {h.label}
        </motion.button>
      ))}
    </div>
  );
}
