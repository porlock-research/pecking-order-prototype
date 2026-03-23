import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.25, delayChildren: 0.1 } },
};

const slideUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

interface RetryDecisionScreenProps {
  result: Record<string, number> | null;
  silverReward: number;
  goldReward: number;
  previousResult: Record<string, number> | null;
  previousSilverReward: number;
  retryCount: number;
  onSubmit: () => void;
  onRetry: () => void;
  renderBreakdown?: (result: Record<string, number>) => ReactNode;
}

export function RetryDecisionScreen({
  result,
  silverReward,
  previousResult,
  previousSilverReward,
  retryCount,
  onSubmit,
  onRetry,
  renderBreakdown,
}: RetryDecisionScreenProps) {
  return (
    <motion.div
      className="p-5 space-y-5"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Score Breakdown */}
      {result && renderBreakdown && (
        <motion.div variants={slideUp}>{renderBreakdown(result)}</motion.div>
      )}

      {/* Silver Earned */}
      <motion.div variants={slideUp} className="text-center py-2">
        <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-1">Silver Earned</p>
        <p className="text-4xl font-bold font-mono text-skin-gold">
          +{silverReward} silver
        </p>
      </motion.div>

      {/* Previous comparison */}
      {previousResult && (
        <motion.div variants={slideUp} className="text-center">
          <div className="inline-block px-5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02]">
            <p className="text-xs font-mono text-skin-dim uppercase tracking-widest mb-1">Comparison</p>
            <p className="text-sm font-mono text-skin-base">
              <span className="text-skin-dim">Previous: </span>
              <span>{previousSilverReward}</span>
              <span className="text-skin-dim mx-2">&rarr;</span>
              <span className="text-skin-dim">Current: </span>
              <span className={silverReward > previousSilverReward ? 'text-skin-green' : silverReward < previousSilverReward ? 'text-skin-danger' : ''}>
                {silverReward}
              </span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Submit button (primary) */}
      <motion.div variants={slideUp} className="text-center pt-1">
        <button
          onClick={onSubmit}
          className="w-full max-w-xs px-8 py-3 bg-skin-gold text-skin-inverted font-bold text-sm uppercase tracking-wider rounded-lg hover:brightness-110 active:scale-[0.97] transition-all btn-press shadow-lg"
        >
          Submit Score
        </button>
        <p className="text-[10px] font-mono text-skin-dim mt-1.5 uppercase tracking-widest">This is final</p>
      </motion.div>

      {/* Retry button (secondary) */}
      <motion.div variants={slideUp} className="text-center">
        <button
          onClick={onRetry}
          className="px-8 py-2.5 text-xs font-bold uppercase tracking-wider text-skin-dim border border-white/[0.08] rounded-lg hover:bg-white/[0.04] hover:text-skin-base transition-colors"
        >
          Play Again (attempt {retryCount + 2})
        </button>
      </motion.div>
    </motion.div>
  );
}
