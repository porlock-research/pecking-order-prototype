import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { VIVID_SPRING } from '../../springs';

/* ------------------------------------------------------------------ */
/*  Lazy-loaded panel components                                       */
/* ------------------------------------------------------------------ */

const VotingPanel = React.lazy(() => import('../../../../components/panels/VotingPanel'));
const GamePanel = React.lazy(() => import('../../../../components/panels/GamePanel'));
const PromptPanel = React.lazy(() => import('../../../../components/panels/PromptPanel'));
const DilemmaPanel = React.lazy(() => import('../../../../components/panels/DilemmaPanel'));

/* ------------------------------------------------------------------ */
/*  Kind labels                                                        */
/* ------------------------------------------------------------------ */

const KIND_LABELS: Record<string, string> = {
  voting: 'Voting',
  game: 'Game',
  prompt: 'Activity',
  dilemma: 'Dilemma',
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CartridgeTakeoverProps {
  kind: string;
  cartridge: any;
  engine: any;
  onDismiss: () => void;
}

/* ------------------------------------------------------------------ */
/*  CartridgeTakeover                                                  */
/* ------------------------------------------------------------------ */

export function CartridgeTakeover({ kind, cartridge, engine, onDismiss }: CartridgeTakeoverProps) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={VIVID_SPRING.page}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--vivid-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: 12,
          paddingLeft: 16,
          paddingRight: 16,
          background: 'var(--vivid-bg-warm)',
          borderBottom: '2px solid var(--vivid-phase-accent)',
        }}
      >
        <button
          onClick={onDismiss}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            padding: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width={20} height={20} viewBox="0 0 20 20" fill="none">
            <path
              d="M5 5l10 10M15 5L5 15"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
        </button>

        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--vivid-text)',
            letterSpacing: '0.02em',
          }}
        >
          {KIND_LABELS[kind] ?? kind}
        </span>
      </div>

      {/* Body — scrollable panel area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={null}>
          {kind === 'voting' && <VotingPanel engine={engine} />}
          {kind === 'game' && <GamePanel engine={engine} />}
          {kind === 'prompt' && <PromptPanel engine={engine} />}
          {kind === 'dilemma' && <DilemmaPanel engine={engine} />}
        </Suspense>
      </div>
    </motion.div>
  );
}
