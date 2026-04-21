import { motion } from 'framer-motion';
import { useCallback, useMemo, useState } from 'react';
import { useGameStore } from '../../../../store/useGameStore';
import { usePulse } from '../../PulseShell';
import { PULSE_SPRING } from '../../springs';
import { PULSE_Z, backdropFor } from '../../zIndex';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';
import { ArrowLeft, Lightning, Lock, Sparkle } from '../../icons';
import type { QaEntry } from '@pecking-order/shared-types';

interface Props {
  targetId: string;
  onClose: () => void;
}

/**
 * Pregame Cast Dossier — opens on chip-tap during pregame phase (when DMs
 * are closed and the regular tap-to-DM gesture has nothing to do). Reads
 * roster + pregame-slice; if `targetId === playerId` the dossier exposes
 * "First Impressions" — reveal one of your own QA answers publicly. Reveal
 * is one-shot per player, server-enforced (l3-pregame guard).
 */
export function PregameDossierSheet({ targetId, onClose }: Props) {
  const roster = useGameStore(s => s.roster);
  const pregame = useGameStore(s => s.pregame);
  const { engine, playerId } = usePulse();

  const player = roster[targetId];
  const isSelf = targetId === playerId;
  const playerIndex = useMemo(() => Object.keys(roster).indexOf(targetId), [roster, targetId]);
  const myReveal = pregame?.revealedAnswers?.[targetId] ?? null;
  const qaAnswers: QaEntry[] = (player as any)?.qaAnswers ?? [];

  const [submittingQ, setSubmittingQ] = useState<number | null>(null);

  const handleReveal = useCallback((qIndex: number) => {
    if (!isSelf || myReveal || submittingQ !== null) return;
    setSubmittingQ(qIndex);
    engine.revealPregameAnswer(qIndex);
    // Optimistic settle — when SYNC arrives with the recorded reveal, myReveal
    // becomes truthy and the buttons disable. If the server rejects (out-of-
    // range, already revealed), the buttons re-enable on next render.
    setTimeout(() => setSubmittingQ(null), 1500);
  }, [isSelf, myReveal, submittingQ, engine]);

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
              const canReveal = isSelf && !myReveal && submittingQ === null;
              const submittingThis = submittingQ === i;
              // Server strips qa.answer for other players' un-revealed slots
              // (sync.ts roster projection). Empty answer = locked, anything
              // non-empty = visible to this viewer.
              const isLocked = !isSelf && !qa.answer;
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
                      : isLocked
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
                  {isLocked ? (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      fontSize: 13, fontStyle: 'italic',
                      color: 'var(--pulse-text-3)', opacity: 0.7,
                    }}>
                      <Lock size={14} weight="fill" /> Sealed — until {player.personaName.split(' ')[0]} chooses to reveal
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
                          fontSize: 11, fontWeight: 700, letterSpacing: 0.6,
                          color: 'var(--pulse-accent)', textTransform: 'uppercase',
                        }}>
                          <Sparkle size={12} weight="fill" /> Revealed to everyone
                        </div>
                      ) : (
                        <button
                          onClick={() => handleReveal(i)}
                          disabled={!canReveal}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 999,
                            background: canReveal ? 'var(--pulse-accent)' : 'var(--pulse-surface)',
                            color: canReveal ? 'var(--pulse-on-accent)' : 'var(--pulse-text-3)',
                            border: canReveal ? 'none' : '1px solid var(--pulse-border)',
                            fontSize: 12, fontWeight: 700,
                            cursor: canReveal ? 'pointer' : 'not-allowed',
                            opacity: submittingThis ? 0.6 : 1,
                          }}
                        >
                          <Lightning size={12} weight="fill" />
                          {submittingThis ? 'Revealing…' : 'Reveal this'}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
            {isSelf && !myReveal && (
              <p style={{
                margin: 'var(--pulse-space-xs) var(--pulse-space-xs) 0',
                fontSize: 12, fontStyle: 'italic',
                color: 'var(--pulse-text-3)',
              }}>
                Pick one to reveal publicly — first impressions stick.
              </p>
            )}
          </section>
        )}
      </motion.div>
    </>
  );
}
