import { motion, useReducedMotion } from 'framer-motion';
import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { usePulse } from '../../PulseShell';

interface MentionRendererProps {
  text: string;
}

export function MentionRenderer({ text }: MentionRendererProps) {
  const roster = useGameStore(s => s.roster);
  const { openDM, playerId: viewerId } = usePulse();
  const reduce = useReducedMotion();

  // Parse @Name patterns and render as styled spans
  const parts: Array<{ type: 'text' | 'mention'; value: string; playerId?: string }> = [];
  const playerNames = Object.entries(roster).map(([id, p]) => ({
    id,
    name: p.personaName,
    // Escape regex special chars and match @FirstName
    pattern: new RegExp(`@${p.personaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
  }));

  let remaining = text;
  let i = 0;
  while (i < remaining.length) {
    const atIndex = remaining.indexOf('@', i);
    if (atIndex === -1) {
      parts.push({ type: 'text', value: remaining.slice(i) });
      break;
    }

    if (atIndex > i) {
      parts.push({ type: 'text', value: remaining.slice(i, atIndex) });
    }

    let matched = false;
    for (const { id, name } of playerNames) {
      if (remaining.slice(atIndex + 1).startsWith(name)) {
        parts.push({ type: 'mention', value: `@${name}`, playerId: id });
        i = atIndex + 1 + name.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      parts.push({ type: 'text', value: '@' });
      i = atIndex + 1;
    }
  }

  return (
    <span>
      {parts.map((part, idx) => {
        if (part.type === 'mention' && part.playerId) {
          const playerIndex = Object.keys(roster).indexOf(part.playerId);
          const pid = part.playerId;
          const color = getPlayerColor(playerIndex);
          const isMe = pid === viewerId;

          if (isMe) {
            // Self-mention — pink-accent pill with a one-shot pulse on mount.
            // Makes "someone's talking about YOU" read as a dopamine moment
            // without derailing the message text flow.
            return (
              <motion.button
                key={idx}
                onClick={() => openDM(pid)}
                initial={reduce ? undefined : { boxShadow: '0 0 0 0 rgba(255,59,111,0)' }}
                animate={reduce ? undefined : {
                  boxShadow: [
                    '0 0 0 0 rgba(255,59,111,0)',
                    '0 0 12px 2px rgba(255,59,111,0.55)',
                    '0 0 0 0 rgba(255,59,111,0)',
                  ],
                }}
                transition={reduce ? undefined : { duration: 0.9, ease: 'easeOut' }}
                style={{
                  appearance: 'none',
                  border: '1px solid var(--pulse-accent)',
                  padding: '0 6px',
                  borderRadius: 'var(--pulse-radius-xs)',
                  background: 'linear-gradient(180deg, color-mix(in oklch, var(--pulse-accent) 22%, transparent) 0%, color-mix(in oklch, var(--pulse-accent) 12%, transparent) 100%)',
                  color: 'var(--pulse-accent)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  font: 'inherit',
                  fontFamily: 'var(--po-font-body)',
                  letterSpacing: 0.1,
                }}
              >
                {part.value}
              </motion.button>
            );
          }

          return (
            <button
              key={idx}
              onClick={() => openDM(pid)}
              style={{
                appearance: 'none',
                background: 'none',
                border: 'none',
                padding: 0,
                color,
                fontWeight: 700,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              {part.value}
            </button>
          );
        }
        return <span key={idx}>{part.value}</span>;
      })}
    </span>
  );
}
