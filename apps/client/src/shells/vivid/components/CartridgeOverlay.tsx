import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGameStore } from '../../../store/useGameStore';
import VotingPanel from '../../../components/panels/VotingPanel';
import GamePanel from '../../../components/panels/GamePanel';
import PromptPanel from '../../../components/panels/PromptPanel';
import { ChatPeek } from './ChatPeek';
import { VIVID_SPRING } from '../springs';

interface CartridgeOverlayProps {
  engine: any;
  chatPeekContent: React.ReactNode; // The StageChat component to show in the peek sheet
}

export function CartridgeOverlay({ engine, chatPeekContent }: CartridgeOverlayProps) {
  const activeVotingCartridge = useGameStore((s) => s.activeVotingCartridge);
  const activeGameCartridge = useGameStore((s) => s.activeGameCartridge);
  const activePromptCartridge = useGameStore((s) => s.activePromptCartridge);

  const isActive = !!(activeVotingCartridge || activeGameCartridge || activePromptCartridge);

  // Track previous active state to fire confetti only on entrance
  const wasActive = useRef(false);
  useEffect(() => {
    if (isActive && !wasActive.current) {
      // Fire a subtle confetti burst from bottom center on entrance
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { x: 0.5, y: 1 },
        colors: ['#FFD93D', '#FF6B6B', '#4ECDC4'],
        startVelocity: 25,
        gravity: 0.8,
        ticks: 60,
        disableForReducedMotion: true,
      });
    }
    wasActive.current = isActive;
  }, [isActive]);

  // Determine which panel to render
  let cartridgeContent: React.ReactNode = null;
  if (activeVotingCartridge) {
    cartridgeContent = <VotingPanel engine={engine} />;
  } else if (activeGameCartridge) {
    cartridgeContent = <GamePanel engine={engine} />;
  } else if (activePromptCartridge) {
    cartridgeContent = <PromptPanel engine={engine} />;
  }

  return (
    <AnimatePresence>
      {isActive && (
        <>
          {/* Semi-transparent backdrop */}
          <motion.div
            key="cartridge-backdrop"
            className="fixed inset-0 z-30"
            style={{ background: 'rgba(0, 0, 0, 0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />

          {/* Cartridge container — fills ~85% from bottom */}
          <motion.div
            key="cartridge-container"
            className="fixed left-0 right-0 bottom-0 z-30"
            style={{
              height: '85dvh',
              borderRadius: '24px 24px 0 0',
              background: 'var(--vivid-bg-surface)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
            initial={{ scale: 0.85, opacity: 0, y: 100 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 100 }}
            transition={VIVID_SPRING.dramatic}
          >
            {cartridgeContent}
          </motion.div>

          {/* ChatPeek floating button */}
          <ChatPeek>{chatPeekContent}</ChatPeek>
        </>
      )}
    </AnimatePresence>
  );
}
