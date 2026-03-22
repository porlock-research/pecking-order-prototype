import { useState } from 'react';
import { motion } from 'framer-motion';
import { DilemmaEvents } from '@pecking-order/shared-types';
import type { SocialPlayer } from '@pecking-order/shared-types';
import { PersonaAvatar } from '../../components/PersonaAvatar';
import { VIVID_SPRING, VIVID_TAP } from '../../shells/vivid/springs';

interface GiftOrGriefInputProps {
  playerId: string;
  eligiblePlayers: string[];
  roster: Record<string, SocialPlayer>;
  engine: {
    sendActivityAction: (type: string, payload?: Record<string, any>) => void;
  };
}

export default function GiftOrGriefInput({ playerId, eligiblePlayers, roster, engine }: GiftOrGriefInputProps) {
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const targets = eligiblePlayers.filter(id => id !== playerId && roster[id]);

  const handleConfirm = () => {
    if (!selectedTarget || submitted) return;
    setSubmitted(true);
    engine.sendActivityAction(DilemmaEvents.GIFT_OR_GRIEF.SUBMIT, { targetId: selectedTarget });
  };

  if (submitted && selectedTarget) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={VIVID_SPRING.bouncy}
        style={{
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(184, 132, 10, 0.08)',
          border: '1px solid rgba(184, 132, 10, 0.2)',
          textAlign: 'center',
        }}
      >
        <span style={{
          fontFamily: 'var(--vivid-font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: '#B8840A',
        }}>
          You nominated {roster[selectedTarget]?.personaName || selectedTarget}
        </span>
      </motion.div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: 8,
      }}>
        {targets.map((pid, i) => {
          const player = roster[pid];
          if (!player) return null;
          const isSelected = selectedTarget === pid;
          return (
            <motion.button
              key={pid}
              onClick={() => setSelectedTarget(pid)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...VIVID_SPRING.bouncy, delay: i * 0.03 }}
              whileTap={VIVID_TAP.card}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '10px 8px',
                borderRadius: 12,
                background: isSelected ? 'rgba(184, 132, 10, 0.1)' : 'rgba(139, 115, 85, 0.04)',
                border: `1.5px solid ${isSelected ? '#B8840A' : 'rgba(139, 115, 85, 0.1)'}`,
                cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <PersonaAvatar
                avatarUrl={player.avatarUrl}
                personaName={player.personaName}
                size={40}
              />
              <span style={{
                fontFamily: 'var(--vivid-font-body)',
                fontSize: 11,
                fontWeight: 600,
                color: isSelected ? '#B8840A' : '#3D2E1F',
                textAlign: 'center',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {player.personaName}
              </span>
            </motion.button>
          );
        })}
      </div>

      {selectedTarget && !submitted && (
        <motion.button
          onClick={handleConfirm}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={VIVID_SPRING.bouncy}
          whileTap={VIVID_TAP.button}
          style={{
            padding: '12px 20px',
            borderRadius: 9999,
            background: '#B8840A',
            color: '#FFFFFF',
            border: 'none',
            fontWeight: 700,
            fontSize: 13,
            fontFamily: 'var(--vivid-font-display)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: 'pointer',
            boxShadow: '0 3px 12px rgba(184, 132, 10, 0.25)',
            alignSelf: 'center',
          }}
        >
          Confirm Nomination
        </motion.button>
      )}
    </div>
  );
}
