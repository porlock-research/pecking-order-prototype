import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { GAME_TYPE_INFO } from '@pecking-order/shared-types';
import { VIVID_SPRING } from '../../springs';

const GamePanel = React.lazy(() => import('../../../../components/panels/GamePanel'));

function getGameName(cartridge: any): string {
  if (!cartridge?.gameType) return 'Game';
  const info = (GAME_TYPE_INFO as Record<string, { name: string }>)[cartridge.gameType];
  return info?.name || cartridge.gameType;
}

interface CartridgeTakeoverProps {
  cartridge: any;
  engine: any;
  onDismiss: () => void;
}

export function CartridgeTakeover({ cartridge, engine, onDismiss }: CartridgeTakeoverProps) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={VIVID_SPRING.page}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--vivid-bg)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 16,
        background: 'var(--vivid-bg-warm)',
        borderBottom: '2px solid var(--vivid-phase-accent)',
      }}>
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
              stroke="rgba(61,46,31,0.5)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
        </button>
        <span style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--vivid-text)',
          letterSpacing: '0.02em',
        }}>
          {getGameName(cartridge)}
        </span>
      </div>

      {/* Game panel */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Suspense fallback={null}>
          <GamePanel engine={engine} />
        </Suspense>
      </div>
    </motion.div>
  );
}
