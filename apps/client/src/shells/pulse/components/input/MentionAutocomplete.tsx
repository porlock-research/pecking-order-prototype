import { motion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { PULSE_SPRING } from '../../springs';

interface MentionAutocompleteProps {
  query: string;
  onSelect: (playerName: string) => void;
  excludeId?: string;
}

/**
 * Inline autocomplete popup shown above the input when user types '@'.
 * Filters roster by query, renders matches with persona images.
 */
export function MentionAutocomplete({ query, onSelect, excludeId }: MentionAutocompleteProps) {
  const roster = useGameStore(s => s.roster);

  const matches = Object.entries(roster)
    .filter(([id, p]) => id !== excludeId && p.status === 'ALIVE')
    .filter(([_, p]) => p.personaName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5);

  if (matches.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={PULSE_SPRING.snappy}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 12,
        right: 12,
        marginBottom: 4,
        background: 'var(--pulse-surface-3)',
        border: '1px solid var(--pulse-border)',
        borderRadius: 14,
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        overflow: 'hidden',
        zIndex: 30,
      }}
    >
      {matches.map(([id, p]) => {
        const color = getPlayerColor(Object.keys(roster).indexOf(id));
        return (
          <button
            key={id}
            onClick={() => onSelect(p.personaName)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--pulse-border)',
              cursor: 'pointer',
              color: 'var(--pulse-text-1)',
              fontFamily: 'var(--po-font-body)',
              textAlign: 'left',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--pulse-surface-2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <img
              src={p.avatarUrl}
              alt=""
              style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover', objectPosition: 'center top', flexShrink: 0 }}
            />
            <span style={{ fontSize: 14, fontWeight: 700, color }}>{p.personaName}</span>
          </button>
        );
      })}
    </motion.div>
  );
}
