import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { DilemmaEvents } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';

interface GiftOrGriefInputProps {
  playerId: string;
  eligiblePlayers: string[];
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
  /** Injected from DilemmaCard — orange by default (warmth + ambiguity). */
  accentColor?: string;
}

/**
 * Gift or Grief — nominate a player; the game decides downstream whether
 * their nomination becomes a gift or a grief based on majority. The
 * input is a target picker; the moral ambiguity is carried by the
 * orange accent (warm but dangerous).
 */
export default function GiftOrGriefInput({
  playerId,
  eligiblePlayers,
  roster,
  engine,
  accentColor = 'var(--po-orange, var(--po-gold))',
}: GiftOrGriefInputProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const reduce = useReducedMotion();

  const targets = eligiblePlayers.filter((id) => id !== playerId && roster[id]);

  const handleConfirm = () => {
    if (!selectedId || submitted) return;
    setSubmitted(true);
    engine.sendActivityAction(DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, { targetId: selectedId });
  };

  if (submitted && selectedId) {
    return (
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        style={{
          padding: '14px 18px',
          borderRadius: 12,
          background: `color-mix(in oklch, ${accentColor} 10%, transparent)`,
          border: `1px solid color-mix(in oklch, ${accentColor} 30%, transparent)`,
          textAlign: 'center',
          boxShadow: `0 0 18px color-mix(in oklch, ${accentColor} 20%, transparent)`,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--po-font-display)',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 0.1,
            color: accentColor,
          }}
        >
          You nominated {(roster[selectedId]?.personaName || selectedId).split(' ')[0]}
        </span>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 10,
        }}
      >
        {targets.map((pid, i) => {
          const player = roster[pid];
          if (!player) return null;
          const isSelected = selectedId === pid;
          const someoneElseSelected = selectedId !== null && !isSelected;
          const firstName = (player.personaName || pid).split(' ')[0];
          return (
            <motion.button
              key={pid}
              onClick={() => setSelectedId(pid)}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce
                  ? { duration: 0.2 }
                  : { type: 'spring', stiffness: 400, damping: 25, delay: i * 0.03 }
              }
              whileTap={reduce ? undefined : { scale: 0.97 }}
              whileHover={reduce ? undefined : { y: -2 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '12px 6px',
                borderRadius: 14,
                background: isSelected
                  ? `color-mix(in oklch, ${accentColor} 14%, transparent)`
                  : 'var(--po-bg-glass, rgba(255,255,255,0.04))',
                border: `1.5px solid ${
                  isSelected
                    ? accentColor
                    : 'var(--po-border, rgba(255,255,255,0.08))'
                }`,
                cursor: 'pointer',
                boxShadow: isSelected
                  ? `0 0 18px color-mix(in oklch, ${accentColor} 38%, transparent)`
                  : 'none',
                opacity: someoneElseSelected ? 0.55 : 1,
                transition: 'opacity 0.2s, box-shadow 0.25s, border-color 0.2s, background 0.2s',
              }}
            >
              <PersonaAvatar
                avatarUrl={player.avatarUrl}
                personaName={player.personaName}
                size={56}
              />
              <span
                style={{
                  fontFamily: 'var(--po-font-body)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.1,
                  color: isSelected ? accentColor : 'var(--po-text)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                  transition: 'color 0.2s',
                }}
              >
                {firstName}
              </span>
            </motion.button>
          );
        })}
      </div>

      {selectedId && !submitted && (
        <motion.button
          onClick={handleConfirm}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          style={{
            padding: '14px 24px',
            borderRadius: 9999,
            background: accentColor,
            color: 'var(--po-text-inverted, #fff)',
            border: 'none',
            fontWeight: 800,
            fontSize: 13,
            fontFamily: 'var(--po-font-display)',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            cursor: 'pointer',
            boxShadow: `0 4px 20px color-mix(in oklch, ${accentColor} 45%, transparent)`,
            alignSelf: 'center',
          }}
        >
          Confirm Nomination
        </motion.button>
      )}
    </div>
  );
}
