import React from 'react';
import { motion } from 'framer-motion';
import { SPRING } from '../springs';

interface CartridgeWrapperProps {
  kind: 'voting' | 'game' | 'prompt';
  children: React.ReactNode;
}

const GLOW_COLORS: Record<string, string> = {
  voting: 'rgba(251, 191, 36, 0.20)',
  game: 'rgba(16, 185, 129, 0.20)',
  prompt: 'rgba(236, 72, 153, 0.20)',
};

const BORDER_COLORS: Record<string, string> = {
  voting: 'border-skin-gold/20',
  game: 'border-skin-green/20',
  prompt: 'border-skin-pink/20',
};

export function CartridgeWrapper({ kind, children }: CartridgeWrapperProps) {
  const glowColor = GLOW_COLORS[kind];
  const borderColor = BORDER_COLORS[kind];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={SPRING.bouncy}
      className={`rounded-2xl border ${borderColor} overflow-hidden backdrop-blur-sm`}
      style={{
        animation: 'glow-breathe 3s ease-in-out infinite',
        boxShadow: `0 0 12px ${glowColor}`,
      }}
    >
      {children}
    </motion.div>
  );
}
