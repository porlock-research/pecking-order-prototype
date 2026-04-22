import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { ArrowLeft, Lock, Sparkle } from '../../icons';
import type { QaEntry } from '@pecking-order/shared-types';

interface Props {
  targetId: string;
  onClose: () => void;
}

/**
 * Pregame Cast Dossier — opens on chip-tap during pregame phase (DMs are
 * closed; regular tap-to-DM has nothing to bind to). Reads roster + pregame
 * slice. v3: reveals are now AUTO-fired by the server when the player first
 * connects (l3-pregame's SYSTEM.PLAYER_CONNECTED handler). The self view no
 * longer offers "Reveal this" pills — the auto-revealed answer renders with
 * the public badge; the other two stay only-you-see-this until Day 1.
 */
export function PregameDossierSheet({ targetId, onClose }: Props) {
  const roster = useGameStore(s => s.roster);
  const pregame = useGameStore(s => s.pregame);
  const { playerId } = usePulse();

  const player = roster[targetId];
  const isSelf = targetId === playerId;
  const playerIndex = useMemo(() => Object.keys(roster).indexOf(targetId), [roster, targetId]);
  const myReveal = pregame?.revealedAnswers?.[targetId] ?? null;
  const qaAnswers: QaEntry[] = (player as any)?.qaAnswers ?? [];

  if (!player) return null;

  const portraitColor = getPlayerColor(playerIndex >= 0 ? playerIndex : 0);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={PULSE_SPRING.exit}
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(5px)', zIndex: backdropFor(PULSE_Z.drawer),
        }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${player.personaName} — Pregame dossier`}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={PULSE_SPRING.page}
        style={{
          position: 'fixed', top: 40, left: 0, right: 0, bottom: 0,
          background: 'var(--pulse-bg)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderTop: '1px solid var(--pulse-border-2)',
          display: 'flex', flexDirection: 'column',
          zIndex: PULSE_Z.drawer, overflowY: 'auto',
        }}
      >
        {/* Header chrome — back button + eyebrow */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--pulse-space-sm)',
          padding: 'var(--pulse-space-md) var(--pulse-space-md) 0',
        }}>
          <button
            onClick={onClose}
            aria-label="Close dossier"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 999,
              background: 'var(--pulse-surface)', color: 'var(--pulse-text-1)',
              border: '1px solid var(--pulse-border)',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={18} weight="fill" />
          </button>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.16em',
            textTransform: 'uppercase', color: 'var(--pulse-accent)',
          }}>
            Pregame Dossier
          </div>
        </div>

        {/* Hero — portrait + name + bio */}
        <section style={{
          padding: 'var(--pulse-space-lg) var(--pulse-space-lg) var(--pulse-space-md)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}>
          <PersonaImage
            avatarUrl={player.avatarUrl}
            cacheKey={player.id}
            preferredVariant="medium"
            fallbackChain={['headshot', 'full']}
            initials={player.personaName.slice(0, 1).toUpperCase()}
            playerColor={portraitColor}
            alt={player.personaName}
            style={{
              width: 132, height: 132, borderRadius: 22,
              objectFit: 'cover',
              border: `2px solid ${portraitColor}`,
              boxShadow: `0 12px 32px -8px ${portraitColor}66`,
            }}
          />
          <h2 style={{
            margin: 'var(--pulse-space-md) 0 0',
            fontFamily: 'var(--po-font-display)',
            fontSize: 'clamp(22px, 5.5vw, 28px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--pulse-text-1)',
          }}>
            {player.personaName}
            {isSelf && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 800,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: 'var(--pulse-accent)', verticalAlign: 'middle',
              }}>You</span>
            )}
          </h2>
          {(player as any).bio && (
            <p style={{
              margin: 'var(--pulse-space-sm) 0 0',
              maxWidth: 420,
              fontSize: 14, lineHeight: 1.5,
              color: 'var(--pulse-text-2)',
              fontStyle: 'italic',
            }}>
              "{(player as any).bio}"
            </p>
          )}
        </section>

        {/* QA — three answers from pre-game interview */}
        {qaAnswers.length > 0 && (
          <section style={{
            padding: '0 var(--pulse-space-md) var(--pulse-space-lg)',
            display: 'flex', flexDirection: 'column', gap: 'var(--pulse-space-sm)',
          }}>
            <h3 style={{
              margin: '0 var(--pulse-space-xs) var(--pulse-space-xs)',
              fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--pulse-text-3)',
            }}>
              Pre-game interview
            </h3>
            {qaAnswers.map((qa, i) => {
              const revealedThis = myReveal?.qIndex === i;
              // Server strips qa.answer for other players' un-revealed slots
              // (sync.ts roster projection). Empty answer = locked-from-this-
              // viewer. Self always sees own answers in full; the "lock" for
              // self entries is a UX framing — the answer hasn't been revealed
              // PUBLICLY, but the player still sees their own.
              const isLockedFromOthers = !isSelf && !qa.answer;
              const isSelfPrivate = isSelf && !revealedThis;
              return (
                <article
                  key={i}
                  style={{
                    padding: 'var(--pulse-space-md)',
                    borderRadius: 14,
                    background: revealedThis
                      ? 'color-mix(in oklch, var(--pulse-accent) 8%, var(--pulse-surface))'
                      : 'var(--pulse-surface)',
                    border: revealedThis
                      ? '1px solid color-mix(in oklch, var(--pulse-accent) 40%, transparent)'
                      : (isLockedFromOthers || isSelfPrivate)
                        ? '1px dashed color-mix(in oklch, var(--pulse-text-3) 40%, transparent)'
                        : '1px solid var(--pulse-border)',
                  }}
                >
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                    color: 'var(--pulse-text-3)', textTransform: 'uppercase',
                    marginBottom: 4,
                  }}>
                    {qa.question}
                  </div>
                  {isLockedFromOthers ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      fontSize: 13, fontStyle: 'italic',
                      color: 'var(--pulse-text-3)', opacity: 0.7,
                    }}>
                      <Lock size={14} weight="fill" /> Sealed — unlocks when the game starts
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 15, lineHeight: 1.4, color: 'var(--pulse-text-1)',
                      fontWeight: 500,
                    }}>
                      {qa.answer}
                    </div>
                  )}
                  {isSelf && (
                    <div style={{ marginTop: 'var(--pulse-space-sm)' }}>
                      {revealedThis ? (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
                          color: 'var(--pulse-accent)', textTransform: 'uppercase',
                        }}>
                          <Sparkle size={12} weight="fill" /> Your first impression — public
                        </div>
                      ) : (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                          color: 'var(--pulse-text-3)', textTransform: 'uppercase',
                        }}>
                          <Lock size={12} weight="fill" /> Only you see this until the game starts
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {isSelf && (
              <p style={{
                margin: 'var(--pulse-space-xs) var(--pulse-space-xs) 0',
                fontSize: 12, fontStyle: 'italic',
                color: 'var(--pulse-text-3)',
              }}>
                Your first impression went out the moment you arrived — the rest stays yours until Day 1.
              </p>
            )}
          </section>
        )}
      </motion.div>
    </>
  );
}
