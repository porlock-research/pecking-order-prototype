import { useState } from 'react';
import { motion } from 'framer-motion';
import { DilemmaEvents } from '@pecking-order/shared-types';
import { HandMoney, Shield } from '@solar-icons/react';
import { VIVID_SPRING, VIVID_TAP } from '../../shells/vivid/springs';

interface SilverGambitInputProps {
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function SilverGambitInput({ engine }: SilverGambitInputProps) {
  const [chosen, setChosen] = useState<'DONATE' | 'KEEP' | null>(null);

  const handleChoice = (action: 'DONATE' | 'KEEP') => {
    if (chosen) return;
    setChosen(action);
    engine.sendActivityAction(DilemmaEvents.SILVER_GAMBIT.SUBMIT, { action });
  };

  if (chosen) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={VIVID_SPRING.bouncy}
        style={{
          padding: '12px 16px',
          borderRadius: 12,
          background: chosen === 'DONATE' ? 'rgba(45, 106, 79, 0.08)' : 'rgba(157, 23, 77, 0.08)',
          border: `1px solid ${chosen === 'DONATE' ? 'rgba(45, 106, 79, 0.2)' : 'rgba(157, 23, 77, 0.2)'}`,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: chosen === 'DONATE' ? '#2D6A4F' : '#9D174D',
          }}
        >
          {chosen === 'DONATE' ? 'Donated! Fingers crossed...' : 'Keeping your silver safe.'}
        </span>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <motion.button
        onClick={() => handleChoice('DONATE')}
        style={{
          flex: 1,
          padding: '14px 12px',
          borderRadius: 12,
          background: 'rgba(45, 106, 79, 0.06)',
          border: '1.5px solid rgba(45, 106, 79, 0.2)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
        whileTap={VIVID_TAP.button}
        transition={VIVID_SPRING.snappy}
      >
        <HandMoney size={22} weight="Bold" color="#2D6A4F" />
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 12,
            fontWeight: 700,
            color: '#2D6A4F',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Donate 5 Silver
        </span>
      </motion.button>

      <motion.button
        onClick={() => handleChoice('KEEP')}
        style={{
          flex: 1,
          padding: '14px 12px',
          borderRadius: 12,
          background: 'rgba(157, 23, 77, 0.06)',
          border: '1.5px solid rgba(157, 23, 77, 0.2)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
        whileTap={VIVID_TAP.button}
        transition={VIVID_SPRING.snappy}
      >
        <Shield size={22} weight="Bold" color="#9D174D" />
        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontSize: 12,
            fontWeight: 700,
            color: '#9D174D',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Keep My Silver
        </span>
      </motion.button>
    </div>
  );
}
