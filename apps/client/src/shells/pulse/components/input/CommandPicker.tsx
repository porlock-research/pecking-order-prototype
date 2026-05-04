import { motion } from 'framer-motion';
import { Coins, ChatCircle, HandWaving, Lock, X } from '../../icons';
import { PULSE_SPRING, PULSE_TAP } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { DayPhases } from '@pecking-order/shared-types';
import type { ChannelCapability, DayPhase } from '@pecking-order/shared-types';
import type { Command } from '../../hooks/useCommandBuilder';

const commands: Array<{
  id: Command;
  icon: typeof Coins;
  label: string;
  desc: string;
  color: string;
  requires?: 'dmsOpen';
  cap?: ChannelCapability;
}> = [
  { id: 'silver',  icon: Coins,       label: 'Silver',  desc: 'Tip silver',         color: 'var(--pulse-gold)',    cap: 'SILVER_TRANSFER' },
  { id: 'dm',      icon: ChatCircle,  label: 'DM',      desc: 'Open a DM',          color: 'var(--pulse-accent)',  requires: 'dmsOpen' },
  { id: 'nudge',   icon: HandWaving,  label: 'Nudge',   desc: 'Get on their radar', color: 'var(--pulse-nudge)',   cap: 'NUDGE' },
  { id: 'whisper', icon: Lock,        label: 'Whisper', desc: 'Off the record',     color: 'var(--pulse-whisper)', requires: 'dmsOpen', cap: 'WHISPER' },
];

interface CommandPickerProps {
  onSelect: (cmd: Command) => void;
  onClose: () => void;
  dmsOpen?: boolean;
  /** MAIN channel capabilities — silver/nudge only show when the channel can
   *  actually perform them (pregame MAIN has CHAT+REACTIONS+WHISPER only). */
  capabilities?: ChannelCapability[];
  /** Pregame exception: /whisper is allowed even though dmsOpen is false. */
  phase?: DayPhase;
}

export function CommandPicker({ onSelect, onClose, dmsOpen = true, capabilities, phase }: CommandPickerProps) {
  const visible = commands.filter(c => {
    if (c.cap && capabilities && !capabilities.includes(c.cap)) return false;
    if (c.requires === 'dmsOpen' && !dmsOpen) {
      // Whisper stays reachable in pregame even though DMs are closed
      // (mirrors HintChips' pregame bypass). All other dmsOpen-gated
      // commands hide — there's no valid target channel for them.
      if (c.id === 'whisper' && phase === DayPhases.PREGAME) return true;
      return false;
    }
    return true;
  });
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, zIndex: backdropFor(PULSE_Z.popup) }}
      />
      <motion.div
        role="dialog"
        aria-label="Command picker"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={PULSE_SPRING.snappy}
        style={{
          position: 'relative',
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          zIndex: PULSE_Z.popup,
          alignItems: 'stretch',
        }}
      >
        {visible.map(({ id, icon: Icon, label, desc, color }) => (
          <motion.button
            key={id}
            whileTap={PULSE_TAP.button}
            onClick={() => onSelect(id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '10px 6px',
              borderRadius: 'var(--pulse-radius-md)',
              background: 'var(--pulse-surface-2)',
              border: '1px solid var(--pulse-border)',
              cursor: 'pointer',
              color,
            }}
          >
            <Icon size={22} weight="fill" />
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--po-font-body)' }}>{label}</span>
            <span style={{ fontSize: 9, color: 'var(--pulse-text-3)', fontFamily: 'var(--po-font-body)' }}>{desc}</span>
          </motion.button>
        ))}
        {/* Dismiss */}
        <motion.button
          whileTap={PULSE_TAP.button}
          onClick={onClose}
          aria-label="Close"
          style={{
            width: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--pulse-radius-md)',
            background: 'var(--pulse-surface-2)', border: '1px solid var(--pulse-border)',
            cursor: 'pointer', color: 'var(--pulse-text-2)',
          }}
        >
          <X size={18} weight="bold" />
        </motion.button>
      </motion.div>
    </>
  );
}
