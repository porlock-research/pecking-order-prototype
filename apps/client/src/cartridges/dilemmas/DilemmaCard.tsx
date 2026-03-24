import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { DilemmaPhases, DILEMMA_TYPE_INFO } from '@pecking-order/shared-types';
import type { DilemmaType } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../shells/vivid/springs';
import { HandMoney, UsersGroupRounded, Gift, QuestionCircle } from '@solar-icons/react';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import SilverGambitInput from './SilverGambitInput';
import SpotlightInput from './SpotlightInput';
import GiftOrGriefInput from './GiftOrGriefInput';
import DilemmaReveal from './DilemmaReveal';

/* ------------------------------------------------------------------ */
/*  Icon map                                                           */
/* ------------------------------------------------------------------ */

const DILEMMA_ICON: Record<string, React.ComponentType<{ size?: number; weight?: string }>> = {
  SILVER_GAMBIT: HandMoney,
  SPOTLIGHT: UsersGroupRounded,
  GIFT_OR_GRIEF: Gift,
};

/* ------------------------------------------------------------------ */
/*  Participation strip (VoterStrip-style)                             */
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
        ? 'Waiting for 1 more...'
        : `${submittedCount} of ${total} decided`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Avatar row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
        {eligiblePlayers.map((pid) => {
          const player = roster[pid];
          const didSubmit = submitted?.[pid] ?? false;
          return (
            <div
              key={pid}
              style={{ position: 'relative', opacity: didSubmit ? 1 : 0.5 }}
            >
              <div
                style={{
                  borderRadius: '50%',
                  border: didSubmit ? '2px solid #2d6a4f' : '2px solid #9B8E7E',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PersonaAvatar
                  avatarUrl={player?.avatarUrl}
                  personaName={player?.personaName}
                  size={20}
                />
              </div>
              {/* Green checkmark badge */}
              {didSubmit && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#2d6a4f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width={5}
                    height={4}
                    viewBox="0 0 5 4"
                    fill="none"
                    style={{ display: 'block' }}
                  >
                    <path
                      d="M0.5 2L1.8 3.2L4.2 0.8"
                      stroke="white"
                      strokeWidth={0.8}
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

      {/* Status text */}
      <span
        style={{
          fontFamily: 'var(--vivid-font-mono)',
          fontSize: 10,
          color: '#9B8E7E',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {statusText}
      </span>
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
  const IconComponent = DILEMMA_ICON[dilemmaType] || QuestionCircle;
  const hasSubmitted = submitted?.[playerId] ?? false;

  return (
    <AnimatePresence>
      <motion.div
        key={`dilemma-${dilemmaType}`}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.97 }}
        transition={VIVID_SPRING.bouncy}
        style={{
          borderRadius: 16,
          background: 'var(--vivid-bg-elevated, #FFFBF4)',
          border: '1px solid rgba(184, 132, 10, 0.18)',
          boxShadow: '0 4px 20px rgba(139, 115, 85, 0.1)',
          overflow: 'hidden',
          margin: '10px 0',
        }}
      >
        {/* Slim header: icon + dilemma name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            borderBottom: '1px solid rgba(184, 132, 10, 0.1)',
            background: 'rgba(184, 132, 10, 0.04)',
            gap: 8,
          }}
        >
          <IconComponent size={18} weight="Bold" color="#B8840A" />
          <span
            style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 13,
              fontWeight: 800,
              color: '#B8840A',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              flex: 1,
            }}
          >
            {info.name}
          </span>
          {/* Compact submitted indicator when already submitted */}
          {phase === DilemmaPhases.COLLECTING && hasSubmitted && (
            <span
              style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 11,
                fontWeight: 600,
                color: '#2D6A4F',
              }}
            >
              You {info.actionVerb}!
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Participation strip */}
          {phase === DilemmaPhases.COLLECTING && (
            <ParticipationStrip
              eligiblePlayers={eligiblePlayers || []}
              submitted={submitted || {}}
              roster={roster}
            />
          )}

          {/* Decision input — only show when not yet submitted */}
          {phase === DilemmaPhases.COLLECTING && !hasSubmitted && (
            <DilemmaInput
              dilemmaType={dilemmaType}
              playerId={playerId}
              eligiblePlayers={eligiblePlayers || []}
              roster={roster}
              engine={engine}
            />
          )}

          {/* Reveal area */}
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
}: {
  dilemmaType: string;
  playerId: string;
  eligiblePlayers: string[];
  roster: Record<string, any>;
  engine: { sendActivityAction: (type: string, payload?: Record<string, any>) => void };
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
        />
      );
    case 'GIFT_OR_GRIEF':
      return (
        <GiftOrGriefInput
          playerId={playerId}
          eligiblePlayers={eligiblePlayers}
          roster={roster}
          engine={engine}
        />
      );
    default:
      return (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: 'rgba(139, 115, 85, 0.06)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--vivid-font-mono, monospace)',
              fontSize: 12,
              color: '#9B8E7E',
            }}
          >
            Unknown dilemma type: {dilemmaType}
          </span>
        </div>
      );
  }
}
