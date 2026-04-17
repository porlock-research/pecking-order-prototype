import React, { Suspense } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CartridgeKind, SocialPlayer } from '@pecking-order/shared-types';
import { DILEMMA_TYPE_INFO } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import type { GameEngine } from '../../../types';
import { useGameStore } from '../../../../store/useGameStore';
import { CartridgeStageContext } from '../../../../cartridges/CartridgeStageContext';
import { PROMPT_HOW_IT_WORKS } from '../../../../cartridges/prompts/PromptShell';
import { PersonaAvatar } from '../../../../components/PersonaAvatar';

const VotingPanel  = React.lazy(() => import('../../../../components/panels/VotingPanel'));
const GamePanel    = React.lazy(() => import('../../../../components/panels/GamePanel'));
const PromptPanel  = React.lazy(() => import('../../../../components/panels/PromptPanel'));
const DilemmaPanel = React.lazy(() => import('../../../../components/panels/DilemmaPanel'));

interface Props {
  kind: CartridgeKind;
  engine: GameEngine;
}

/**
 * Pulse cartridge stage. The overlay is the frame; this component is
 * the stage inside it. It:
 *   - Vertically centers the cartridge in the overlay viewport.
 *   - Renders a distinct HOW IT WORKS card above the cartridge, so
 *     the cartridge itself can stay a tight hero+action unit.
 *   - Provides CartridgeStageContext so nested cartridges know to
 *     suppress their inline "how it works" chrome.
 */
