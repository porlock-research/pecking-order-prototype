import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/useGameStore';
import { DilemmaPhases } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../shells/vivid/springs';
import SilverGambitInput from './SilverGambitInput';
import SpotlightInput from './SpotlightInput';
import GiftOrGriefInput from './GiftOrGriefInput';
import DilemmaReveal from './DilemmaReveal';

/* ------------------------------------------------------------------ */
/*  Dilemma metadata                                                   */
/* ------------------------------------------------------------------ */

const DILEMMA_INFO: Record<string, { label: string; description: string; icon: string }> = {
  SILVER_GAMBIT: {
    label: 'Silver Gambit',
    description:
      'If ALL players donate 5 silver, one lucky player wins the jackpot. But if even one person keeps their silver... nobody gets anything.',
    icon: '\u{1FA99}', // coin
  },
  SPOTLIGHT: {
    label: 'Spotlight',
    description:
      'Blind pick: choose one player. If EVERYONE picks the same person, they get 20 silver. Can you all agree without talking?',
    icon: '\u{1F526}', // flashlight
  },
  GIFT_OR_GRIEF: {
    label: 'Gift or Grief',
    description:
      'Name a player. The most-nominated gets +10 silver (a gift!). The least-nominated gets -10 silver (grief!). Choose wisely.',
    icon: '\u{1F381}', // gift
  },
};

/* ------------------------------------------------------------------ */
/*  DilemmaCard                                                        */
/* ------------------------------------------------------------------ */

interface DilemmaCardProps {
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function DilemmaCard({ engine }: DilemmaCardProps) {
  const activeDilemma = useGameStore(s => s.activeDilemma);
  const playerId = useGameStore(s => s.playerId);
  const roster = useGameStore(s => s.roster);

  if (!activeDilemma || !playerId) return null;

  const { dilemmaType, phase, submitted, eligiblePlayers, decisions, results } = activeDilemma;
  const info = DILEMMA_INFO[dilemmaType] || { label: dilemmaType, description: '', icon: '\u{2753}' };
  const hasSubmitted = submitted?.[playerId] ?? false;
  const submittedCount = Object.values(submitted || {}).filter(Boolean).length;
  const totalEligible = (eligiblePlayers || []).length;

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
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid rgba(184, 132, 10, 0.1)',
          background: 'rgba(184, 132, 10, 0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>{info.icon}</span>
            <span style={{
              fontFamily: 'var(--vivid-font-display)',
              fontSize: 13,
              fontWeight: 800,
              color: '#B8840A',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {info.label}
            </span>
          </div>
          <span style={{
            fontFamily: 'var(--vivid-font-mono, monospace)',
            fontSize: 11,
            fontWeight: 600,
            color: '#9B8E7E',
          }}>
            {submittedCount}/{totalEligible}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Description */}
          <p style={{
            fontFamily: 'var(--vivid-font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: '#3D2E1F',
            lineHeight: 1.5,
            margin: 0,
          }}>
            {info.description}
          </p>

          {/* Status strip — who has submitted */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}>
            {(eligiblePlayers || []).map((pid: string) => {
              const didSubmit = submitted?.[pid] ?? false;
              const player = roster[pid];
              const initial = player?.personaName?.charAt(0)?.toUpperCase() || '?';
              return (
                <div
                  key={pid}
                  title={player?.personaName || pid}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: didSubmit ? 'rgba(45, 106, 79, 0.12)' : 'rgba(139, 115, 85, 0.08)',
                    border: `1.5px solid ${didSubmit ? 'rgba(45, 106, 79, 0.3)' : 'rgba(139, 115, 85, 0.12)'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{
                    fontSize: didSubmit ? 12 : 10,
                    fontWeight: 700,
                    fontFamily: 'var(--vivid-font-display)',
                    color: didSubmit ? '#2D6A4F' : '#9B8E7E',
                  }}>
                    {didSubmit ? '\u{2713}' : initial}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Decision area */}
          {phase === DilemmaPhases.COLLECTING && (
            <>
              {hasSubmitted ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(45, 106, 79, 0.06)',
                    border: '1px solid rgba(45, 106, 79, 0.15)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--vivid-font-display)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#2D6A4F',
                  }}>
                    Decision locked in!
                  </span>
                  <span style={{
                    display: 'block',
                    fontFamily: 'var(--vivid-font-body)',
                    fontSize: 11,
                    color: '#9B8E7E',
                    marginTop: 2,
                  }}>
                    Waiting for others...
                  </span>
                </motion.div>
              ) : (
                <DilemmaInput
                  dilemmaType={dilemmaType}
                  playerId={playerId}
                  eligiblePlayers={eligiblePlayers || []}
                  roster={roster}
                  engine={engine}
                />
              )}
            </>
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
        <div style={{
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(139, 115, 85, 0.06)',
          textAlign: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--vivid-font-mono, monospace)',
            fontSize: 12,
            color: '#9B8E7E',
          }}>
            Unknown dilemma type: {dilemmaType}
          </span>
        </div>
      );
  }
}
