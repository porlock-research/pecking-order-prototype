import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { AnimatedCounter } from './AnimatedCounter';

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.35, delayChildren: 0.1 } },
};

const slideUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const popIn = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 300, damping: 18 } },
};

interface CelebrationSequenceProps {
  title: string;
  subtitle?: string;
  silverEarned: number;
  goldContribution?: number;
  breakdown?: ReactNode;
  onDismiss?: () => void;
}

export function CelebrationSequence({
  title,
  subtitle,
  silverEarned,
  goldContribution,
  breakdown,
  onDismiss,
}: CelebrationSequenceProps) {
  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#ffd700', '#c0c0c0', '#f472b6'],
    });
  }, []);

  return (
    <motion.div
      className="p-5 space-y-5"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={popIn} className="text-center">
        <p className="text-lg font-bold text-skin-gold uppercase tracking-wider font-display text-glow">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs font-bold text-skin-green uppercase tracking-widest mt-1">
            {subtitle}
          </p>
        )}
      </motion.div>

      {/* Score Breakdown (slot) */}
      {breakdown && <motion.div variants={slideUp}>{breakdown}</motion.div>}

      {/* Silver Total */}
      <motion.div variants={slideUp} className="text-center py-2">
        <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-1">Silver Earned</p>
        <p className="text-4xl font-bold font-mono text-skin-gold text-glow">
          +<AnimatedCounter target={silverEarned} duration={1500} onComplete={fireConfetti} /> silver
        </p>
      </motion.div>

      {/* Gold Contribution */}
      {(goldContribution ?? 0) > 0 && (
        <motion.div variants={slideUp} className="text-center">
          <div className="inline-block px-6 py-3 rounded-lg border border-skin-gold/20 bg-skin-gold/5">
            <p className="text-2xl font-bold font-mono text-skin-gold gold-glow">
              +{goldContribution} GOLD
            </p>
            <p className="text-xs text-skin-gold/70 mt-0.5">added to the pot</p>
          </div>
        </motion.div>
      )}

      {/* Dismiss */}
      {onDismiss && (
        <motion.div variants={slideUp} className="text-center pt-1">
          <button
            onClick={onDismiss}
            className="px-8 py-2.5 text-xs font-bold uppercase tracking-wider text-skin-dim border border-white/[0.08] rounded-lg hover:bg-white/[0.04] hover:text-skin-base transition-colors"
          >
            Done
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
