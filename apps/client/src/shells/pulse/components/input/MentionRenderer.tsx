import { useGameStore } from '../../../../store/useGameStore';
import { getPlayerColor } from '../../colors';
import { usePulse } from '../../PulseShell';

interface MentionRendererProps {
  text: string;
}

export function MentionRenderer({ text }: MentionRendererProps) {
  const roster = useGameStore(s => s.roster);
  const { openDM } = usePulse();

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
          return (
            <button
              key={idx}
              onClick={() => openDM(pid)}
              style={{
                appearance: 'none',
                background: 'none',
                border: 'none',
                padding: 0,
                color: getPlayerColor(playerIndex),
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
