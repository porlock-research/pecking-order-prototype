import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../store/useGameStore';
import { VIVID_SPRING } from '../springs';

function getPhaseDisplayName(serverState: unknown): string | null {
  if (!serverState || typeof serverState !== 'string') return null;
  const s = serverState.toLowerCase();
  if (s.includes('morningbriefing')) return 'MORNING BRIEFING';
  if (s.includes('socialperiod') || s.includes('dmperiod')) return 'SOCIAL HOUR';
  if (s.includes('game')) return 'GAME TIME';
  if (s.includes('prompt') || s.includes('activity')) return 'ACTIVITY';
  if (s.includes('voting')) return 'VOTING';
  if (s.includes('nightsummary')) return 'ELIMINATION';
  if (s.includes('gamesummary') || s.includes('gameover')) return 'FINALE';
  return null;
}

export function PhaseTransitionSplash() {
  const serverState = useGameStore(s => s.serverState);
  const [visible, setVisible] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const prevStateRef = useRef<unknown>(serverState);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      prevStateRef.current = serverState;
      return;
    }

    if (serverState !== prevStateRef.current) {
      prevStateRef.current = serverState;
      const name = getPhaseDisplayName(serverState);
      if (name) {
        setDisplayName(name);
        setVisible(true);
        const timer = setTimeout(() => setVisible(false), 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [serverState]);

  return (
    <AnimatePresence>
      {visible && displayName && (
        <motion.div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle, var(--vivid-phase-glow) 0%, rgba(0,0,0,0.85) 100%)',
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--vivid-phase-accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              textShadow: '0 0 40px var(--vivid-phase-glow)',
              textAlign: 'center',
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={VIVID_SPRING.dramatic}
          >
            {displayName}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
