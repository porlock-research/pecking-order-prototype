import React from 'react';
import { motion } from 'framer-motion';
import { Dollar, CloseCircle } from '@solar-icons/react';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

interface SilverTransferFlowProps {
  playerId: string | null;
  targetId?: string;
  targetName?: string;
  channelId?: string;
  roster: Record<string, SocialPlayer>;
  context: 'main' | 'dm' | 'group';
  onSend: (amount: number, recipientId: string) => void;
  onCancel: () => void;
}

const AMOUNTS = [1, 2, 5, 10];

export function SilverTransferFlow({
  playerId,
  targetId,
  targetName,
  roster,
  context,
  onSend,
  onCancel,
}: SilverTransferFlowProps) {
  const myPlayer = playerId ? roster[playerId] : null;
  const mySilver = myPlayer?.silver ?? 0;

  // For 1:1 DM, target is pre-selected. Group silver is future work.
  const recipientId = context === 'dm' ? targetId : undefined;
  const recipientName = recipientId ? (roster[recipientId]?.personaName ?? 'them') : undefined;

  if (!recipientId) {
    return (
      <motion.div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          marginBottom: 8,
          borderRadius: 14,
          background: 'rgba(196, 154, 32, 0.06)',
          border: '1px solid rgba(196, 154, 32, 0.15)',
        }}
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={VIVID_SPRING.snappy}
      >
        <span style={{
          fontSize: 13,
          fontFamily: 'var(--vivid-font-body)',
          color: 'var(--vivid-text-dim)',
        }}>
          Silver transfer in groups coming soon
        </span>
        <motion.button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--vivid-text-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}
          whileTap={VIVID_TAP.button}
        >
          <CloseCircle size={18} weight="Bold" />
        </motion.button>
      </motion.div>
    );
  }

  return (
    <motion.div
      style={{
        borderRadius: 14,
        background: 'rgba(196, 154, 32, 0.06)',
        border: '1px solid rgba(196, 154, 32, 0.15)',
        padding: '10px 14px',
        marginBottom: 8,
      }}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={VIVID_SPRING.snappy}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--vivid-font-display)',
          color: '#C49A20',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <Dollar size={16} weight="Bold" />
          Send Silver to {recipientName}
        </span>
        <motion.button
          type="button"
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--vivid-text-dim)', cursor: 'pointer', padding: 4, display: 'flex' }}
          whileTap={VIVID_TAP.button}
        >
          <CloseCircle size={16} weight="Bold" />
        </motion.button>
      </div>

      {/* Amount chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        {AMOUNTS.map((amt) => {
          const canAfford = mySilver >= amt;
          return (
            <motion.button
              key={amt}
              type="button"
              disabled={!canAfford}
              onClick={() => canAfford && onSend(amt, recipientId)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 10,
                background: canAfford ? '#FFFFFF' : 'rgba(139, 115, 85, 0.04)',
                border: `1.5px solid ${canAfford ? 'rgba(196, 154, 32, 0.3)' : 'rgba(139, 115, 85, 0.08)'}`,
                color: canAfford ? '#C49A20' : 'var(--vivid-text-dim)',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'var(--vivid-font-display)',
                cursor: canAfford ? 'pointer' : 'not-allowed',
                opacity: canAfford ? 1 : 0.4,
              }}
              whileTap={canAfford ? VIVID_TAP.button : undefined}
              transition={VIVID_SPRING.snappy}
            >
              {amt}
            </motion.button>
          );
        })}
      </div>

      {/* Balance hint */}
      <div style={{
        marginTop: 6,
        fontSize: 11,
        color: 'var(--vivid-text-dim)',
        fontFamily: 'var(--vivid-font-body)',
        textAlign: 'right',
      }}>
        You have {mySilver} silver
      </div>
    </motion.div>
  );
}
