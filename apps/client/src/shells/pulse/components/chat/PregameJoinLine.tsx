import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';

interface Props {
  /** ID of the player who just joined the cast. */
  actorId: string;
}

/**
 * Bespoke pregame "joined the cast" line — distinct from NarratorLine
 * intrigue (whisper-tier, italic, centered) because arrival is a signature
 * social moment, not a rumour. Asymmetric, gold-accented, display-typed,
 * portrait-led. Single ignition beat on entry, then settles.
 *
 * Reads no server data — caller passes the actorId; all rendering data
 * comes from roster (avatar, persona name) which is already loaded.
 */
export function PregameJoinLine({ actorId }: Props) {
  const player = useGameStore(s => s.roster[actorId]);
  const playerIndex = useGameStore(s => Object.keys(s.roster).indexOf(actorId));

  if (!player) return null;
  const portraitColor = getPlayerColor(playerIndex >= 0 ? playerIndex : 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={PULSE_SPRING.pop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        position: 'relative',
      }}
    >
      {/* Portrait — gold-ringed, square-ish radius for the reality-TV title-card feel.
          Subtle fade-in glow seats the moment without becoming decorative motion. */}
      <motion.div
        initial={{ boxShadow: '0 0 0 0 var(--pulse-gold)' }}
        animate={{ boxShadow: '0 0 0 0 transparent' }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: 32, height: 32, borderRadius: 8,
          flexShrink: 0,
          border: '1.5px solid var(--pulse-gold)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <PersonaImage
          avatarUrl={player.avatarUrl}
          cacheKey={player.id}
          preferredVariant="headshot"
          initials={player.personaName.slice(0, 1).toUpperCase()}
          playerColor={portraitColor}
          alt=""
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
          }}
        />
      </motion.div>

      {/* Name + body — display weight on the name, italic muted on the verb.
          Single line, baseline-aligned. */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        flexShrink: 1,
        minWidth: 0,
      }}>
        <span style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--pulse-gold)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {player.personaName}
        </span>
        <span aria-hidden style={{
          color: 'var(--pulse-text-3)',
          opacity: 0.4,
          fontSize: 12,
        }}>·</span>
        <span style={{
          fontSize: 12,
          fontStyle: 'italic',
          color: 'var(--pulse-text-3)',
          letterSpacing: 0.2,
        }}>
          joined the cast
        </span>
      </div>

      {/* Trailing rule — gold gradient that fades to transparent. Anchors
          the asymmetric composition without competing with the portrait. */}
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          minWidth: 16,
          background: 'linear-gradient(to right, color-mix(in oklch, var(--pulse-gold) 35%, transparent), transparent)',
        }}
      />
    </motion.div>
  );
}
