import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { DilemmaPhases, DILEMMA_TYPE_INFO } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import { HandCoins, Users, Gift, HelpCircle } from 'lucide-react';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { useCartridgeStage } from '../CartridgeStageContext';
import SilverGambitInput from './SilverGambitInput';
import SpotlightInput from './SpotlightInput';
import GiftOrGriefInput from './GiftOrGriefInput';
import DilemmaReveal from './DilemmaReveal';

/* ------------------------------------------------------------------ */
/*  Icon map — shell-agnostic lucide-react set                         */
/* ------------------------------------------------------------------ */

const DILEMMA_ICON: Record<string, React.ComponentType<any>> = {
  SILVER_GAMBIT: HandCoins,
  SPOTLIGHT: Users,
  GIFT_OR_GRIEF: Gift,
};

/**
 * Per-dilemma accent — each type gets its own identity color so the
 * dilemma bar doesn't read as a monotonous block of gold. All values
 * resolve to --po-* tokens so they adapt per shell.
 */
const DILEMMA_ACCENT: Record<string, string> = {
  SILVER_GAMBIT: 'var(--po-gold)',   // money theme
  SPOTLIGHT:     'var(--po-pink)',   // drama, the chosen one
  GIFT_OR_GRIEF: 'var(--po-orange, var(--po-gold))', // ambiguous warmth, fallback to gold
};

/* ------------------------------------------------------------------ */
/*  Participation strip (mirrors VoterStrip pattern)                   */
/* ------------------------------------------------------------------ */

