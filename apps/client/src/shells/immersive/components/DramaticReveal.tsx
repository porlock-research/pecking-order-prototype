import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGameStore } from '../../../store/useGameStore';
import { PlayerStatuses } from '@pecking-order/shared-types';
import { Skull, Crown } from 'lucide-react';
import { SPRING } from '../springs';

interface Reveal {
  kind: 'elimination' | 'winner';
  playerId: string;
  playerName: string;
  goldAmount?: number;
}

function getStorageKey(gameId: string) {
  return `po-reveals-${gameId}`;
}

function getSeenIds(gameId: string): { eliminations: string[]; winner: string | null } {
  try {
    const raw = localStorage.getItem(getStorageKey(gameId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { eliminations: [], winner: null };
}

function markSeen(gameId: string, reveal: Reveal) {
  const seen = getSeenIds(gameId);
  if (reveal.kind === 'elimination') {
    if (!seen.eliminations.includes(reveal.playerId)) {
      seen.eliminations.push(reveal.playerId);
    }
  } else {
    seen.winner = reveal.playerId;
  }
  localStorage.setItem(getStorageKey(gameId), JSON.stringify(seen));
}

export function DramaticReveal() {
  const { roster, winner, gameId, playerId } = useGameStore();
  const tickerMessages = useGameStore(s => s.tickerMessages);
  const [queue, setQueue] = useState<Reveal[]>([]);
  const [current, setCurrent] = useState<Reveal | null>(null);

  // Build list of eliminated player IDs from roster
  const eliminatedIds = useMemo(() =>
    Object.values(roster)
      .filter(p => p.status === PlayerStatuses.ELIMINATED)
      .map(p => p.id),
    [roster]
  );

  // Check for unseen reveals on roster changes (handles async sync)
  useEffect(() => {
    if (!gameId) return;
    const seen = getSeenIds(gameId);
    const newReveals: Reveal[] = [];

    // Check eliminations
    for (const pid of eliminatedIds) {
      if (!seen.eliminations.includes(pid) && pid !== playerId) {
        newReveals.push({
          kind: 'elimination',
          playerId: pid,
          playerName: roster[pid]?.personaName || 'Unknown',
        });
      }
    }

    // Check winner
    if (winner && seen.winner !== winner.playerId) {
      const goldPayouts = (useGameStore.getState() as any).goldPayouts;
      const payout = goldPayouts?.find?.((p: any) => p.playerId === winner.playerId);
      newReveals.push({
        kind: 'winner',
        playerId: winner.playerId,
        playerName: roster[winner.playerId]?.personaName || 'Unknown',
        goldAmount: payout?.amount,
      });
    }

    if (newReveals.length > 0) {
      setQueue(prev => {
        // Don't re-add reveals already in queue
        const existingIds = new Set(prev.map(r => `${r.kind}-${r.playerId}`));
        const unique = newReveals.filter(r => !existingIds.has(`${r.kind}-${r.playerId}`));
        return [...prev, ...unique];
      });
    }
  }, [eliminatedIds, winner, gameId, playerId, roster]);

  // Also check live ticker for ELIMINATION / WINNER_DECLARED events
  useEffect(() => {
    if (!gameId) return;
    const last = tickerMessages[tickerMessages.length - 1];
    if (!last) return;

    if (last.category === 'ELIMINATION') {
      const seen = getSeenIds(gameId);
      // Extract player name from ticker text — best effort
      // The sync-based detection above is more reliable
    }
  }, [tickerMessages, gameId]);

  // Dequeue reveals
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [queue, current]);

  const dismiss = useCallback(() => {
    if (current && gameId) {
      markSeen(gameId, current);
    }
    setCurrent(null);
  }, [current, gameId]);

  // Auto-dismiss eliminations after 3s
  useEffect(() => {
    if (!current || current.kind === 'winner') return;
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, [current, dismiss]);

  // Fire confetti for winner
  useEffect(() => {
    if (current?.kind !== 'winner') return;
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ['#fbbf24', '#f59e0b', '#d97706'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#fbbf24', '#f59e0b', '#d97706'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          {current.kind === 'elimination' ? (
            <motion.div
              className="relative flex flex-col items-center gap-4 px-8"
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                x: [0, -3, 3, -2, 2, 0],
              }}
              transition={{
                scale: SPRING.bouncy,
                x: { duration: 0.3, delay: 0.2, ease: 'linear' },
              }}
            >
              <motion.div
                className="w-24 h-24 rounded-full bg-skin-danger/20 flex items-center justify-center"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(239,68,68,0.3)',
                    '0 0 60px rgba(239,68,68,0.6)',
                    '0 0 20px rgba(239,68,68,0.3)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Skull size={48} className="text-skin-danger" />
              </motion.div>
              <motion.h2
                className="text-2xl font-black font-display text-white text-center"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {current.playerName}
              </motion.h2>
              <motion.p
                className="text-sm font-bold text-skin-danger uppercase tracking-[0.3em] font-display"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Has Been Eliminated
              </motion.p>
              <motion.p
                className="text-xs text-skin-dim mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Tap to dismiss
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              className="relative flex flex-col items-center gap-4 px-8"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={SPRING.bouncy}
            >
              <motion.div
                className="w-28 h-28 rounded-full bg-skin-gold/20 flex items-center justify-center"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(251,191,36,0.3)',
                    '0 0 80px rgba(251,191,36,0.6)',
                    '0 0 20px rgba(251,191,36,0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Crown size={56} className="text-skin-gold" />
              </motion.div>
              <motion.h2
                className="text-3xl font-black font-display text-skin-gold text-center text-glow"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {current.playerName}
              </motion.h2>
              <motion.p
                className="text-sm font-bold text-white uppercase tracking-[0.3em] font-display"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Wins Pecking Order
              </motion.p>
              {current.goldAmount != null && current.goldAmount > 0 && (
                <motion.div
                  className="flex items-center gap-2 mt-2 px-4 py-2 rounded-full bg-skin-gold/20 border border-skin-gold/40"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, ...SPRING.bouncy }}
                >
                  <span className="font-mono font-bold text-skin-gold text-xl gold-glow">
                    +{current.goldAmount}
                  </span>
                  <span className="text-sm text-skin-gold/70">gold</span>
                </motion.div>
              )}
              <motion.p
                className="text-xs text-skin-dim mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
              >
                Tap to dismiss
              </motion.p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
