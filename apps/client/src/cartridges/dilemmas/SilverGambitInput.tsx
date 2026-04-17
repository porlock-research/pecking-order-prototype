import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { DilemmaEvents } from '@pecking-order/shared-types';
import { HandCoins, Shield } from 'lucide-react';

interface SilverGambitInputProps {
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

/**
 * Silver Gambit — the one dilemma with built-in moral polarity. DONATE
 * (generosity, green) vs KEEP (self-interest, pink). The two choices
 * are themed with opposing --po-green / --po-pink so the decision
 * *looks* like a decision, not a generic two-button picker.
 */
export default function SilverGambitInput({ engine }: SilverGambitInputProps) {
  const [chosen, setChosen] = useState<'DONATE' | 'KEEP' | null>(null);
  const reduce = useReducedMotion();

  const handleChoice = (action: 'DONATE' | 'KEEP') => {
    if (chosen) return;
    setChosen(action);
    engine.sendActivityAction(DilemmaEvents.SILVER_GAMBIT.SUBMIT, { action });
  };

  if (chosen) {
    const isDonate = chosen === 'DONATE';
    const accent = isDonate ? 'var(--po-green)' : 'var(--po-pink)';
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          padding: '14px 18px',
          borderRadius: 12,
          background: `color-mix(in oklch, ${accent} 10%, transparent)`,
          border: `1px solid color-mix(in oklch, ${accent} 30%, transparent)`,
          textAlign: 'center',
          boxShadow: `0 0 18px color-mix(in oklch, ${accent} 20%, transparent)`,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.1,
            color: accent,
          }}
        >
          {isDonate ? 'Donated — fingers crossed.' : 'Keeping your silver safe.'}
        </span>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <ChoiceButton
        onClick={() => handleChoice('DONATE')}
        Icon={HandCoins}
        label="Donate 5 silver"
        accent="var(--po-green, #2d6a4f)"
        reduce={reduce ?? false}
      />
      <ChoiceButton
        onClick={() => handleChoice('KEEP')}
        Icon={Shield}
        label="Keep my silver"
        accent="var(--po-pink)"
        reduce={reduce ?? false}
      />
    </div>
  );
}

function ChoiceButton({
  onClick,
  Icon,
  label,
  accent,
  reduce,
}: {
  onClick: () => void;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  label: string;
  accent: string;
  reduce: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      whileHover={reduce ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      style={{
        flex: 1,
        padding: '16px 12px',
        borderRadius: 14,
        background: `color-mix(in oklch, ${accent} 8%, var(--po-bg-panel, transparent))`,
        border: `1.5px solid color-mix(in oklch, ${accent} 32%, transparent)`,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        boxShadow: `0 0 10px color-mix(in oklch, ${accent} 15%, transparent)`,
        transition: 'background 0.2s, border-color 0.2s',
      }}
    >
      <Icon size={24} strokeWidth={2.25} color={accent} />
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 12,
          fontWeight: 800,
          color: accent,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </span>
    </motion.button>
  );
}
