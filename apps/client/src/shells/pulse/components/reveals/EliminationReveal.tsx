import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { VOTE_TYPE_INFO, type VoteType } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../../hooks/useRevealQueue';
import { PULSE_Z } from '../../zIndex';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { MECHANISM_NARRATOR_LINES, pickLine, renderLine } from './reveal-config';

/**
 * Full-bleed elimination overlay — dramatic interlude when the player opens the
 * game after a push notification. Photo fills the viewport and desaturates over
 * ~2s. Narrator line and mechanism subtitle fade up on a breathing schedule.
 *
 * Pairs with the chat EventCard via View Transitions API: overlay portrait and
 * card portrait share `view-transition-name: elim-portrait-${playerId}` so the
 * photo morphs from full-bleed down to the 72px chat thumbnail on dismiss.
 *
 * Per design direction: goal is drama, not detail — the voting cartridge's
 * VotingResultHero handles tally + who-voted-whom when the player taps in.
 */
export function EliminationReveal() {
  const roster = useGameStore(s => s.roster);
  const manifest = useGameStore(s => s.manifest);
  const gameId = useGameStore(s => s.gameId);
  const { current, dismiss } = useRevealQueue();
  const reduce = useReducedMotion();

  const isShowing = current?.kind === 'elimination';

  function handleDismiss() {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      // The chat EventCard should already be mounted (ELIMINATION ticker
      // arrived in the same SYNC that surfaced the reveal). Wrap the dismiss
      // so the browser morphs the shared portrait from full-bleed to the
      // card's 72px slot.
      (document as any).startViewTransition(() => dismiss());
    } else {
      dismiss();
    }
  }

  useEffect(() => {
    if (!isShowing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowing]);

  // When a FINALS runner-up elimination gets queued, resolve -> null above
  // (this overlay shouldn't render for non-winner finalists). Auto-dismiss so
  // the queue advances to the winner reveal.
  useEffect(() => {
    if (!isShowing) return;
    if (!current || current.kind !== 'elimination' || current.dayIndex == null) return;
    const vt = manifest?.days?.[current.dayIndex - 1]?.voteType;
    if (vt === 'FINALS') dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShowing, current, manifest]);

  const resolved = useMemo(() => {
    if (!current || current.kind !== 'elimination' || current.dayIndex == null) return null;
    const dayIndex = current.dayIndex;
    const eliminatedId = Object.entries(roster)
      .find(([, p]) => p.status === 'ELIMINATED' && (p as any).eliminatedOnDay === dayIndex)?.[0];
    if (!eliminatedId) return null;
    const player = roster[eliminatedId];
    const playerIndex = Object.keys(roster).indexOf(eliminatedId);
    const voteType = (manifest?.days?.[dayIndex - 1]?.voteType ?? 'MAJORITY') as VoteType;
    // FINALS emits an ELIMINATION fact for each runner-up (non-winner finalist).
    // Rendering an elimination overlay for them uses VOTE_TYPE_INFO.FINALS's
    // "Crowned" revealLabel + empty eliminatedSubtitle + empty narrator pool —
    // all nonsense. The WinnerReveal handles the finale; suppress here.
    if (voteType === 'FINALS') return null;
    const info = VOTE_TYPE_INFO[voteType];
    const lines = MECHANISM_NARRATOR_LINES[voteType] ?? MECHANISM_NARRATOR_LINES.MAJORITY;
    const seed = `${gameId}:${dayIndex}:${eliminatedId}`;
    const line = renderLine(pickLine(lines, seed), player.personaName || '—');
    return { eliminatedId, player, playerIndex, voteType, info, line };
  }, [current, roster, manifest, gameId]);

  if (!isShowing || !resolved) return null;
  const { eliminatedId, player, playerIndex, info, line } = resolved;
  const vtName = `elim-portrait-${eliminatedId}`;
  const accentColor = getPlayerColor(playerIndex);

  return (
    <AnimatePresence>
      <motion.div
        data-testid="elimination-reveal"
        role="dialog"
        aria-modal="true"
        aria-live="assertive"
        aria-label={`${player.personaName} — ${info.revealLabel}. ${info.eliminatedSubtitle}`}
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
        {/* Full-bleed portrait — enters in colour, desaturates over ~1.6s. */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
          animate={
            reduce
              ? { opacity: 1 }
              : {
                  opacity: 1,
                  scale: 1,
                  filter: ['grayscale(0)', 'grayscale(0)', 'grayscale(1)'],
                }
          }
          transition={
            reduce
              ? { duration: 0.3 }
              : {
                  opacity: { duration: 0.4, ease: [0.2, 0.9, 0.3, 1] },
                  scale: { duration: 2.0, ease: [0.2, 0.9, 0.3, 1] },
                  filter: { duration: 2.0, times: [0, 0.2, 1], ease: [0.2, 0.9, 0.3, 1] },
                }
          }
          style={{
            position: 'absolute',
            inset: 0,
            viewTransitionName: vtName,
          } as React.CSSProperties}
        >
          <PersonaImage
            avatarUrl={player.avatarUrl}
            cacheKey={eliminatedId}
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

        {/* Dim wash for text legibility — the photo carries mood. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(10,10,14,0.35) 0%, rgba(10,10,14,0.15) 45%, rgba(10,10,14,0.75) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Narrator copy block — lower third. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: '0 32px 56px',
            textAlign: 'left',
            pointerEvents: 'none',
          }}
        >
          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0.2 : 0.9, ease: [0.2, 0.9, 0.3, 1] }}
            style={{
              fontFamily: 'var(--po-font-display)',
              fontWeight: 600,
              fontSize: 32,
              lineHeight: 1.1,
              letterSpacing: '-0.015em',
              color: 'var(--pulse-text-1)',
              margin: '0 0 16px',
              textShadow: '0 2px 20px rgba(0,0,0,0.45)',
            }}
          >
            {line}
          </motion.p>
          <motion.p
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: reduce ? 0.3 : 1.3, ease: [0.2, 0.9, 0.3, 1] }}
            style={{
              fontFamily: 'var(--po-font-body)',
              fontWeight: 500,
              fontSize: 13,
              color: 'rgba(255,255,255,0.72)',
              letterSpacing: 0.1,
              textShadow: '0 1px 12px rgba(0,0,0,0.5)',
              margin: 0,
            }}
          >
            {info.eliminatedSubtitle}
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
