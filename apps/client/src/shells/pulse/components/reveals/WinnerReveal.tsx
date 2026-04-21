import { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { VOTE_TYPE_INFO, type VoteType } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../../hooks/useRevealQueue';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z } from '../../zIndex';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { Crown } from '../../icons';
import { WINNER_NARRATOR_LINES, pickLine, renderLine } from './reveal-config';

/**
 * Full-bleed winner overlay — euphoric finale. Winner's photo fills the viewport
 * with a warm gold tint layer. Phosphor Crown lands on the avatar at +300ms.
 * Confetti fires once on reveal.
 *
 * Pairs with the chat EventCard via View Transitions API: overlay portrait and
 * card portrait share `view-transition-name: winner-portrait-${playerId}` so the
 * photo morphs on dismiss.
 */
export function WinnerReveal() {
  const winner = useGameStore(s => s.winner);
  const roster = useGameStore(s => s.roster);
  const manifest = useGameStore(s => s.manifest);
  const gameId = useGameStore(s => s.gameId);
  const { current, dismissSpecific } = useRevealQueue();
  const confettiFired = useRef(false);
  const reduce = useReducedMotion();
  const lastDismissAtRef = useRef(0);

  const showing = current?.kind === 'winner' && !!winner;

  function handleDismiss() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastDismissAtRef.current < 300) return;
    lastDismissAtRef.current = now;
    const snapKind = current?.kind;
    const snapDay = current?.dayIndex;
    if (snapKind !== 'winner') return;
    const apply = () => dismissSpecific(snapKind, snapDay);
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(apply);
    } else {
      apply();
    }
  }

  useEffect(() => {
    if (showing && !confettiFired.current && !reduce) {
      confettiFired.current = true;
      import('canvas-confetti')
        .then(mod => {
          const confetti = mod.default;
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
        })
        .catch(() => {});
    }
  }, [showing, reduce]);

  useEffect(() => {
    if (!showing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showing]);

  const resolved = useMemo(() => {
    if (!showing || !winner) return null;
    const player = roster[winner.playerId];
    if (!player) return null;
    const playerIndex = Object.keys(roster).indexOf(winner.playerId);
    const days = manifest?.days ?? [];
    const voteType = (days[days.length - 1]?.voteType ?? 'FINALS') as VoteType;
    const info = VOTE_TYPE_INFO[voteType];
    const seed = `${gameId}:winner:${winner.playerId}`;
    const line = renderLine(pickLine(WINNER_NARRATOR_LINES, seed), player.personaName || '—');
    return { winnerId: winner.playerId, player, playerIndex, info, line };
  }, [showing, winner, roster, manifest, gameId]);

  if (!showing || !resolved) return null;
  const { winnerId, player, playerIndex, info, line } = resolved;
  const vtName = `winner-portrait-${winnerId}`;
  const accentColor = getPlayerColor(playerIndex);

  return (
    <AnimatePresence>
      <motion.div
        data-testid="winner-reveal"
        role="dialog"
        aria-modal="true"
        aria-live="polite"
        aria-label={`${player.personaName} wins. ${info.winnerSubtitle ?? ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: PULSE_Z.reveal,
          cursor: 'pointer',
          overflow: 'hidden',
          background: 'var(--pulse-bg)',
        }}
      >
        {/* Full-bleed portrait — no desaturation, just a gentle entry. */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0.3 : 0.8, ease: [0.2, 0.9, 0.3, 1] }}
          style={{
            position: 'absolute',
            inset: 0,
            viewTransitionName: vtName,
          } as React.CSSProperties}
        >
          <PersonaImage
            avatarUrl={player.avatarUrl}
            cacheKey={winnerId}
            preferredVariant="full"
            fallbackChain={['medium', 'headshot']}
            initials={(player.personaName || '?').slice(0, 1).toUpperCase()}
            playerColor={accentColor}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </motion.div>

        {/* Warm gold tint — derives from --pulse-gold, subtle at top, building at bottom. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 60% at 50% 38%, transparent 0%, transparent 45%, rgba(10,10,14,0.35) 100%), linear-gradient(180deg, rgba(10,10,14,0.25) 0%, transparent 40%, color-mix(in oklch, var(--pulse-gold) 18%, transparent) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Phosphor Crown — drops in at +300ms with a spring bounce. */}
        <motion.div
          aria-hidden
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -44, scale: 1.3 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={
            reduce
              ? { duration: 0.3, delay: 0.2 }
              : { ...PULSE_SPRING.bouncy, delay: 0.3 }
          }
          style={{
            position: 'absolute',
            top: '18%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: 'var(--pulse-gold)',
            filter: 'drop-shadow(0 0 24px var(--pulse-gold-glow))',
            pointerEvents: 'none',
          }}
        >
          <Crown size={88} weight="fill" />
        </motion.div>

        {/* Narrator copy block — lower third. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '0 32px 56px',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0.3 : 0.5, ease: [0.2, 0.9, 0.3, 1] }}
            style={{
              fontFamily: 'var(--po-font-body)',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--pulse-gold)',
              margin: '0 0 12px',
              textShadow: '0 1px 12px rgba(0,0,0,0.5)',
            }}
          >
            champion
          </motion.p>
          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0.4 : 0.6, ease: [0.2, 0.9, 0.3, 1] }}
            style={{
              fontFamily: 'var(--po-font-display)',
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1.12,
              letterSpacing: '-0.015em',
              color: 'var(--pulse-text-1)',
              margin: 0,
              textShadow: '0 2px 24px rgba(0,0,0,0.6)',
            }}
          >
            {line}
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
