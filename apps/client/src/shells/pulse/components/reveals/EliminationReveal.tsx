import { useEffect, useMemo, useRef } from 'react';
import { VOTE_TYPE_INFO, type VoteType } from '@pecking-order/shared-types';
import { useGameStore } from '../../../../store/useGameStore';
import { useRevealQueue } from '../../hooks/useRevealQueue';
import { PULSE_Z } from '../../zIndex';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { MECHANISM_NARRATOR_LINES, pickLine, renderLine } from './reveal-config';

/**
 * Full-bleed elimination overlay — dramatic interlude when the player opens the
 * game after a push notification. Desaturation is driven by CSS (stable across
 * HMR) rather than framer-motion's animate prop (which has been flaky here).
 *
 * Pairs with the chat EventCard via View Transitions API: both portraits share
 * `view-transition-name: elim-portrait-${playerId}` so the photo morphs from
 * full-bleed to the 72px chat thumbnail on dismiss.
 *
 * Per design direction: goal is drama, not detail — the voting cartridge's
 * VotingResultHero handles tally + who-voted-whom when the player taps in.
 */
export function EliminationReveal() {
  const roster = useGameStore(s => s.roster);
  const manifest = useGameStore(s => s.manifest);
  const gameId = useGameStore(s => s.gameId);
  const { current, dismissSpecific } = useRevealQueue();
  const lastDismissAtRef = useRef(0);

  const isShowing = current?.kind === 'elimination';

  function handleDismiss() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastDismissAtRef.current < 300) return;
    lastDismissAtRef.current = now;
    const snapKind = current?.kind;
    const snapDay = current?.dayIndex;
    if (snapKind !== 'elimination' || snapDay == null) return;
    const apply = () => dismissSpecific(snapKind, snapDay);
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(apply);
    } else {
      apply();
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

  // FINALS runner-up eliminations are auto-dismissed so the queue advances to
  // the winner reveal. The "Crowned" label + empty eliminatedSubtitle make no
  // sense for a non-winner finalist.
  useEffect(() => {
    if (!isShowing) return;
    if (!current || current.kind !== 'elimination' || current.dayIndex == null) return;
    const vt = manifest?.days?.[current.dayIndex - 1]?.voteType;
    if (vt === 'FINALS') dismissSpecific(current.kind, current.dayIndex);
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
    <div
      data-testid="elimination-reveal"
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      aria-label={`${player.personaName} — ${info.revealLabel}. ${info.eliminatedSubtitle}`}
      onClick={handleDismiss}
      className="pulse-reveal-enter"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: PULSE_Z.reveal,
        cursor: 'pointer',
        overflow: 'hidden',
        background: 'var(--pulse-bg)',
      }}
    >
      {/* Full-bleed portrait — desaturates via CSS animation on the class below. */}
      <div
        className="pulse-reveal-portrait"
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
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* Dim wash — photo carries mood, this keeps text legible. */}
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
        <p
          className="pulse-reveal-narrator"
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
        </p>
        <p
          className="pulse-reveal-subtitle"
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
        </p>
      </div>
    </div>
  );
}
