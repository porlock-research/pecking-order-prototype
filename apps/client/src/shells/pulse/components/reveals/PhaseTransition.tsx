import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { PULSE_SPRING } from '../../springs';
import type { DayPhase } from '@pecking-order/shared-types';

const PHASE_DISPLAY: Record<string, { icon: string; title: string; subtitle: string }> = {
  pregame: { icon: '🎬', title: 'Get Ready', subtitle: 'The game is about to begin' },
  morning: { icon: '☀️', title: 'Morning', subtitle: 'A new day begins' },
  social: { icon: '💬', title: 'Social Time', subtitle: 'Chat, strategize, make alliances' },
  voting: { icon: '🗳️', title: 'Voting Time', subtitle: 'Cast your vote' },
  game: { icon: '🎮', title: 'Game Time', subtitle: 'Time to play' },
  activity: { icon: '📝', title: 'Activity', subtitle: 'Share your thoughts' },
  elimination: { icon: '🌙', title: 'Night', subtitle: 'The results are in...' },
  finale: { icon: '🏆', title: 'Finale', subtitle: 'And the winner is...' },
  game_over: { icon: '🎉', title: 'Game Over', subtitle: 'Thanks for playing!' },
};

export function PhaseTransition() {
  const phase = useGameStore(s => s.phase);
  const [visible, setVisible] = useState(false);
  const [display, setDisplay] = useState<{ icon: string; title: string; subtitle: string } | null>(null);
  const prevPhaseRef = useRef<DayPhase | null>(null);

  useEffect(() => {
    if (prevPhaseRef.current && phase !== prevPhaseRef.current) {
      const d = PHASE_DISPLAY[phase];
      if (d) {
        setDisplay(d);
        setVisible(true);
        const t = setTimeout(() => setVisible(false), 3000);
        return () => clearTimeout(t);
      }
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  return (
    <AnimatePresence>
      {visible && display && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={PULSE_SPRING.page}
          onClick={() => setVisible(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(10, 10, 14, 0.85)',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 16 }}>{display.icon}</div>
          <div style={{ fontWeight: 800, fontSize: 28, color: 'var(--pulse-text-1)', fontFamily: 'var(--po-font-display)', marginBottom: 8 }}>
            {display.title}
          </div>
          <div style={{ fontSize: 14, color: 'var(--pulse-text-2)', fontFamily: 'var(--po-font-body)' }}>
            {display.subtitle}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
