import { motion, useReducedMotion } from 'framer-motion';
import { VOTE_TYPE_INFO, type VoteType } from '@pecking-order/shared-types';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { Crown } from '../../icons';
import { MECHANISM_ICON, MECHANISM_ACCENT } from '../reveals/reveal-config';

interface PlayerLike {
  id: string;
  personaName: string;
  avatarUrl: string | undefined;
}

interface EventCardProps {
  kind: 'elimination' | 'winner';
  player: PlayerLike;
  /** 0-based index into the roster for deterministic player color. */
  playerIndex: number;
  dayIndex: number;
  voteType: VoteType;
}

/**
 * Dramatic event card rendered inline in the Pulse chat feed when an
 * ELIMINATION or PHASE_WINNER ticker arrives. Grammar extends the quiet
 * NarratorLine (accent-tinted hairlines framing centred content) at ~4x
 * scale — persona photo as anchor, mechanism kicker, Clash Display name,
 * mechanism subtitle. Persistent on scrollback: days later this is the
 * day's event marker in the chat history.
 *
 * Paired with the full-bleed EliminationReveal / WinnerReveal overlays
 * via View Transitions API: overlay portrait and card portrait share a
 * `view-transition-name` so the photo morphs on overlay dismiss.
 */
export function EventCard({ kind, player, playerIndex, dayIndex, voteType }: EventCardProps) {
  const reduce = useReducedMotion();
  // FINALS emits an ELIMINATION fact for every runner-up (non-winner finalist)
  // in addition to the single PHASE_WINNER fact for the crown. Rendering those
  // runner-up eliminations with VOTE_TYPE_INFO.FINALS.revealLabel ("Crowned")
  // is nonsense — only one player is crowned. The PHASE_WINNER card already
  // marks the finale; suppress the runner-up cards.
  if (kind === 'elimination' && voteType === 'FINALS') return null;
  const info = VOTE_TYPE_INFO[voteType];
  const accent = MECHANISM_ACCENT[voteType];
  const Icon = MECHANISM_ICON[voteType];
  const isWinner = kind === 'winner';

  const subtitle = isWinner ? (info.winnerSubtitle || '') : info.eliminatedSubtitle;
  const label = info.revealLabel;
  const vtName = `${isWinner ? 'winner' : 'elim'}-portrait-${player.id}`;

  return (
    <motion.div
      data-testid={`event-card-${kind}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.2, ease: [0.2, 0.9, 0.3, 1] }}
      style={{
        margin: '12px 12px',
        borderRadius: 'var(--pulse-radius-lg)',
        background: `linear-gradient(180deg, color-mix(in oklch, ${accent} 6%, var(--pulse-surface)) 0%, var(--pulse-surface) 72%)`,
        border: `1px solid color-mix(in oklch, ${accent} 28%, transparent)`,
        padding: '20px 18px 18px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Hairlines — accent-tinted, echoing NarratorLine's gradient hairlines at louder scale */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 18,
          right: 18,
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, color-mix(in oklch, ${accent} 60%, transparent) 50%, transparent 100%)`,
          borderRadius: 2,
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 0,
          left: 18,
          right: 18,
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, color-mix(in oklch, ${accent} 60%, transparent) 50%, transparent 100%)`,
          borderRadius: 2,
        }}
      />

      {/* Winner-only corner crown badge */}
      {isWinner && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -10,
            right: -10,
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: 'var(--pulse-surface)',
            border: '2px solid color-mix(in oklch, var(--pulse-gold) 50%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--pulse-gold)',
            boxShadow: '0 0 16px var(--pulse-gold-glow)',
          }}
        >
          <Crown size={18} weight="fill" />
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '72px 1fr',
          gap: 14,
          alignItems: 'center',
        }}
      >
        {/* Persona portrait — desaturated for elim, gold-framed for winner */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 'var(--pulse-radius-md)',
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--pulse-surface-2)',
            boxShadow: isWinner
              ? `0 0 24px var(--pulse-gold-glow), inset 0 0 0 2px color-mix(in oklch, var(--pulse-gold) 46%, transparent)`
              : undefined,
            // View Transitions API — shared-element name with the overlay portrait.
            // The browser morphs photo size/position when the overlay dismisses.
            viewTransitionName: vtName,
          } as React.CSSProperties}
        >
          <PersonaImage
            avatarUrl={player.avatarUrl}
            cacheKey={player.id}
            preferredVariant="headshot"
            initials={(player.personaName || '?').slice(0, 1).toUpperCase()}
            playerColor={getPlayerColor(playerIndex)}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              filter: isWinner ? undefined : 'grayscale(1) contrast(1.02)',
            }}
          />
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              background: isWinner
                ? `radial-gradient(80% 80% at 50% 10%, color-mix(in oklch, var(--pulse-gold) 34%, transparent), transparent 70%)`
                : `radial-gradient(80% 80% at 50% 0%, color-mix(in oklch, ${accent} 28%, transparent), transparent 70%)`,
              mixBlendMode: 'screen',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 2 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--po-font-display)',
              fontWeight: 600,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: isWinner
                ? 'var(--pulse-gold)'
                : `color-mix(in oklch, ${accent} 88%, var(--pulse-text-1))`,
              lineHeight: 1.1,
            }}
          >
            <Icon size={14} weight="fill" />
            <span>{label}</span>
            <span style={{ color: 'var(--pulse-text-4)', fontWeight: 500, letterSpacing: 0 }}>•</span>
            <span>Day {dayIndex}</span>
          </div>
          <div
            style={{
              fontFamily: 'var(--po-font-display)',
              fontWeight: 700,
              fontSize: 34,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: 'var(--pulse-text-1)',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {player.personaName}
          </div>
          {subtitle && (
            <div
              style={{
                fontFamily: 'var(--po-font-body)',
                fontWeight: 500,
                fontSize: 13,
                fontStyle: 'italic',
                color: 'var(--pulse-text-2)',
                marginTop: 4,
                letterSpacing: 0.1,
                lineHeight: 1.35,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
