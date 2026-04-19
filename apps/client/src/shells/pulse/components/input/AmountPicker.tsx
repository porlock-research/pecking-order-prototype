import { motion } from 'framer-motion';
import { ArrowLeft, Coins } from '../../icons';
import { getPlayerColor } from '../../colors';
import { useGameStore } from '../../../../store/useGameStore';
import { PULSE_TAP } from '../../springs';
import type { SocialPlayer } from '@pecking-order/shared-types';

const AMOUNTS = [5, 10, 25, 50];

interface AmountPickerProps {
  player: SocialPlayer;
  playerId: string;
  onSelect: (amount: number) => void;
  onBack: () => void;
}

export function AmountPicker({ player, playerId, onSelect, onBack }: AmountPickerProps) {
  const roster = useGameStore(s => s.roster);
  const playerIndex = Object.keys(roster).indexOf(playerId);

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--pulse-text-2)', fontFamily: 'var(--po-font-body)' }}>
          <Coins size={14} weight="fill" style={{ color: 'var(--pulse-gold)' }} />
          <span>Silver →</span>
          <span style={{ color: getPlayerColor(playerIndex) }}>{player.personaName}</span>
          <span>— amount</span>
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {AMOUNTS.map(a => (
          <motion.button
            key={a}
            whileTap={PULSE_TAP.button}
            onClick={() => onSelect(a)}
            aria-label={`Send ${a} silver`}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'var(--po-font-body)',
              background: 'var(--pulse-surface-2)',
              border: '2px solid var(--pulse-gold)',
              color: 'var(--pulse-gold)',
              cursor: 'pointer',
            }}
          >
            {a}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
