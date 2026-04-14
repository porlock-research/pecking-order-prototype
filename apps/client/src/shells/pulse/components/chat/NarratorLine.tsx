import { useGameStore } from '../../../../store/useGameStore';
import { PersonaImage } from '../common/PersonaImage';
import { getPlayerColor } from '../../colors';

interface Props {
  kind: 'talking' | 'scheming' | 'alliance' | 'nudge';
  /** Text may contain `**markdown**` bold tokens. Bold tokens that match a persona
   *  name in the current roster render with an inline 16px avatar + accented bold
   *  text. Non-matching bold tokens (e.g. "5 players") render accented bold only.
   *  Non-bold segments render in muted italic. */
  text: string;
}

/**
 * Anonymized public-intrigue line rendered inline in the chat feed.
 * Treatment mirrors docs/reports/pulse-mockups/11-cast-strip-v2.html —
 * muted italic body, colored non-italic bold for names/counts.
 */
export function NarratorLine({ kind, text }: Props) {
  const roster = useGameStore(s => s.roster);

  const accent =
    kind === 'scheming' ? '#b07aff' :
    kind === 'alliance' ? '#ffd700' :
    kind === 'nudge' ? 'var(--pulse-nudge)' :
    'var(--pulse-accent)';

  // Pre-compute name → { id, avatarUrl } map so we can lookup per bold token.
  const rosterEntries = Object.entries(roster);
  const personaByName = new Map<string, { id: string; avatarUrl: string | undefined }>();
  for (const [id, p] of rosterEntries) {
    const entry = p as { personaName?: string; avatarUrl?: string };
    if (entry.personaName) {
      personaByName.set(entry.personaName, { id, avatarUrl: entry.avatarUrl });
    }
  }

  const segments = text.split(/(\*\*[^*]+\*\*)/g).filter(s => s.length > 0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
      }}
    >
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          minWidth: 12,
          background: 'linear-gradient(to right, transparent, var(--pulse-border))',
        }}
      />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          columnGap: 4,
          rowGap: 2,
          flexShrink: 1,
          maxWidth: '70%',
          fontSize: 11,
          fontStyle: 'italic',
          lineHeight: 1.45,
          letterSpacing: 0.2,
          color: 'var(--pulse-text-3, rgba(255,255,255,0.55))',
          textAlign: 'center',
        }}
      >
      {segments.map((seg, i) => {
        if (seg.startsWith('**') && seg.endsWith('**')) {
          const inner = seg.slice(2, -2);
          const persona = personaByName.get(inner);
          if (persona) {
            const playerIndex = rosterEntries.findIndex(([id]) => id === persona.id);
            return (
              <span
                key={i}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <PersonaImage
                  avatarUrl={persona.avatarUrl}
                  cacheKey={persona.id}
                  preferredVariant="headshot"
                  initials={inner.slice(0, 1).toUpperCase()}
                  playerColor={getPlayerColor(playerIndex >= 0 ? playerIndex : 0)}
                  alt=""
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
                <strong
                  style={{ color: accent, fontStyle: 'normal', fontWeight: 700 }}
                >
                  {inner}
                </strong>
              </span>
            );
          }
          return (
            <strong
              key={i}
              style={{ color: accent, fontStyle: 'normal', fontWeight: 700 }}
            >
              {inner}
            </strong>
          );
        }
        return <span key={i}>{seg}</span>;
      })}
      </span>
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 1,
          minWidth: 12,
          background: 'linear-gradient(to left, transparent, var(--pulse-border))',
        }}
      />
    </div>
  );
}
