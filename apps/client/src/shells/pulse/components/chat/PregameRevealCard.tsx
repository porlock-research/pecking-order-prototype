import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';

interface Props {
  /** ID of the player who revealed. */
  actorId: string;
  question: string;
  answer: string;
}

/**
 * Bespoke pregame reveal — distinct visual identity from NarratorLine
 * (whisper intrigue). Reveals are the single arrival beat per player and
 * the only way to learn anything substantive about a cast member, since
 * the dossier defaults to sealed answers.
 *
 * Treatment: portrait-led card, display-font question label in pink
 * tracked-caps, large quote in display weight, attribution row, single
 * ignition beat on entry. "ON THE RECORD" eyebrow positions it as a
 * magazine quote moment — not a passing line.
 */
export function PregameRevealCard({ actorId, question, answer }: Props) {
  const player = useGameStore(s => s.roster[actorId]);
  const playerIndex = useGameStore(s => Object.keys(s.roster).indexOf(actorId));

  if (!player) return null;
  const portraitColor = getPlayerColor(playerIndex >= 0 ? playerIndex : 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={PULSE_SPRING.pop}
      style={{
        flexShrink: 0,
        margin: '14px 12px',
        padding: '18px 20px 16px',
        borderRadius: 'var(--pulse-radius-lg)',
        background: 'linear-gradient(180deg, color-mix(in oklch, var(--pulse-accent) 11%, var(--pulse-surface)) 0%, var(--pulse-surface) 100%)',
        border: '1px solid color-mix(in oklch, var(--pulse-accent) 28%, transparent)',
        boxShadow: '0 14px 36px -16px color-mix(in oklch, var(--pulse-accent) 60%, transparent), inset 0 1px 0 color-mix(in oklch, var(--pulse-accent) 18%, transparent)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Eyebrow — "ON THE RECORD" tracked-caps, pink. Magazine-quote framing;
          the card's own presence is the arrival beat now (the separate
          PregameJoinLine was dropped to consolidate the two-beat pattern
          into a single message). */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
      }}>
        <span style={{
          width: 18, height: 1,
          background: 'var(--pulse-accent)',
        }} />
        <span style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--pulse-accent)',
        }}>
          On the record
        </span>
      </div>

      {/* The question label — small, tracked-caps. Uses a pink-tinted neutral
          (accent-mixed text-3) instead of plain text-3 so it reads as part of
          the magazine card's color family rather than gray-on-color. */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'color-mix(in oklch, var(--pulse-accent) 45%, var(--pulse-text-3))',
        marginBottom: 8,
      }}>
        {question}
      </div>

      {/* The quote — display font, larger, leading quotation mark */}
      <blockquote style={{
        margin: 0,
        padding: 0,
        fontFamily: 'var(--po-font-display)',
        fontSize: 'clamp(20px, 4.4vw, 26px)',
        fontWeight: 600,
        lineHeight: 1.18,
        letterSpacing: '-0.01em',
        color: 'var(--pulse-text-1)',
        position: 'relative',
        paddingLeft: 18,
      }}>
        <span aria-hidden style={{
          position: 'absolute',
          left: -2,
          top: -10,
          fontSize: 38,
          fontFamily: 'var(--po-font-display)',
          fontWeight: 700,
          color: 'var(--pulse-accent)',
          opacity: 0.55,
          lineHeight: 1,
        }}>“</span>
        {answer}
      </blockquote>

      {/* Attribution row — portrait + name, bottom-right */}
      <div style={{
        marginTop: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 10,
      }}>
        <span style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--pulse-text-2)',
        }}>
          — {player.personaName}
        </span>
        <PersonaImage
          avatarUrl={player.avatarUrl}
          cacheKey={player.id}
          preferredVariant="headshot"
          initials={player.personaName.slice(0, 1).toUpperCase()}
          playerColor={portraitColor}
          alt=""
          style={{
            width: 28, height: 28, borderRadius: 'var(--pulse-radius-sm)',
            objectFit: 'cover',
            border: `1.5px solid ${portraitColor}`,
            flexShrink: 0,
          }}
        />
      </div>
    </motion.div>
  );
}