function ParticipationStrip({
  eligiblePlayers,
  submitted,
  roster,
  accentColor,
}: {
  eligiblePlayers: string[];
  submitted: Record<string, boolean>;
  roster: Record<string, any>;
  accentColor: string;
}) {
  const submittedCount = eligiblePlayers.filter((id) => submitted?.[id]).length;
  const total = eligiblePlayers.length;
  const remaining = total - submittedCount;

  const statusText =
    remaining === 0
      ? `${total} of ${total} decided`
      : remaining === 1
        ? 'Waiting for 1 more…'
        : `${submittedCount} of ${total} decided`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        {eligiblePlayers.map((pid) => {
          const player = roster[pid];
          const didSubmit = submitted?.[pid] ?? false;
          return (
            <motion.div
              key={pid}
              animate={
                didSubmit
                  ? undefined
                  : { opacity: [0.55, 0.85, 0.55] }
              }
              transition={
                didSubmit
                  ? undefined
                  : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
              }
              style={{
                position: 'relative',
                borderRadius: '50%',
                padding: 2,
                background: didSubmit
                  ? `conic-gradient(from 210deg, ${accentColor}, color-mix(in oklch, ${accentColor} 40%, transparent), ${accentColor})`
                  : 'transparent',
                border: didSubmit
                  ? 'none'
                  : '1.5px dashed color-mix(in oklch, var(--po-text) 25%, transparent)',
                boxShadow: didSubmit
                  ? `0 0 14px color-mix(in oklch, ${accentColor} 40%, transparent)`
                  : 'none',
                filter: didSubmit ? 'none' : 'saturate(0.8)',
              }}
            >
              <PersonaAvatar
                avatarUrl={player?.avatarUrl}
                personaName={player?.personaName}
                size={36}
              />
            </motion.div>
          );
        })}
      </div>

      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 11,
          color: 'var(--po-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {statusText}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Prompt slot — surfaces DILEMMA_TYPE_INFO.howItWorks above input    */
/* ------------------------------------------------------------------ */

function PromptSlot({ text, accentColor }: { text: string; accentColor: string }) {
  return (
    <div
      style={{
        padding: '12px 14px 13px',
        borderRadius: 12,
        background: `color-mix(in oklch, ${accentColor} 9%, var(--po-bg-glass, rgba(255,255,255,0.04)))`,
        border: `1px solid color-mix(in oklch, ${accentColor} 26%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--po-font-display)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.26em',
          color: accentColor,
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
/*  DilemmaCard                                                        */
/* ------------------------------------------------------------------ */

interface DilemmaCardProps {
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function DilemmaCard({ engine }: DilemmaCardProps) {
  const activeDilemma = useGameStore((s) => s.activeDilemma);
  const playerId = useGameStore((s) => s.playerId);
  const roster = useGameStore((s) => s.roster);

  if (!activeDilemma || !playerId) return null;

  const { dilemmaType, phase, submitted, eligiblePlayers, decisions, results } = activeDilemma;
  const info = DILEMMA_TYPE_INFO[dilemmaType as DilemmaType] || {
    name: dilemmaType,
    howItWorks: '',
    actionVerb: 'decided',
  };
  const IconComponent = DILEMMA_ICON[dilemmaType] || HelpCircle;
  const accentColor = DILEMMA_ACCENT[dilemmaType] || 'var(--po-gold)';
  const hasSubmitted = submitted?.[playerId] ?? false;
  const { staged } = useCartridgeStage();

  return (
    <AnimatePresence>
      <motion.div
        key={`dilemma-${dilemmaType}`}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          borderRadius: 16,
          background: 'var(--po-bg-panel)',
          border: `1px solid color-mix(in oklch, ${accentColor} 22%, transparent)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          overflow: 'hidden',
          margin: '10px 0',
        }}
      >
        {/* Slim header: icon + dilemma name — accent per type */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: `1px solid color-mix(in oklch, ${accentColor} 14%, transparent)`,
            background: `color-mix(in oklch, ${accentColor} 7%, transparent)`,
            gap: 10,
          }}
        >
          <IconComponent size={20} strokeWidth={2.25} color={accentColor} />
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 15,
              fontWeight: 800,
              color: accentColor,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              flex: 1,
            }}
          >
            {info.name}
          </span>
          {phase === DilemmaPhases.COLLECTING && hasSubmitted && (
            <span
              style={{
                fontFamily: 'var(--po-font-display)',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--po-green, #2d6a4f)',
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
              }}
            >
              You {info.actionVerb}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Prompt / stakes copy — stays visible throughout the COLLECTING
              phase (including after the player submits) so they keep the
              context for what they just did while waiting for others. */}
          {phase === DilemmaPhases.COLLECTING && info.howItWorks && !staged && (
            <PromptSlot text={info.howItWorks} accentColor={accentColor} />
          )}

          {phase === DilemmaPhases.COLLECTING && !staged && (
            <ParticipationStrip
              eligiblePlayers={eligiblePlayers || []}
              submitted={submitted || {}}
              roster={roster}
              accentColor={accentColor}
            />
          )}

          {phase === DilemmaPhases.COLLECTING && !hasSubmitted && (
            <DilemmaInput
              dilemmaType={dilemmaType}
              playerId={playerId}
              eligiblePlayers={eligiblePlayers || []}
              roster={roster}
              engine={engine}
              accentColor={accentColor}
            />
          )}

          {phase === DilemmaPhases.REVEAL && decisions && results && (
            <DilemmaReveal
              dilemmaType={dilemmaType}
              decisions={decisions}
              results={results}
              roster={roster}
              playerId={playerId}
            />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Input router                                                       */
/* ------------------------------------------------------------------ */

function DilemmaInput({
  dilemmaType,
  playerId,
  eligiblePlayers,
  roster,
  engine,
  accentColor,
}: {
  dilemmaType: string;
  playerId: string;
  eligiblePlayers: string[];
  roster: Record<string, any>;
  engine: { sendActivityAction: (type: string, payload?: Record<string, any>) => void };
  accentColor: string;
}) {
  switch (dilemmaType) {
    case 'SILVER_GAMBIT':
      return <SilverGambitInput engine={engine} />;
    case 'SPOTLIGHT':
      return (
        <SpotlightInput
          playerId={playerId}
          eligiblePlayers={eligiblePlayers}
          roster={roster}
          engine={engine}
          accentColor={accentColor}
        />
      );
    case 'GIFT_OR_GRIEF':
      return (
        <GiftOrGriefInput
          playerId={playerId}
          eligiblePlayers={eligiblePlayers}
          roster={roster}
          engine={engine}
          accentColor={accentColor}
        />
      );
    default:
      return (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--po-bg-glass, rgba(255,255,255,0.04))',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--po-font-body)',
              fontSize: 12,
              color: 'var(--po-text-dim)',
            }}
          >
            Unknown dilemma type: {dilemmaType}
          </span>
        </div>
      );
  }
}
