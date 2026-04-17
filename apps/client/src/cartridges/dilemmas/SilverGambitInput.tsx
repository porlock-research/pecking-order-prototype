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
    const Icon = isDonate ? HandCoins : Shield;
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 8 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: [0.92, 1.03, 1], y: 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.9, 0.3, 1] }}
        style={{
          padding: '20px 18px',
          borderRadius: 16,
          background: `color-mix(in oklch, ${accent} 14%, transparent)`,
          border: `1.5px solid color-mix(in oklch, ${accent} 50%, transparent)`,
          textAlign: 'center',
          boxShadow: `0 0 28px color-mix(in oklch, ${accent} 35%, transparent), 0 0 60px color-mix(in oklch, ${accent} 14%, transparent)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `2px solid ${accent}`,
            background: `color-mix(in oklch, ${accent} 10%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 14px color-mix(in oklch, ${accent} 40%, transparent)`,
          }}
        >
          <Icon size={28} strokeWidth={2.25} color={accent} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.22em',
              color: 'var(--po-text-dim)',
              textTransform: 'uppercase',
            }}
          >
            Locked in
          </span>
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: -0.3,
              color: accent,
              lineHeight: 1.25,
            }}
          >
            {isDonate ? 'Donated — fingers crossed.' : 'Keeping your silver safe.'}
          </span>
        </div>
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
  Icon: React.ComponentType<any>;
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
