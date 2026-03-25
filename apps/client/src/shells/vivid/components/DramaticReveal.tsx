import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useGameStore } from '../../../store/useGameStore';
import { PlayerStatuses } from '@pecking-order/shared-types';
import { Danger, Crown } from '@solar-icons/react';
import { VIVID_SPRING } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

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
  } catch (err) {
    console.warn('[DramaticReveal] Failed to parse seen reveals from localStorage:', err);
  }
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
  const roster = useGameStore(s => s.roster);
  const winner = useGameStore(s => s.winner);
  const gameId = useGameStore(s => s.gameId);
  const playerId = useGameStore(s => s.playerId);
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
      if (!seen.eliminations.includes(pid)) {
        newReveals.push({
          kind: 'elimination',
          playerId: pid,
          playerName: roster[pid]?.personaName || 'Unknown',
        });
      }
    }

    // Check winner
    if (winner && seen.winner !== winner.playerId) {
      newReveals.push({
        kind: 'winner',
        playerId: winner.playerId,
        playerName: roster[winner.playerId]?.personaName || 'Unknown',
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
        colors: ['#FFD93D', '#f59e0b', '#d97706'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ['#FFD93D', '#f59e0b', '#d97706'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={dismiss}
        >
          {/* Backdrop */}
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              background: current.kind === 'elimination'
                ? 'radial-gradient(circle, rgba(255,46,99,0.15) 0%, rgba(0,0,0,0.9) 70%)'
                : 'radial-gradient(circle, rgba(255,217,61,0.2) 0%, rgba(0,0,0,0.9) 70%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />

          {current.kind === 'elimination' ? (
            <motion.div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '0 32px',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                x: [0, -3, 3, -2, 2, 0],
              }}
              transition={{
                scale: VIVID_SPRING.dramatic,
                x: { duration: 0.3, delay: 0.2, ease: 'linear' },
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, ...VIVID_SPRING.bouncy }}
              >
                <Danger size={32} weight="BoldDuotone" color="var(--vivid-pink)" />
              </motion.div>

              <motion.div
                style={{ position: 'relative', borderRadius: '50%' }}
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(255,46,99,0.3)',
                    '0 0 60px rgba(255,46,99,0.6)',
                    '0 0 20px rgba(255,46,99,0.3)',
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <PersonaAvatar
                  avatarUrl={roster[current.playerId]?.avatarUrl}
                  personaName={current.playerName}
                  size={96}
                  eliminated
                />
              </motion.div>

              <motion.h2
                style={{ fontFamily: 'var(--vivid-font-display)', color: 'var(--vivid-text)', fontSize: 24, textAlign: 'center', margin: 0 }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <span style={{ fontWeight: 900 }}>
                  {current.playerId === playerId ? 'You' : current.playerName}
                </span>
              </motion.h2>

              <motion.p
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  color: 'var(--vivid-pink)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  margin: 0,
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {current.playerId === playerId ? 'Have Been Eliminated' : 'Has Been Eliminated'}
              </motion.p>

              <motion.p
                style={{ color: 'var(--vivid-text-dim)', fontSize: 12, margin: '8px 0 0' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                Tap to dismiss
              </motion.p>
            </motion.div>
          ) : (
            <motion.div
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '0 32px',
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={VIVID_SPRING.dramatic}
            >
              <motion.div
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,217,61,0.15)',
                }}
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(255,217,61,0.3)',
                    '0 0 80px rgba(255,217,61,0.6)',
                    '0 0 20px rgba(255,217,61,0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Crown size={56} weight="BoldDuotone" color="var(--vivid-gold)" />
              </motion.div>

              <motion.h2
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  color: 'var(--vivid-gold)',
                  fontWeight: 900,
                  fontSize: 28,
                  textAlign: 'center',
                  margin: 0,
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {current.playerName}
              </motion.h2>

              <motion.p
                style={{
                  fontFamily: 'var(--vivid-font-display)',
                  color: 'var(--vivid-text)',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  fontSize: 14,
                  textTransform: 'uppercase',
                  margin: 0,
                }}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Wins Pecking Order
              </motion.p>

              {current.goldAmount != null && current.goldAmount > 0 && (
                <motion.div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 8,
                    padding: '8px 16px',
                    borderRadius: 9999,
                    background: 'rgba(255,217,61,0.15)',
                    border: '1px solid rgba(255,217,61,0.35)',
                  }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, ...VIVID_SPRING.bouncy }}
                >
                  <span
                    style={{ fontFamily: 'var(--vivid-font-mono)', fontSize: 20, color: 'var(--vivid-gold)', fontWeight: 700 }}
                  >
                    +{current.goldAmount}
                  </span>
                  <span
                    style={{ fontSize: 14, color: 'rgba(255,217,61,0.7)' }}
                  >
                    gold
                  </span>
                </motion.div>
              )}

              <motion.p
                style={{ color: 'var(--vivid-text-dim)', fontSize: 12, margin: '16px 0 0' }}
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
