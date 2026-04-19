import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCartridgeStage } from '../../CartridgeStageContext';

interface VotingShellProps {
  /** Mechanism accent — passed through to children that need it. */
  accentColor: string;
  /** Header zone (mechanism label, CTA, optional how-it-works). Renders first. */
  header?: React.ReactNode;
  /** Engagement zone (VoterStrip or equivalent). Renders between header and action. */
  engagement?: React.ReactNode;
  /** Action zone (picker for VOTING phase, hero+tally for REVEAL phase). */
  children: React.ReactNode;
}

/**
 * Outer chassis for all voting cartridges. Mirrors PromptShell's role:
 * provides the consistent panel container, accent-tinted background gradient,
 * and per-zone layout. Reads the staging context only to scale padding —
 * inline chrome suppression happens inside individual zone components
 * (VotingHeader hides HowItWorks; VoterStrip returns null when staged).
 *
 * Stays shell-agnostic via the --po-* contract; works in Pulse / Vivid /
 * Classic / Immersive, with the staged variant exclusive to Pulse.
 */
export function VotingShell({ accentColor, header, engagement, children }: VotingShellProps) {
  const { staged } = useCartridgeStage();
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        margin: staged ? 0 : '10px 0',
        borderRadius: 18,
        overflow: 'hidden',
        background: `linear-gradient(180deg, color-mix(in oklch, ${accentColor} 8%, var(--po-bg-panel, rgba(0,0,0,0.3))) 0%, var(--po-bg-panel, rgba(0,0,0,0.3)) 60%)`,
        boxShadow: [
          // Colored inner-glow picks up the mechanism accent (replaces generic drop-shadow)
          `inset 0 0 0 1px color-mix(in oklch, ${accentColor} 26%, transparent)`,
          `inset 0 24px 48px -24px color-mix(in oklch, ${accentColor} 28%, transparent)`,
          `0 8px 28px -8px color-mix(in oklch, ${accentColor} 18%, transparent)`,
        ].join(', '),
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
        {engagement}
        {children}
      </div>
    </motion.div>
  );
}

/**
 * Small centered note for ineligibility messaging — replaces the legacy
 * font-mono "You are not eligible to vote" used across cartridges.
 * Body font, dim color, named reason.
 */
export function IneligibleNote({ reason }: { reason: string }) {
  return (
    <p
      style={{
        fontFamily: 'var(--po-font-body)',
        fontSize: 12,
        color: 'var(--po-text-dim)',
        textAlign: 'center',
        margin: 0,
        lineHeight: 1.4,
      }}
    >
      {reason}
    </p>
  );
}
