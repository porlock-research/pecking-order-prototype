import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCartridgeStage } from '../../CartridgeStageContext';

interface GameShellProps {
  /** Per-game accent — passed through to children that need it. */
  accent: string;
  /** Header zone (genre label, game name, status). Renders first. */
  header?: React.ReactNode;
  /** Playfield zone — the renderer / form / option grid. Owns the mid. */
  children: React.ReactNode;
  /** Action zone — countdown / DEAD beat / retry-decision / celebration. */
  footer?: React.ReactNode;
}

/**
 * Outer chassis for all game cartridges. Mirrors VotingShell and PromptShell:
 * accent-tinted gradient panel, three vertical zones, stage-aware padding.
 *
 * Stays shell-agnostic via the --po-* contract — works in Pulse, Vivid,
 * Classic, Immersive. The staged variant (drops outer margin, grows internal
 * padding, collaborates with PlayableCartridgeMount's external how-it-works
 * card and cast strip) is exclusive to Pulse.
 */
export function GameShell({ accent, header, children, footer }: GameShellProps) {
  const { staged } = useCartridgeStage();
  const reduce = useReducedMotion();

  return (
    <motion.div
      data-game-shell
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        margin: staged ? 0 : '10px 0',
        borderRadius: 18,
        overflow: 'hidden',
        background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 8%, var(--po-bg-panel, rgba(0,0,0,0.3))) 0%, var(--po-bg-panel, rgba(0,0,0,0.3)) 60%)`,
        boxShadow: [
          `inset 0 0 0 1px color-mix(in oklch, ${accent} 26%, transparent)`,
          `inset 0 24px 48px -24px color-mix(in oklch, ${accent} 28%, transparent)`,
          `0 8px 28px -8px color-mix(in oklch, ${accent} 18%, transparent)`,
        ].join(', '),
        color: 'var(--po-text)',
      }}
    >
      <div
        style={{
          padding: staged ? '20px 18px 22px' : '16px 16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: staged ? 18 : 14,
        }}
      >
        {header}
        {children}
        {footer}
      </div>
    </motion.div>
  );
}
