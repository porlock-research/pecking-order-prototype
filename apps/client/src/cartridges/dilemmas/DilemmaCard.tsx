import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { DilemmaPhases, DILEMMA_TYPE_INFO } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import { HandCoins, Users, Gift, HelpCircle } from 'lucide-react';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import SilverGambitInput from './SilverGambitInput';
import SpotlightInput from './SpotlightInput';
import GiftOrGriefInput from './GiftOrGriefInput';
import DilemmaReveal from './DilemmaReveal';

/* ------------------------------------------------------------------ */
/*  Icon map — shell-agnostic lucide-react set                         */
/* ------------------------------------------------------------------ */

const DILEMMA_ICON: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>> = {
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
}: {
  eligiblePlayers: string[];
  submitted: Record<string, boolean>;
  roster: Record<string, any>;
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
            <div
              key={pid}
              style={{
                position: 'relative',
                opacity: didSubmit ? 1 : 0.55,
                transition: 'opacity 0.25s ease',
              }}
            >
              <div
                style={{
                  borderRadius: '50%',
                  border: didSubmit
                    ? '2.5px solid var(--po-green, #2d6a4f)'
                    : '2px solid var(--po-border, rgba(255,255,255,0.12))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border 0.25s ease',
                  boxShadow: didSubmit
                    ? '0 0 10px color-mix(in oklch, var(--po-green) 35%, transparent)'
                    : 'none',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={36}
                />
              </div>
              {didSubmit && (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: -3,
                    right: -3,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'var(--po-green, #2d6a4f)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--po-bg-panel, rgba(0,0,0,0.5))',
                  }}
                >
                  <svg
                    width={9}
                    height={7}
                    viewBox="0 0 9 7"
                    fill="none"
                    style={{ display: 'block' }}
                  >
                    <path
                      d="M1 3.5L3.5 6L8 1"
                      stroke="white"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
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
        padding: '12px 16px',
        borderRadius: 12,
        background: `color-mix(in oklch, ${accentColor} 5%, var(--po-bg-glass, rgba(255,255,255,0.03)))`,
        border: `1px solid color-mix(in oklch, ${accentColor} 16%, transparent)`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--po-font-body)',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--po-text)',
          fontStyle: 'italic',
          textAlign: 'center',
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
          <IconComponent size={18} strokeWidth={2.25} color={accentColor} />
          <span
            style={{
              fontFamily: 'var(--po-font-display)',
              fontSize: 13,
              fontWeight: 800,
              color: accentColor,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              flex: 1,
            }}
          >
            {info.name}
          </span>
          {phase === DilemmaPhases.COLLECTING && hasSubmitted && (
            <span
              style={{
                fontFamily: 'var(--po-font-display)',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--po-green, #2d6a4f)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              You {info.actionVerb}
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Prompt / stakes copy — surfaces what this dilemma actually does.
              VotingHeader solves this for votes; dilemmas need the same
              rescue for players who don't remember the rules. */}
          {phase === DilemmaPhases.COLLECTING && !hasSubmitted && info.howItWorks && (
            <PromptSlot text={info.howItWorks} accentColor={accentColor} />
          )}

          {phase === DilemmaPhases.COLLECTING && (
            <ParticipationStrip
              eligiblePlayers={eligiblePlayers || []}
              submitted={submitted || {}}
              roster={roster}
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
