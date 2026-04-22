import { useGameStore, selectEliminated } from '../../../../store/useGameStore';
import { resolveAvatarUrl } from '../../../../utils/personaImage';
import { usePulse } from '../../PulseShell';
import { Coins } from '../../icons';

/**
 * "Out" — separate memorial section below the active Standings. Distinct
 * chapter: grayscale avatars, day-tag replaces the rank pill, tight row
 * rhythm. Sort: most-recent elimination first (matches cast strip tail).
 * Rows route to the DM so chat history with the eliminated player stays
 * re-readable as a memento.
 */
export function StandingsOut() {
  const eliminated = useGameStore(selectEliminated);
  const playerId = useGameStore(s => s.playerId);
  const { openDM } = usePulse();
  if (eliminated.length === 0) return null;

  // Only surface positive, unique day numbers — the server's
  // eliminatedOnDay is an unbounded int and garbage (0, -1) shouldn't leak
  // into the eyebrow summary.
  const days = Array.from(new Set(
    eliminated
      .map(e => e.eliminatedOnDay)
      .filter((d): d is number => typeof d === 'number' && d > 0),
  ));
  days.sort((a, b) => b - a);
  const eyebrow = days.length === 0
    ? `${eliminated.length} out`
    : days.length <= 3
      ? `${eliminated.length} out · ${days.map(d => `Day ${d}`).join(' · ')}`
      : `${eliminated.length} out · across ${days.length} days`;

  return (
    <section style={{
      // xl (24) top generously separates this chapter from StandingsRest.
      // lg (16) side/bottom matches the Standings section's padding grammar.
      padding: 'var(--pulse-space-xl) var(--pulse-space-lg) var(--pulse-space-lg)',
      // Hairline chapter boundary — faded by color-mix so it doesn't hard-cut.
      borderTop: '1px solid color-mix(in oklch, var(--pulse-border-2) 55%, transparent)',
      marginTop: 'var(--pulse-space-md)',
    }}>
      {/* Heading + eyebrow stack. Matches the Standings section's
          "Standings / Ranked by silver" stacked idiom — eyebrow on its own
          line survives 320px width and avoids silently ellipsing the days
          list, which is the whole point of the label. */}
      <div style={{ marginBottom: 'var(--pulse-space-md)' }}>
        <h3 style={{
          margin: 0,
          fontFamily: 'var(--po-font-display)',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--pulse-text-1)',
          lineHeight: 1,
        }}>Out</h3>
        <div style={{
          marginTop: 4,
          fontSize: 10, fontWeight: 900, letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'color-mix(in oklch, var(--pulse-gold) 75%, transparent)',
          fontVariantNumeric: 'tabular-nums',
          opacity: 0.9,
        }}>{eyebrow}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pulse-space-xs)' }}>
        {eliminated.map(entry => {
          const isSelf = entry.id === playerId;
          const outDay = typeof entry.eliminatedOnDay === 'number' && entry.eliminatedOnDay > 0
            ? entry.eliminatedOnDay
            : null;
          const dayBits = outDay ? `, out on day ${outDay}` : ', out';
          const silverBits = entry.player.silver > 0 ? `, final ${entry.player.silver} silver` : '';
          const rowAria = `${entry.player.personaName}${dayBits}${silverBits}${isSelf ? ', this is you' : ''}`;
          return (
            <button
              key={entry.id}
              aria-label={rowAria}
              onClick={() => { if (!isSelf) openDM(entry.id); }}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 'var(--pulse-space-sm)',
                padding: 'var(--pulse-space-sm) var(--pulse-space-sm)',
                background: isSelf ? 'color-mix(in oklch, var(--pulse-accent) 10%, transparent)' : 'transparent',
                border: 'none', borderRadius: 10,
                cursor: isSelf ? 'default' : 'pointer', textAlign: 'left',
                width: '100%', opacity: 0.82,
              }}
            >
              <img
                src={resolveAvatarUrl(entry.player.avatarUrl) || ''}
                alt=""
                loading="lazy"
                width={36}
                height={36}
                style={{
                  width: 36, height: 36, borderRadius: 7, objectFit: 'cover',
                  filter: 'grayscale(1) contrast(0.95)',
                  border: '1px solid var(--pulse-border-2)',
                }}
              />
              <span style={{
                flex: 1,
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--pulse-text-2)',
                minWidth: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>{entry.player.personaName}</span>
              {entry.player.silver > 0 && (
                <span aria-label={`Final ${entry.player.silver} silver`} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 11,
                  color: 'color-mix(in oklch, var(--pulse-gold) 62%, transparent)',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  opacity: 0.85,
                }}>
                  <Coins size={10} weight="fill" />
                  {entry.player.silver}
                </span>
              )}
              <span aria-hidden="true" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 900, letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'color-mix(in oklch, var(--pulse-gold) 82%, transparent)',
                background: 'rgba(8,6,12,0.82)',
                padding: '3px 7px', borderRadius: 7,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}>
                {outDay ? `D${outDay} · Out` : 'Out'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
