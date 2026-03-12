import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, CloseCircle } from '@solar-icons/react';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { VIVID_SPRING, VIVID_TAP } from '../springs';
import { PersonaAvatar } from '../../../components/PersonaAvatar';

interface InviteMemberFlowProps {
  playerId: string | null;
  channelId?: string;
  roster: Record<string, SocialPlayer>;
  channelMemberIds: string[];
  onInvite: (memberIds: string[]) => void;
  onCancel: () => void;
}

export function InviteMemberFlow({
  playerId,
  channelId,
  roster,
  channelMemberIds,
  onInvite,
  onCancel,
}: InviteMemberFlowProps) {
  // Eligible = alive players not already in channel and not self
  const eligible = Object.entries(roster).filter(([pid, p]) =>
    pid !== playerId &&
    p.status !== 'ELIMINATED' &&
    !channelMemberIds.includes(pid)
  );

  if (!channelId) {
    return (
      <motion.div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          marginBottom: 8,
          borderRadius: 14,
          background: 'rgba(59, 169, 156, 0.06)',
          border: '1px solid rgba(59, 169, 156, 0.15)',
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
          Send a message first to create the conversation
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

  if (eligible.length === 0) {
    return (
      <motion.div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          marginBottom: 8,
          borderRadius: 14,
          background: 'rgba(59, 169, 156, 0.06)',
          border: '1px solid rgba(59, 169, 156, 0.15)',
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
          No eligible players to invite
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
        background: 'rgba(59, 169, 156, 0.06)',
        border: '1px solid rgba(59, 169, 156, 0.15)',
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
          color: '#3BA99C',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <UserPlus size={16} weight="Bold" />
          Invite a player
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

      {/* Player avatars as tappable chips */}
      <div style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}>
        {eligible.map(([pid, player]) => (
          <motion.button
            key={pid}
            type="button"
            onClick={() => onInvite([pid])}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px 6px 6px',
              borderRadius: 9999,
              background: '#FFFFFF',
              border: '1.5px solid rgba(59, 169, 156, 0.2)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--vivid-font-display)',
              color: 'var(--vivid-text)',
            }}
            whileTap={VIVID_TAP.button}
            transition={VIVID_SPRING.snappy}
          >
            <PersonaAvatar
              avatarUrl={player.avatarUrl}
              personaName={player.personaName}
              size={24}
            />
            {player.personaName}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