export function PlayableCartridgeMount({ kind, engine }: Props) {
  const howItWorks = useHowItWorks(kind);
  const cast = useCastState(kind);
  const accent = useStageAccent(kind);

  return (
    <CartridgeStageContext.Provider value={{ staged: true }}>
      {/* Upper-third bias: content anchors in the top ~40% of the stage.
          The bottom half becomes the cast's ground — personas sit there
          as the floor of the room, not empty space. */}
      <div
        data-testid={`cartridge-panel-${kind}`}
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: 'clamp(16px, 6vh, 56px) 14px 24px',
          gap: 10,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 560,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {howItWorks && <StageHowItWorks text={howItWorks} />}
          <Suspense fallback={null}>
            {kind === 'voting'  && <VotingPanel engine={engine as any} />}
            {kind === 'game'    && <GamePanel engine={engine as any} />}
            {kind === 'prompt'  && <PromptPanel engine={engine as any} />}
            {kind === 'dilemma' && <DilemmaPanel engine={engine as any} />}
          </Suspense>
        </div>

        {cast && <StageCast cast={cast} accent={accent} />}
      </div>
    </CartridgeStageContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  HOW IT WORKS — distinct top card. Neutral (non-accent) on the     */
/*  stage so it reads as context, not as part of the cartridge.       */
/* ------------------------------------------------------------------ */

function StageHowItWorks({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '12px 14px 13px',
        borderRadius: 12,
        background: 'var(--pulse-surface-2)',
        border: '1px solid var(--pulse-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10.5,
          fontWeight: 800,
          letterSpacing: '0.22em',
          color: 'var(--po-text)',
          opacity: 0.72,
          textTransform: 'uppercase',
        }}
      >
        How it works
      </span>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-body)',
          fontSize: 14.5,
          lineHeight: 1.5,
          fontWeight: 500,
          color: 'var(--po-text)',
          letterSpacing: 0.05,
        }}
      >
        {text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Look up the How It Works copy from whichever active cartridge is  */
/*  in the store. Returns null if not found.                          */
/* ------------------------------------------------------------------ */

function useHowItWorks(kind: CartridgeKind): string | null {
  const activePromptCartridge = useGameStore((s) => s.activePromptCartridge);
  const activeDilemma = useGameStore((s) => s.activeDilemma);

  if (kind === 'prompt' && activePromptCartridge) {
    return PROMPT_HOW_IT_WORKS[activePromptCartridge.promptType] ?? null;
  }
  if (kind === 'dilemma' && activeDilemma) {
    const info = DILEMMA_TYPE_INFO[activeDilemma.dilemmaType as DilemmaType];
    return info?.howItWorks ?? null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  StageCast — the room of personas on the floor of the stage. Big,  */
/*  bright, with a responded/waiting treatment. Teases the social     */
/*  stakes of the cartridge: these are the players, and they're       */
/*  waiting on you (or you're waiting on them).                       */
/* ------------------------------------------------------------------ */

interface CastState {
  eligibleIds: string[];
  respondedIds: string[];
  selfId: string | null;
  roster: Record<string, SocialPlayer>;
}

function StageCast({ cast, accent }: { cast: CastState; accent: string }) {
  const reduce = useReducedMotion();
  const { eligibleIds, respondedIds, selfId, roster } = cast;
  const respondedSet = new Set(respondedIds);

  return (
    <div
      style={{
        marginTop: 'clamp(20px, 4vh, 44px)',
        width: '100%',
        maxWidth: 560,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        {eligibleIds.map((pid, i) => {
          const player = roster[pid];
          if (!player) return null;
          const did = respondedSet.has(pid);
          const isSelf = pid === selfId;
          const firstName = (player.personaName || pid).split(' ')[0];
          return (
            <motion.div
              key={pid}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.35,
                delay: 0.08 + i * 0.04,
                ease: [0.2, 0.9, 0.3, 1],
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <motion.div
                animate={
                  did || reduce
                    ? undefined
                    : { opacity: [0.6, 0.95, 0.6] }
                }
                transition={
                  did || reduce
                    ? undefined
                    : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
                }
                style={{
                  position: 'relative',
                  borderRadius: '50%',
                  padding: 2.5,
                  background: did
                    ? `conic-gradient(from 210deg, ${accent}, color-mix(in oklch, ${accent} 40%, transparent), ${accent})`
                    : 'transparent',
                  border: did
                    ? 'none'
                    : '1.5px dashed color-mix(in oklch, var(--po-text) 25%, transparent)',
                  boxShadow: did
                    ? `0 0 18px color-mix(in oklch, ${accent} 40%, transparent)`
                    : 'none',
                  filter: did ? 'none' : 'saturate(0.8)',
                  opacity: did ? 1 : 0.8,
                }}
              >
                <PersonaAvatar
                  avatarUrl={player.avatarUrl}
                  personaName={player.personaName}
                  size={60}
                />
              </motion.div>
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 11,
                  fontWeight: isSelf || did ? 700 : 500,
                  letterSpacing: 0.1,
                  color: isSelf
                    ? accent
                    : did
                      ? 'var(--po-text)'
                      : 'var(--po-text-dim)',
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {isSelf ? 'You' : firstName}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  useCastState — derive participation for the stage cast strip.     */
/*  Returns null when the cartridge doesn't support cast display      */
/*  (voting/game) or when data is server-stripped (anonymous phases). */
/* ------------------------------------------------------------------ */

function useCastState(kind: CartridgeKind): CastState | null {
  const activePrompt = useGameStore((s) => s.activePromptCartridge);
  const activeDilemma = useGameStore((s) => s.activeDilemma);
  const roster = useGameStore((s) => s.roster);
  const playerId = useGameStore((s) => s.playerId);

  if (kind === 'prompt' && activePrompt) {
    const { eligibleVoters, promptType, phase } = activePrompt;
    let respondedIds: string[] = [];
    let isAnonymous = false;

    switch (promptType) {
      case 'HOT_TAKE':
        respondedIds = Object.keys((activePrompt as any).stances ?? {});
        break;
      case 'WOULD_YOU_RATHER':
        respondedIds = Object.keys((activePrompt as any).choices ?? {});
        break;
      case 'PLAYER_PICK':
      case 'PREDICTION':
        respondedIds = Object.keys((activePrompt as any).responses ?? {});
        break;
      case 'CONFESSION':
        // COLLECTING phase is anonymous — server strips submission map.
        if (phase === 'VOTING') {
          respondedIds = Object.keys((activePrompt as any).votes ?? {});
        } else {
          isAnonymous = true;
        }
        break;
      case 'GUESS_WHO':
        if (phase === 'GUESSING') {
          respondedIds = Object.keys((activePrompt as any).guesses ?? {});
        } else {
          isAnonymous = true;
        }
        break;
    }

    if (isAnonymous) return null;
    if (!eligibleVoters?.length) return null;
    return {
      eligibleIds: eligibleVoters,
      respondedIds,
      selfId: playerId,
      roster,
    };
  }

  if (kind === 'dilemma' && activeDilemma) {
    const { eligiblePlayers, submitted } = activeDilemma as any;
    if (!eligiblePlayers?.length) return null;
    const respondedIds = Object.keys(submitted ?? {}).filter(
      (id) => submitted[id],
    );
    return {
      eligibleIds: eligiblePlayers,
      respondedIds,
      selfId: playerId,
      roster,
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  useStageAccent — pick the right accent for the cast ring.         */
/* ------------------------------------------------------------------ */

const PROMPT_STAGE_ACCENT: Record<string, string> = {
  HOT_TAKE: 'var(--po-orange)',
  WOULD_YOU_RATHER: 'var(--po-violet)',
  CONFESSION: 'var(--po-pink)',
  GUESS_WHO: 'var(--po-blue)',
  PLAYER_PICK: 'var(--po-gold)',
  PREDICTION: 'var(--po-green)',
};

const DILEMMA_STAGE_ACCENT: Record<string, string> = {
  SILVER_GAMBIT: 'var(--po-gold)',
  SPOTLIGHT: 'var(--po-pink)',
  GIFT_OR_GRIEF: 'var(--po-orange)',
};

function useStageAccent(kind: CartridgeKind): string {
  const activePrompt = useGameStore((s) => s.activePromptCartridge);
  const activeDilemma = useGameStore((s) => s.activeDilemma);

  if (kind === 'prompt' && activePrompt) {
    return PROMPT_STAGE_ACCENT[activePrompt.promptType] ?? 'var(--po-gold)';
  }
  if (kind === 'dilemma' && activeDilemma) {
    return DILEMMA_STAGE_ACCENT[activeDilemma.dilemmaType as string] ?? 'var(--po-gold)';
  }
  return 'var(--po-gold)';
}
