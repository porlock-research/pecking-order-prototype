import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AltArrowLeft, CheckCircle } from '@solar-icons/react';
import { PlayerStatuses, GAME_MASTER_ID } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../../components/PersonaAvatar';
import { VIVID_SPRING, VIVID_TAP } from '../springs';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NewConversationPickerProps {
  roster: Record<string, SocialPlayer>;
  playerId: string;
  requireDmInvite: boolean;
  onStart: (recipientIds: string[]) => void;
  onBack: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function NewConversationPicker({
  roster,
  playerId,
  requireDmInvite,
  onStart,
  onBack,
}: NewConversationPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* -- Build eligible player list (alive, not self, not GM) ---------- */

  const eligiblePlayers = useMemo(() => {
    return Object.values(roster)
      .filter(
        p =>
          p.id !== playerId &&
          p.id !== GAME_MASTER_ID &&
          p.status === PlayerStatuses.ALIVE,
      )
      .sort((a, b) => a.personaName.localeCompare(b.personaName));
  }, [roster, playerId]);

  /* -- Toggle selection --------------------------------------------- */

  const togglePlayer = (pid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(pid)) {
        next.delete(pid);
      } else {
        next.add(pid);
      }
      return next;
    });
  };

  /* -- Action button label ------------------------------------------ */

  const count = selected.size;
  const buttonLabel = requireDmInvite
    ? `Send Invite${count > 0 ? ` (${count} selected)` : ''}`
    : `Start Conversation${count > 0 ? ` (${count} selected)` : ''}`;

  /* -- Render ------------------------------------------------------- */

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--vivid-bg-deep)',
        display: 'flex',
        flexDirection: 'column',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={VIVID_SPRING.gentle}
    >
      {/* Header */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          background: 'var(--vivid-bg-surface)',
          borderBottom: '2px solid rgba(139, 115, 85, 0.06)',
          flexShrink: 0,
        }}
      >
        <motion.button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'var(--vivid-text)',
            cursor: 'pointer',
          }}
          whileTap={VIVID_TAP.button}
          transition={VIVID_SPRING.bouncy}
        >
          <AltArrowLeft size={22} weight="Bold" />
        </motion.button>

        <span
          style={{
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 800,
            fontSize: 20,
            color: 'var(--vivid-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          New Conversation
        </span>
      </div>

      {/* Player list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        <AnimatePresence>
          {eligiblePlayers.map((player, index) => {
            const isSelected = selected.has(player.id);

            return (
              <motion.button
                key={player.id}
                onClick={() => togglePlayer(player.id)}
                style={{
                  padding: '12px 16px',
                  margin: '2px 8px',
                  width: 'calc(100% - 16px)',
                  background: isSelected
                    ? 'rgba(59, 169, 156, 0.08)'
                    : '#FFFFFF',
                  border: isSelected
                    ? '2px solid rgba(59, 169, 156, 0.6)'
                    : '1px solid rgba(139, 115, 85, 0.06)',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: 'var(--vivid-surface-shadow)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03, ...VIVID_SPRING.gentle }}
                whileTap={VIVID_TAP.card}
              >
                {/* Avatar */}
                <PersonaAvatar
                  avatarUrl={player.avatarUrl}
                  personaName={player.personaName}
                  size={40}
                />

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--vivid-font-display)',
                      fontWeight: 700,
                      fontSize: 14,
                      color: 'var(--vivid-text)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {player.personaName}
                  </div>
                </div>

                {/* Checkbox */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: isSelected
                      ? 'none'
                      : '2px solid rgba(139, 115, 85, 0.2)',
                    background: isSelected ? '#3BA99C' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.15s, border 0.15s',
                  }}
                >
                  {isSelected && (
                    <CheckCircle
                      size={20}
                      weight="Bold"
                      style={{ color: '#FFFFFF' }}
                    />
                  )}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>

        {/* Empty state */}
        {eligiblePlayers.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              gap: 12,
              padding: 32,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--vivid-font-display)',
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--vivid-text-dim)',
                fontStyle: 'italic',
              }}
            >
              No players available
            </span>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '12px 16px',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          background: 'var(--vivid-bg-surface)',
          borderTop: '2px solid rgba(139, 115, 85, 0.06)',
          flexShrink: 0,
        }}
      >
        <motion.button
          onClick={() => {
            if (count > 0) onStart(Array.from(selected));
          }}
          disabled={count === 0}
          style={{
            width: '100%',
            padding: '14px 24px',
            borderRadius: 14,
            border: 'none',
            background: count > 0 ? '#3BA99C' : 'rgba(59, 169, 156, 0.3)',
            color: count > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'var(--vivid-font-display)',
            fontWeight: 700,
            fontSize: 15,
            cursor: count > 0 ? 'pointer' : 'default',
            boxShadow:
              count > 0
                ? '0 4px 12px rgba(59, 169, 156, 0.3)'
                : 'none',
            transition: 'background 0.15s, box-shadow 0.15s',
          }}
          whileTap={count > 0 ? VIVID_TAP.button : undefined}
          transition={VIVID_SPRING.bouncy}
        >
          {buttonLabel}
        </motion.button>
      </div>
    </motion.div>
  );
}
