import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChartBar, GameController, ChatCircleDots, Scales } from '../icons';
import { PULSE_SPRING, PULSE_TAP } from '../springs';
import type { PillState, PillLifecycle } from '../hooks/usePillStates';

const PILL_ICONS: Record<string, typeof ChartBar> = {
  voting: ChartBar,
  game: GameController,
  prompt: ChatCircleDots,
  dilemma: Scales,
};

const PILL_COLORS: Record<string, string> = {
  voting: 'var(--pulse-vote)',
  game: 'var(--pulse-game)',
  prompt: 'var(--pulse-prompt)',
  dilemma: 'var(--pulse-dilemma)',
};

function lifecycleStyles(lifecycle: PillLifecycle) {
  switch (lifecycle) {
    case 'upcoming':
      return {
        background: 'var(--pulse-surface-2)',
        border: '1px dashed var(--pulse-text-4)',
        opacity: 0.5,
      };
    case 'starting':
    case 'just-started':
      return {
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-accent)',
      };
    case 'needs-action':
      return {
        background: 'var(--pulse-accent-glow)',
        border: '1px solid var(--pulse-accent)',
      };
    case 'urgent':
      return {
        background: 'var(--pulse-accent-glow)',
        border: '1px solid var(--pulse-accent)',
        animation: 'pulse-pill-urgent 1s ease-in-out infinite',
      };
    case 'in-progress':
      return {
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-text-4)',
      };
    case 'completed':
      return {
        background: 'var(--pulse-surface)',
        border: '1px solid var(--pulse-border)',
        opacity: 0.6,
      };
  }
}

interface PillProps {
  pill: PillState;
  mini?: boolean;
  onTap?: () => void;
  buttonRef?: (el: HTMLButtonElement | null) => void;
}

export function Pill({ pill, mini, onTap, buttonRef }: PillProps) {
  const Icon = PILL_ICONS[pill.kind] || ChatCircleDots;
  const kindColor = PILL_COLORS[pill.kind] || 'var(--pulse-accent)';
  const styles = lifecycleStyles(pill.lifecycle);
  const showDot = pill.lifecycle === 'just-started' || pill.lifecycle === 'starting';
  const showBadge = pill.lifecycle === 'needs-action' || pill.lifecycle === 'urgent';
  const isActive = pill.lifecycle !== 'completed' && pill.lifecycle !== 'upcoming';

  // Pill ignition: one-shot animation when transitioning upcoming/starting → just-started.
  const prevLifecycle = useRef(pill.lifecycle);
  const [igniting, setIgniting] = useState(false);
  useEffect(() => {
    const prev = prevLifecycle.current;
    prevLifecycle.current = pill.lifecycle;
    if ((prev === 'upcoming' || prev === 'starting') && pill.lifecycle === 'just-started') {
      setIgniting(true);
      const t = setTimeout(() => setIgniting(false), 450);
      return () => clearTimeout(t);
    }
  }, [pill.lifecycle]);

  return (
    <motion.button
      ref={buttonRef}
      className={igniting ? 'pulse-pill-ignition' : undefined}
      whileTap={PULSE_TAP.pill}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: styles.opacity ?? 1, scale: 1 }}
      transition={PULSE_SPRING.snappy}
      onClick={onTap}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: mini ? 4 : 6,
        padding: mini ? '4px 8px' : '6px 12px',
        borderRadius: 20,
        cursor: 'pointer',
        fontSize: mini ? 10 : 11,
        fontWeight: 700,
        fontFamily: 'var(--po-font-body)',
        color: isActive ? kindColor : 'var(--pulse-text-2)',
        whiteSpace: 'nowrap',
        position: 'relative',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        ...styles,
        ...(isActive ? {
          background: `${kindColor}14`,
          border: `1px solid ${kindColor}40`,
        } : {}),
      }}
    >
      <Icon size={mini ? 14 : 16} weight="fill" />
      {!mini && <span>{pill.label}</span>}
      {pill.progress && !mini && (
        <span style={{ color: 'var(--pulse-text-2)', fontSize: 10 }}>{pill.progress}</span>
      )}
      {showDot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: kindColor,
            boxShadow: `0 0 6px ${kindColor}`,
            animation: 'pulse-breathe 2s ease-in-out infinite',
            flexShrink: 0,
          }}
        />
      )}
      {showBadge && (
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ff3b3b',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          !
        </span>
      )}
    </motion.button>
  );
}
