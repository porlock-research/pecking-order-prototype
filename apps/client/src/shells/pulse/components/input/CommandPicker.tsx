import { motion } from 'framer-motion';
import { Coins, MessageCircle, Hand, Lock, X } from 'lucide-react';
import { PULSE_SPRING } from '../../springs';
import type { Command } from '../../hooks/useCommandBuilder';

const commands: Array<{ id: Command; icon: typeof Coins; label: string; desc: string; color: string }> = [
  { id: 'silver', icon: Coins, label: 'Silver', desc: 'Send silver', color: 'var(--pulse-gold)' },
  { id: 'dm', icon: MessageCircle, label: 'DM', desc: 'Start a chat', color: 'var(--pulse-accent)' },
  { id: 'nudge', icon: Hand, label: 'Nudge', desc: 'Poke a player', color: 'var(--pulse-nudge)' },
  { id: 'whisper', icon: Lock, label: 'Whisper', desc: 'Secret message', color: 'var(--pulse-whisper)' },
];

interface CommandPickerProps {
  onSelect: (cmd: Command) => void;
  onClose: () => void;
}

export function CommandPicker({ onSelect, onClose }: CommandPickerProps) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 39 }} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={PULSE_SPRING.snappy}
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          zIndex: 40,
          alignItems: 'stretch',
        }}
      >
        {commands.map(({ id, icon: Icon, label, desc, color }) => (
          <motion.button
            key={id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 6px',
              borderRadius: 14,
              background: 'var(--pulse-surface-2)',
              border: '1px solid var(--pulse-border)',
              cursor: 'pointer',
              color,
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--po-font-body)' }}>{label}</span>
            <span style={{ fontSize: 9, color: 'var(--pulse-text-3)', fontFamily: 'var(--po-font-body)' }}>{desc}</span>
          </motion.button>
        ))}
        {/* Dismiss */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 36,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 14,
            background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
            cursor: 'pointer', color: 'var(--pulse-text-2)',
          }}
        >
          <X size={16} />
        </motion.button>
      </motion.div>
    </>
  );
}
