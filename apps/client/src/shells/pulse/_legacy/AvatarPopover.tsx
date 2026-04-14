import { motion, AnimatePresence } from 'framer-motion';
import { Coins, ChatCircle, HandWaving } from '../../icons';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';
import { DayPhases } from '@pecking-order/shared-types';

interface AvatarPopoverProps {
  targetId: string;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onSilver: (targetId: string) => void;
  onDM: (targetId: string) => void;
  onNudge: (targetId: string) => void;
}

const actions = [
  { id: 'silver', Icon: Coins, label: 'Silver', color: 'var(--pulse-text-1)' },
  { id: 'dm', Icon: ChatCircle, label: 'DM', color: 'var(--pulse-text-1)' },
  { id: 'nudge', Icon: HandWaving, label: 'Nudge', color: 'var(--pulse-text-1)' },
] as const;

export function AvatarPopover({ targetId, anchorRect, onClose, onSilver, onDM, onNudge }: AvatarPopoverProps) {
  const roster = useGameStore(s => s.roster);
  const phase = useGameStore(s => s.phase);
  const player = roster[targetId];
  const playerIndex = Object.keys(roster).indexOf(targetId);
  const color = getPlayerColor(playerIndex);
  const isSocialPhase = phase !== DayPhases.ELIMINATION && phase !== DayPhases.GAME_OVER;

  if (!player || !anchorRect) return null;

  const top = anchorRect.bottom + 8;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 200));

  const handleAction = (actionId: string) => {
    if (!isSocialPhase) return;
    switch (actionId) {
      case 'silver':
        onSilver(targetId);
        break;
      case 'dm':
        onDM(targetId);
        break;
      case 'nudge':
        onNudge(targetId);
        break;
    }
    onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 59 }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={PULSE_SPRING.bouncy}
        style={{
          position: 'fixed',
          top,
          left,
          zIndex: 60,
          padding: 12,
          borderRadius: 16,
          background: 'var(--pulse-surface-3)',
          border: `1px solid ${color}33`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          minWidth: 180,
        }}
      >
        {/* Player info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <img
            src={player.avatarUrl}
            alt={player.personaName}
            style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color, fontFamily: 'var(--po-font-body)' }}>
              {player.personaName}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {actions.map(({ id, Icon, label, color: actionColor }, i) => (
            <motion.button
              key={id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...PULSE_SPRING.snappy, delay: i * 0.05 }}
              onClick={() => handleAction(id)}
              disabled={!isSocialPhase}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 4px',
                borderRadius: 10,
                background: 'var(--pulse-surface-2)',
                border: '1px solid var(--pulse-border)',
                cursor: isSocialPhase ? 'pointer' : 'not-allowed',
                color: isSocialPhase ? actionColor : 'var(--pulse-text-4)',
                opacity: isSocialPhase ? 1 : 0.4,
              }}
            >
              <Icon size={20} weight="fill" />
              <span style={{ fontSize: 9, fontWeight: 600, fontFamily: 'var(--po-font-body)' }}>{label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </>
  );
}
